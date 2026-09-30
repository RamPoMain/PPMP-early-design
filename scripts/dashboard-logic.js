// ============================================================
// DASHBOARD LOGIC
// - Stat cards (total / pending / completed / total budget)
// - Recent activity feed (derived from saved records)
// - Dark / light theme toggle (persisted)
// ============================================================


// The first step of the approval chain (see APPROVAL_CHAIN in request-modal.js).
// Submitting a PPMP hands it to this stage.
const FIRST_APPROVAL_STAGE = 'HEAD';
// A PPMP submitted by a Unit Head skips the HEAD step (their submission is
// their approval) and goes straight to this stage.
const SECOND_APPROVAL_STAGE = 'TOD';

function getSessionUser() {
    return (typeof getSession === 'function' && getSession()) || { role: null, canApprove: false, canRequest: false };
}

// True when the signed-in account is an approver AND this record is waiting
// at their stage. Unit heads are additionally limited to their own office.
// Drafts are never actionable.
function session_isHead() {
    const s = typeof getSession === 'function' ? getSession() : null;
    return !!(s && s.stage === 'HEAD');
}

function canSessionActOnRecord(record) {
    const s = typeof getSession === 'function' ? getSession() : null;
    if (!s || !s.canApprove || !record) return false;
    if (getPpmpStatus(record) !== 'For Approval') return false;
    if (record.currentApproverRole !== s.stage) return false;
    if (s.stage === 'HEAD') return record.end_user === s.headOf;
    return true;
}

function getRecords() {
    const allRecords = JSON.parse(localStorage.getItem('procurement_records')) || [];
    const session = typeof getSession === 'function' ? getSession() : null;

    if (!session) return [];

    return allRecords.filter(record => {
        // 1. Requesters see every PPMP that belongs to their office
        //    (drafts included), whatever stage it is at.
        if (session.canRequest && record.end_user === session.office) {
            return true;
        }

        // 2. Fully approved PPMPs are visible to reviewers (TOD, Budget Officer,
        //    Regional Director) - but NOT to requesting offices, which only ever
        //    see their own office's PPMPs (rule 1 above), including Unit Heads.
        if (record.status === 'Completed' && !session.canRequest) {
            return true;
        }

        // 3. Approvers see submitted PPMPs that are waiting at their stage,
        //    or that they already acted on (so a forwarded PPMP does not
        //    vanish from their list). Unit heads: own office only.
        if (session.canApprove && getPpmpStatus(record) === 'For Approval') {
            if (session.stage === 'HEAD' && record.end_user !== session.headOf) {
                return false;
            }
            if (record.currentApproverRole === session.stage) return true;
            const history = Array.isArray(record.remarksHistory) ? record.remarksHistory : [];
            if (history.some(h => h.stage === session.stage)) return true;
        }

        return false;
    });
}


function parseBudgetNumber(rawValue) {

    if (!rawValue) return 0;

    const parsed = parseFloat(String(rawValue).replace(/,/g, ''));

    return isNaN(parsed) ? 0 : parsed;
}


function formatPeso(amount) {

    if (amount >= 1000000) {
        return '₱' + (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + 'M';
    }

    if (amount >= 1000) {
        return '₱' + (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + 'K';
    }

    return '₱' + amount.toLocaleString('en-PH');
}


function formatPesoExact(amount) {
    return 'P ' + amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


// ============================================================
// PPMP LINE ITEMS
// A PPMP record can hold more than one procurement line item, kept in
// record.items[]. Records saved before multi-item support only have a
// single item's fields directly on the record — getRecordItems()
// normalizes both shapes so the rest of the app never has to care which
// one it's looking at.
// ============================================================

// ------------------------------------------------------------
// PPMP approval helpers
// A PPMP is "closed" once it is approved (status === 'Completed').
// approved_by = { name, role, email }, approved_at = timestamp (ms).
// ------------------------------------------------------------
function isPpmpClosed(record) {
    return !!record && record.status === 'Completed';
}

// ------------------------------------------------------------
// PPMP status lifecycle:  Draft  ->  For Approval  ->  Completed
//   Draft         default; only the requesting office sees it, can edit it
//   For Approval  submitted by the requester; locked against edits. It stays
//                 'For Approval' for the whole chain - record.currentApproverRole
//                 ('HEAD' -> 'TOD' -> 'BO' -> 'RD') says whose turn it is.
//   Completed     approved by the last step (see isPpmpClosed above)
// Records saved before this existed use the old 'Pending ...' statuses, which
// are treated as Draft.
// ------------------------------------------------------------
function getPpmpStatus(record) {
    if (!record) return 'Draft';
    if (record.status === 'Completed') return 'Completed';
    if (record.status === 'For Approval') return 'For Approval';
    return 'Draft';
}

function isPpmpDraft(record) {
    return getPpmpStatus(record) === 'Draft';
}

// A Draft that an approver rejected and sent back to the requesting office.
// It stays a normal editable Draft; this flag only drives the "Returned"
// label and the rejection banner. Cleared when the requester resubmits.
function isPpmpReturned(record) {
    return !!record && getPpmpStatus(record) === 'Draft' && !!record.returned_for_revision;
}

// Locked = no longer editable by the requester (submitted or approved).
function isPpmpLocked(record) {
    return !!record && getPpmpStatus(record) !== 'Draft';
}

function statusPillClass(status) {
    if (status === 'Completed') return 'is-completed';
    if (status === 'For Approval') return 'is-pending';
    return 'is-draft';
}

// Status pill for the Entries table ("Returned" replaces "Draft" after a rejection).
function renderStatusPill(record, submittedTitle) {
    if (isPpmpReturned(record)) {
        const by = record.rejected_by && record.rejected_by.name ? record.rejected_by.name : 'an approver';
        return '<span class="db-status-pill is-returned" title="Returned by ' + escapeHtml(by) +
            ' - open the PPMP to read the remarks">Returned</span>';
    }
    const status = getPpmpStatus(record);
    return '<span class="db-status-pill ' + statusPillClass(status) + '"' + (submittedTitle || '') + '>' + status + '</span>';
}

// Approved PPMPs can only be deleted by an approver.
function canDeleteRecord(record) {
    if (!isPpmpClosed(record)) return true;
    return typeof canCurrentUserApprove === 'function' && canCurrentUserApprove();
}

function formatApprovalDate(timestamp) {
    const n = Number(timestamp);
    if (!n) return '';
    return new Date(n).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatApprovalDateTime(timestamp) {
    const n = Number(timestamp);
    if (!n) return '';
    return new Date(n).toLocaleString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

// "Approved By" cell for the Entries table.
function renderApprovedByCell(record) {
    if (!isPpmpClosed(record)) {
        return '<span class="db-approver-none">—</span>';
    }
    const by = record.approved_by;
    if (!by) {
        return '<span class="db-approver-none" title="This PPMP was completed before approver tracking existed">Not recorded</span>';
    }
    return '<div class="db-approver"><strong>' + escapeHtml(by.name) + '</strong><span>' +
        escapeHtml(formatApprovalDate(record.approved_at)) + '</span></div>';
}


function getRecordItems(record) {
    if (!record) return [];

    if (Array.isArray(record.items) && record.items.length > 0) {
        return record.items;
    }

    return [{
        id: record.id,
        project_description: record.project_description,
        project_type: record.project_type,
        mode: record.mode,
        pre_procurement: record.pre_procurement,
        bid_evaluation_criteria: record.bid_evaluation_criteria || '',
        quantity_size: record.quantity_size,
        start_date: record.start_date,
        end_date: record.end_date,
        delivery_period: record.delivery_period,
        fund_source: record.fund_source,
        budget: record.budget,
        strategies: record.strategies || [],
        remarks: record.remarks,
        supporting_documents: record.supporting_documents || []
    }];
}


function getRecordTotalBudget(record) {
    return getRecordItems(record).reduce(
        (sum, item) => sum + parseBudgetNumber(item.budget),
        0
    );
}


function getRecordDescriptionSummary(record) {
    const items = getRecordItems(record);
    if (items.length === 0) return 'N/A';

    const first = items[0].project_description || items[0].quantity_size || 'N/A';
    const extra = items.length - 1;

    return extra > 0 ? `${first} (+${extra} more item${extra === 1 ? '' : 's'})` : first;
}


function getRecordProjectTypeSummary(record) {
    const items = getRecordItems(record);
    const types = [...new Set(items.map(item => item.project_type).filter(Boolean))];

    if (types.length === 0) return 'N/A';
    if (types.length === 1) return types[0];
    return 'Mixed';
}

function getRecordCriteriaSummary(record) {
    const items = getRecordItems(record);
    const list = [...new Set(items.map(it => it.bid_evaluation_criteria).filter(Boolean))];
    if (list.length === 0) return 'N/A';
    if (list.length === 1) return list[0];
    return 'Mixed';
}


// Redirects an "add another entry" click on this PPMP into the request
// modal. Works whether we're already on a page that has the modal
// (index.html/profile.html — open it straight away) or on entries.html,
// which doesn't have the modal markup, so we stash the target PPMP and
// hop to index.html, which picks it up on load (see DOMContentLoaded below).
function requestAddEntryToPpmp(ppmpNo) {
    if (typeof addEntryToPpmp === 'function' && document.getElementById('requestModalOverlay')) {
        addEntryToPpmp(ppmpNo);
    } else {
        sessionStorage.setItem('add_entry_ppmp', ppmpNo);
        window.location.href = 'index.html';
    }
}


function formatRelativeTime(timestamp) {

    const diffMs = Date.now() - timestamp;

    if (isNaN(timestamp) || diffMs < 0) return '';

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return 'just now';
    if (diffMs < hour) return Math.floor(diffMs / minute) + ' min ago';
    if (diffMs < day) return Math.floor(diffMs / hour) + ' hr ago';
    if (diffMs < 7 * day) return Math.floor(diffMs / day) + ' day' + (Math.floor(diffMs / day) === 1 ? '' : 's') + ' ago';

    return new Date(timestamp).toLocaleDateString();
}


function renderStats(records) {

    // These stat cards only exist on the dashboard page — bail out quietly
    // on pages (like Profile) that don't have them, instead of throwing.
    const totalEl = document.getElementById('stat-total');
    if (!totalEl) return;

    totalEl.innerText = records.length;

    document.getElementById('stat-pending').innerText =
        records.filter(r => getPpmpStatus(r) !== 'Completed').length;

    document.getElementById('stat-completed').innerText =
        records.filter(r => r.status === 'Completed').length;

    const totalBudget = records.reduce(
        (sum, record) => sum + getRecordTotalBudget(record),
        0
    );

    document.getElementById('stat-budget').innerText = formatPeso(totalBudget);
}


function activityIcon(status) {

    if (status === 'Completed') {
        return {
            className: 'is-completed',
            svg: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 12.2 L11 14.8 L15.5 9.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        };
    }

    return {
        className: 'is-pending',
        svg: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12L15 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    };
}


function renderActivity(records) {
    const list = document.getElementById('db-activity-list');
    if (!list) return;

    if (records.length === 0) {
        list.innerHTML = '<li class="db-activity-empty">No activity yet.</li>';
        return;
    }

    const recent = [...records].sort((a, b) => b.id - a.id).slice(0, 6);

    list.innerHTML = recent.map(record => {
        const icon = activityIcon(record.status);
        const label = `PPMP No. ${record.ppmp_no} — ${record.end_user || 'N/A'}`;
        const safeLabel = escapeHtml(label);
        const recordId = Number(record.id);
        const time = formatRelativeTime(record.id);

        return `
            <li class="db-activity-item">
                <div class="db-activity-main">
                    <span class="db-activity-icon ${icon.className}">${icon.svg}</span>
                    <div>
                        <p class="db-activity-text" title="${safeLabel}">${safeLabel}</p>
                        <span class="db-activity-time">${time}${isPpmpClosed(record) && record.approved_by ? ' · Approved by ' + escapeHtml(record.approved_by.name) : (getPpmpStatus(record) === 'For Approval' ? ' · For approval' : (getPpmpStatus(record) === 'Draft' ? (isPpmpReturned(record) ? ' · Returned for revision' : ' · Draft') : ''))}</span>
                    </div>
                </div>
                
                <div class="db-activity-actions">
                    <!-- EXCEL PREVIEW BUTTON -->
                    <button class="db-action-btn" title="Preview Excel Format" onclick="openExcelPreview(${recordId})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H18.5C19.3 4 20 4.7 20 5.5V18.5C20 19.3 19.3 20 18.5 20H5.5C4.7 20 4 19.3 4 18.5V5.5Z"/><path d="M4 9H20M4 14H20M9 4V20M15 4V20"/></svg>
                    </button>

                    <!-- VIEW BUTTON -->
                    <button class="db-action-btn" title="View Details" onclick="openEntryRecord(${recordId})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    
                    <!-- DELETE BUTTON -->
                    ${canDeleteRecord(record) ? `<button class="db-action-btn delete" title="Delete" onclick="deleteRecord(${recordId})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>` : ''}
                </div>
            </li>
        `;
    }).join('');
}


// ------------------------------------------------------------
// Inline item editing (Excel preview dropdown on the Entries table)
// A "draft" is a working copy of a record's items, created the moment
// its dropdown is expanded and kept in memory until Save or Discard.
// It survives re-renders (filters, add/remove item) but is never
// written to localStorage until the person clicks Save Changes.
// ------------------------------------------------------------
let previewDrafts = {};
let previewItemIdSeq = 0;

const PREVIEW_PROJECT_TYPES = ['Consulting Services', 'Goods', 'Infrastructure'];

const PREVIEW_MODE_GROUPS = [
    { label: 'Competitive Mode', options: ['Competitive Bidding'] },
    { label: 'Alternative Modes', options: [
        'Limited Source Bidding', 'Direct Contracting', 'Repeat Order', 'Shopping',
        'Small Value Procurement (SVP)', 'Direct Acquisition', 'Competitive Dialogue',
        'Negotiated Procurement'
    ] }
];

const PREVIEW_CRITERIA_OPTIONS = [
    'Lowest Calculated Responsive Bid (LCRB)',
    'Most Economically Advantageous Responsive Bid (MEARB)',
    'Most Advantageous Responsive Bid (MARB) / HRRB / SRRB',
    'Lowest Comparative or Competitive Responsive Bid (LCCRB)'
];

const PREVIEW_STRATEGY_OPTIONS = [
    'Life Cycle Assessment (LCA) and LCCA', 'Subcontracting', 'Multi-Year Contracting',
    'Design-and-Build Scheme for Infrastructure', 'Engagement of a Procurement Agent',
    'Use of Framework Agreement Section', 'Pooled Procurement Section 17',
    'Renewal of Regular and Recurring Services', 'Warehousing and Inventory Activities'
];

function blankPreviewItem() {
    previewItemIdSeq += 1;
    return {
        id: Date.now() + previewItemIdSeq,
        project_description: '', project_type: '', quantity_size: '', mode: '',
        pre_procurement: '', start_date: '', end_date: '', delivery_period: '',
        fund_source: '', budget: '', strategies: [], remarks: ''
    };
}

// Reads straight from localStorage (not getRecords(), which filters by the
// signed-in office) so drafts always compare against the true saved record.
function getRawRecordById(id) {
    const all = JSON.parse(localStorage.getItem('procurement_records')) || [];
    return all.find(r => r.id == id) || null;
}

function ensurePreviewDraft(record) {
    if (!previewDrafts[record.id]) {
        previewDrafts[record.id] = { items: JSON.parse(JSON.stringify(getRecordItems(record))) };
    }
    return previewDrafts[record.id];
}

// Which record (if any) is currently shown in the full-screen preview
// modal — lets save/discard/add/remove refresh that surface too, on
// top of the Entries table's inline dropdown (see refreshPreviewSurfaces).
let activeExcelPreviewId = null;

// Editable item editing is intentionally scoped to just these two
// surfaces: the Entries page's inline dropdown, and the full-screen
// Excel Preview modal (openable from both the Entries table and the
// Dashboard's Recent Activity list). It never appears in the read-only
// PDF export or anywhere on the Profile page.
//
// Nothing is editable until the person clicks "Edit". A draft only exists
// while a PPMP is being edited, so "has a draft" == "is in edit mode":
// Save, Cancel, collapsing the dropdown and closing the preview all delete
// the draft and therefore drop back to the read-only view.
function isPreviewEditing(recordId) {
    return !!previewDrafts[recordId];
}

// "Edit" no longer turns the dropdown into editable cells: it opens the
// request form (the same one used everywhere else), so every edit goes
// through the form's validation.
function startPreviewEdit(recordId) {
    const record = getRawRecordById(recordId);
    if (!record || isPpmpLocked(record)) return;

    if (typeof openRequestModal !== 'function' || !document.getElementById('requestModalOverlay')) return;

    // Don't open the form underneath the full-screen preview.
    if (activeExcelPreviewId !== null && typeof closeExcelPreview === 'function') {
        closeExcelPreview();
    }

    openRequestModal(recordId);

    if (getRecordItems(record).length <= 1) {
        enableEditMode();
    } else {
        // The form edits one item at a time: pick the item, then press Edit.
        showToast('Use the arrows to pick an item, then press Edit.');
    }
}

// The row-level buttons (add entry, Excel preview, view details, delete)
// live in the expanded dropdown's toolbar, beside Edit, rather than in the
// table's Action column.
function buildEntryActionButtonsHtml(record) {
    const recordId = Number(record.id);
    const isPending = isPpmpDraft(record);

    return `
                <div class="db-entry-actions">
                    ${isPending ? `
                    <button type="button" class="db-action-btn" title="Add another entry to this PPMP" onclick="requestAddEntryToPpmp('${escapeHtml(record.ppmp_no || '')}')">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5V19M5 12H19"/></svg>
                    </button>
                    ` : ''}
                    <button type="button" class="db-action-btn" title="Preview Excel Format" onclick="openExcelPreview(${recordId})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H18.5C19.3 4 20 4.7 20 5.5V18.5C20 19.3 19.3 20 18.5 20H5.5C4.7 20 4 19.3 4 18.5V5.5Z"/><path d="M4 9H20M4 14H20M9 4V20M15 4V20"/></svg>
                    </button>
                    <button type="button" class="db-action-btn" title="View Details" onclick="openEntryRecord(${recordId})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    ${canDeleteRecord(record) ? `<button type="button" class="db-action-btn delete" title="Delete" onclick="deleteRecord(${recordId})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>` : ''}
                </div>`;
}

// options.record  -> also show that record's action buttons (view mode only,
//                    so nobody navigates away mid-edit with unsaved changes)
// options.canEdit -> false hides Edit (approved PPMPs); default true
function buildPreviewToolbarHtml(recordId, options = {}) {
    const canEdit = options.canEdit !== false;

    if (!isPreviewEditing(recordId)) {
        return `
        <div class="ep-toolbar">
            <span class="ep-dirty-indicator hidden" data-record-id="${recordId}">Unsaved changes</span>
            <div class="ep-toolbar-actions">
                ${options.record && options.actions !== false ? buildEntryActionButtonsHtml(options.record) : ''}
                ${options.record && isPpmpDraft(options.record) ? `<button type="button" class="ep-submit-btn" onclick="openSubmitApprovalDialog(${recordId})">Submit for Approval</button>` : ''}
                ${canEdit ? `<button type="button" class="ep-save-btn" onclick="startPreviewEdit(${recordId})">Edit</button>` : ''}
            </div>
        </div>
    `;
    }

    return `
        <div class="ep-toolbar">
            <span class="ep-dirty-indicator${isPreviewDirty(recordId) ? '' : ' hidden'}" data-record-id="${recordId}">Unsaved changes</span>
            <div class="ep-toolbar-actions">
                <button type="button" class="ep-discard-btn" onclick="discardPreviewChanges(${recordId})">Cancel</button>
                <button type="button" class="ep-save-btn" onclick="savePreviewChanges(${recordId})">Save Changes</button>
            </div>
        </div>
    `;
}

// Re-renders whichever of the two surfaces above are currently showing
// this record, so a save/discard/add/remove made in one place (say, the
// full-screen modal) is reflected in the other if both happen to be
// open for the same record.
function refreshPreviewSurfaces(recordId) {
    if (expandedEntryId === recordId) {
        renderEntries(getRecords());
    }
    if (activeExcelPreviewId === recordId) {
        const record = getRawRecordById(recordId);
        if (record) {
            renderExcelPreviewOverlay(record);
        } else {
            closeExcelPreview();
        }
    }
}


function isPreviewDirty(recordId) {
    const draft = previewDrafts[recordId];
    if (!draft) return false;
    const saved = getRawRecordById(recordId);
    if (!saved) return true;
    return JSON.stringify(draft.items) !== JSON.stringify(getRecordItems(saved));
}

function selectOptionsHtml(options, current) {
    return options.map(opt =>
        `<option value="${escapeHtml(opt)}"${opt === current ? ' selected' : ''}>${escapeHtml(opt)}</option>`
    ).join('');
}

// Builds one editable item row (12 field columns + a Remove column).
function buildEditableItemRow(record, item) {
    const rid = Number(record.id);
    const iid = item.id;

    const modeOptionsHtml = PREVIEW_MODE_GROUPS.map(group =>
        `<optgroup label="${escapeHtml(group.label)}">${selectOptionsHtml(group.options, item.mode)}</optgroup>`
    ).join('');

    const strategiesHtml = PREVIEW_STRATEGY_OPTIONS.map(opt => {
        const isChecked = Array.isArray(item.strategies) && item.strategies.includes(opt);
        return `
            <label class="ep-strategy-opt" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: flex-start !important; gap: 8px !important; margin: 4px 0 !important; cursor: pointer !important; width: 100% !important;">
                <input type="checkbox" value="${escapeHtml(opt)}" data-record-id="${rid}" data-item-id="${iid}"
                    ${isChecked ? 'checked' : ''}
                    onchange="onPreviewStrategyToggle(this)"
                    style="width: 15px !important; height: 15px !important; min-width: 15px !important; max-width: 15px !important; margin: 0 !important; padding: 0 !important; flex-shrink: 0 !important; cursor: pointer !important; appearance: auto !important; -webkit-appearance: checkbox !important;">
                <span style="flex: 1 1 auto !important; color: #111827 !important; font-size: 10.5px !important; line-height: 1.25 !important; white-space: normal !important; word-break: normal !important; text-align: left !important; font-weight: normal !important;">
                    ${escapeHtml(opt)}
                </span>
            </label>
        `;
    }).join('');

    const docsDisplay = Array.isArray(item.supporting_documents) && item.supporting_documents.length > 0
        ? item.supporting_documents.map(d => escapeHtml(d.name || 'Document')).join(', ')
        : 'None';

    return `
        <tr data-preview-item-row="${iid}">
            <!-- Col 1: Description -->
            <td><textarea class="ep-input" rows="2" data-record-id="${rid}" data-item-id="${iid}" data-field="project_description" oninput="onPreviewFieldInput(this)" placeholder="Describe the project...">${escapeHtml(item.project_description || '')}</textarea></td>
            
            <!-- Col 2: Project Type -->
            <td><select class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="project_type" onchange="onPreviewFieldInput(this)">
                <option value=""${!item.project_type ? ' selected' : ''}>Select...</option>
                ${selectOptionsHtml(PREVIEW_PROJECT_TYPES, item.project_type)}
            </select></td>
            
            <!-- Col 3: Quantity & Size -->
            <td><textarea class="ep-input" rows="2" data-record-id="${rid}" data-item-id="${iid}" data-field="quantity_size" oninput="onPreviewFieldInput(this)" placeholder="Quantity and size...">${escapeHtml(item.quantity_size || '')}</textarea></td>
            
            <!-- Col 4: Mode of Procurement -->
            <td><select class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="mode" onchange="onPreviewFieldInput(this)">
                <option value=""${!item.mode ? ' selected' : ''}>Select mode...</option>
                ${modeOptionsHtml}
            </select></td>
            
            <!-- Col 5: Pre-Procurement -->
            <td><select class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="pre_procurement" onchange="onPreviewFieldInput(this)">
                <option value=""${!item.pre_procurement ? ' selected' : ''}>Select...</option>
                ${selectOptionsHtml(['No', 'Yes'], item.pre_procurement)}
            </select></td>
            
            <!-- Col 6: Criteria for Bid Evaluation -->
            <td><select class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="bid_evaluation_criteria" onchange="onPreviewFieldInput(this)">
                <option value=""${!item.bid_evaluation_criteria ? ' selected' : ''}>Select...</option>
                ${selectOptionsHtml(PREVIEW_CRITERIA_OPTIONS, item.bid_evaluation_criteria)}
            </select></td>
            
            <!-- Col 7: Start Date -->
            <td><input type="date" class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="start_date" value="${escapeHtml(item.start_date || '')}" oninput="onPreviewFieldInput(this)"></td>
            
            <!-- Col 8: End Date -->
            <td><input type="date" class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="end_date" value="${escapeHtml(item.end_date || '')}" oninput="onPreviewFieldInput(this)"></td>
            
            <!-- Col 9: Delivery Period -->
            <td><input type="date" class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="delivery_period" value="${escapeHtml(item.delivery_period || '')}" oninput="onPreviewFieldInput(this)"></td>
            
            <!-- Col 10: Fund Source -->
            <td><input type="text" class="ep-input" data-record-id="${rid}" data-item-id="${iid}" data-field="fund_source" value="${escapeHtml(item.fund_source || '')}" oninput="onPreviewFieldInput(this)" placeholder="Source of funds"></td>
            
            <!-- Col 11: Budget -->
            <td><input type="text" class="ep-input ep-budget" data-record-id="${rid}" data-item-id="${iid}" data-field="budget" value="${escapeHtml(item.budget || '')}" oninput="onPreviewFieldInput(this)" placeholder="0.00"></td>
            
            <!-- Col 12: Procurement Strategies & Tools -->
            <td style="min-width: 220px; width: 220px; vertical-align: top;">
                <div class="ep-strategies-box" data-record-id="${rid}" data-item-id="${iid}" style="min-width: 210px; width: 100%; max-height: 110px; overflow-y: auto; overflow-x: hidden; padding: 6px 8px; background: #fff; border: 1px solid #c7c7c7; border-radius: 4px; box-sizing: border-box;">
                    ${strategiesHtml}
                </div>
            </td>
            
            <!-- Col 13: Attached Supporting Documents -->
            <td style="min-width: 140px; width: 140px;">
                <div style="font-size: 10.5px; line-height: 1.4; word-break: break-word; color: #374151;">
                    ${docsDisplay}
                </div>
            </td>
            
            <!-- Col 14: Remarks -->
            <td><textarea class="ep-input" rows="2" data-record-id="${rid}" data-item-id="${iid}" data-field="remarks" oninput="onPreviewFieldInput(this)" placeholder="Remarks">${escapeHtml(item.remarks || '')}</textarea></td>
            
            <!-- Col 15: Actions (Remove) -->
            <td class="ep-remove-cell">
                <button type="button" class="ep-remove-btn" title="Remove this item" onclick="removePreviewItem(${rid}, ${iid})">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6L18 18M18 6L6 18" stroke-linecap="round"/></svg>
                </button>
            </td>
        </tr>
    `;
}


// Renders a list of values (strategies, attached document names) as a short
// bulleted list inside a table cell. Accepts an array or a single string;
// anything empty shows a muted "None". Every value is HTML-escaped here.
function renderPreviewList(values) {
    const list = (Array.isArray(values) ? values : [values])
        .map(v => String(v == null ? '' : v).trim())
        .filter(Boolean);

    if (list.length === 0) return '<span class="ep-none">None</span>';

    return '<ul class="ep-list">' +
        list.map(v => '<li>' + escapeHtml(v) + '</li>').join('') +
        '</ul>';
}


function buildExcelPreviewMarkup(record, editable) {
    const isIndicative = record.is_indicative === 'Indicative';
    const isFinal = record.is_indicative === 'Final';
    const items = editable ? ensurePreviewDraft(record).items : getRecordItems(record);
    const formattedTotal = formatPesoExact(
        items.reduce((sum, item) => sum + parseBudgetNumber(item.budget), 0)
    );

    const itemRows = editable
        ? items.map(item => buildEditableItemRow(record, item)).join('')
        : items.map(item => {
        const itemStrategies = renderPreviewList(item.strategies);

        const attachedDocs = renderPreviewList(
            Array.isArray(item.supporting_documents)
                ? item.supporting_documents.map(doc => doc.name || 'Document')
                : []
        );

        return `
            <tr>
                <td>${escapeHtml(item.project_description || '')}</td>
                <td>${escapeHtml(item.project_type || '')}</td>
                <td>${escapeHtml(item.quantity_size || '')}</td>
                <td>${escapeHtml(item.mode || '')}</td>
                <td>${escapeHtml(item.pre_procurement || '')}</td>
                <td>${escapeHtml(item.bid_evaluation_criteria || 'N/A')}</td>
                <td>${escapeHtml(item.start_date || '')}</td>
                <td>${escapeHtml(item.end_date || '')}</td>
                <td>${escapeHtml(item.delivery_period || '')}</td>
                <td>${escapeHtml(item.fund_source || '')}</td>
                <td>${escapeHtml(formatPesoExact(parseBudgetNumber(item.budget)))}</td>
                <td>${itemStrategies}</td>
                <td>${attachedDocs}</td>
                <td>${escapeHtml(item.remarks || '')}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="excel-preview-sheet">
            <div class="excel-preview-banner">
                <img src="images/header-banner.png" alt="DICT Header Banner">
            </div>

            <h2>PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. ${escapeHtml(record.ppmp_no || 'N/A')}</h2>

            <div class="excel-preview-checks">
                <span><span class="excel-check-box">${isIndicative ? 'X' : ''}</span> INDICATIVE</span>
                <span><span class="excel-check-box">${isFinal ? 'X' : ''}</span> FINAL</span>
            </div>

            <div class="excel-preview-meta">
                <p>Fiscal Year : ${escapeHtml(record.fiscal_year || 'N/A')}</p>
                <p>End-User or Implementing Unit: ${escapeHtml(record.end_user || 'N/A')}</p>
            </div>

            <div class="excel-preview-table-wrap">
                <table class="excel-preview-table">
                    <thead>
                        <tr>
                            <th colspan="6">PROCUREMENT PROJECT DETAILS</th>
                            <th colspan="3">PROJECTED TIMELINE (MM/YYYY)</th>
                            <th colspan="2">FUNDING DETAILS</th>
                            <th rowspan="2">PROCUREMENT STRATEGIES AND TOOLS</th>
                            <th rowspan="2">ATTACHED SUPPORTING DOCUMENTS</th>
                            <th rowspan="2">REMARKS</th>
                            ${editable ? '<th rowspan="2">Actions</th>' : ''}
                        </tr>
                        <tr>
                            <th>General Description and Objective of the Project to be Procured</th>
                            <th>Type of the Project to be Procured</th>
                            <th>Quantity and Size of the Project to be Procured</th>
                            <th>Recommended Mode of Procurement</th>
                            <th>Pre-Procurement Conference (Yes/No)</th>
                            <th>Criteria for Bid Evaluation</th>
                            <th>Start of Procurement Activity</th>
                            <th>End of Procurement Activity</th>
                            <th>Expected Delivery/ Implementation Period</th>
                            <th>Source of Funds</th>
                            <th>Estimated Budget / Authorized Budgetary Allocation (PhP)</th>
                        </tr>
                        <tr>
                            <th>Column 1</th>
                            <th>Column 2</th>
                            <th>Column 3</th>
                            <th>Column 4</th>
                            <th>Column 5</th>
                            <th>Column 6</th>
                            <th>Column 7</th>
                            <th>Column 8</th>
                            <th>Column 9</th>
                            <th>Column 10</th>
                            <th>Column 11</th>
                            <th>Column 12</th>
                            <th>Column 13</th>
                            <th>Column 14</th>
                            ${editable ? '<th></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                        <tr>
                            <td colspan="10" class="excel-total-label">TOTAL BUDGET:</td>
                            <td class="excel-total-value">${escapeHtml(formattedTotal)}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            ${editable ? '<td></td>' : ''}
                        </tr>
                        ${editable ? `
                        <tr class="ep-add-row">
                            <td colspan="15">
                                <button type="button" class="ep-add-btn" onclick="addItemViaRequestModal(${Number(record.id)})">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5V19M5 12H19" stroke-linecap="round"/></svg>
                                    Add Item
                                </button>
                            </td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>

            <div class="excel-preview-signatures">
                <div>
                    <p>Prepared by / Submitted by:</p>
                    <span></span>
                    <strong>JAYMARK D. DUMIO</strong>
                    <small>Signature over Printed Name</small>
                    <small>Focal, ICT Literacy Competency and Development Bureau X</small>
                    <small>Date: ${escapeHtml(new Date().toLocaleDateString())}</small>
                </div>
                <div>
                    <p>Certified Funds Available:</p>
                    <span></span>
                    <strong>BRYAN JOHN M. SABLAS</strong>
                    <small>Signature over Printed Name</small>
                    <small>Budget Officer II</small>
                </div>
                <div>
                    <p>Approved by:</p>
                    <span></span>
                    <strong>SITTIE RAHMA V. ALAWI, MTM, CSSGB</strong>
                    <small>Signature over Printed Name</small>
                    <small>Regional Director, DICT X</small>
                    ${isPpmpClosed(record) && record.approved_by ? `<small>Approved in system by ${escapeHtml(record.approved_by.name)}${record.approved_at ? ' on ' + escapeHtml(formatApprovalDate(record.approved_at)) : ''}</small>` : ''}
                </div>
                <div>
                    <p>Endorsed by:</p>
                    <span></span>
                    <strong>EUGENE C. RAPOSALA III</strong>
                    <small>Signature over Printed Name</small>
                    <small>Chief, Technical Operations Division</small>
                </div>
            </div>
        </div>
    `;
}


function openExcelPreview(id) {
    const record = getRecords().find(item => item.id == id);
    if (!record) return;

    activeExcelPreviewId = record.id;
    renderExcelPreviewOverlay(record);
}


// Builds/updates the full-screen preview modal's content for one record.
// Called on first open (openExcelPreview) and again after any edit made
// while it's open (refreshPreviewSurfaces), so Save/Discard/Add/Remove
// all stay in sync without closing and reopening the modal.
function renderExcelPreviewOverlay(record) {
    const isEditable = !isPpmpLocked(record);          // may be edited (shows the Edit button)
    const isEditing = isEditable && isPreviewEditing(record.id); // currently in edit mode

    let overlay = document.getElementById('excelPreviewOverlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'excelPreviewOverlay';
        overlay.className = 'excel-preview-overlay hidden';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="excel-preview-modal" role="dialog" aria-modal="true" aria-labelledby="excelPreviewTitle">
            <div class="excel-preview-header">
                <div>
                    <h3 id="excelPreviewTitle">Excel Preview</h3>
                    <p>PPMP No. ${escapeHtml(record.ppmp_no || 'N/A')}</p>
                </div>
                <div class="excel-preview-actions">
                    <button type="button" class="db-action-btn" title="Open Full Request" onclick="openEntryRecord(${Number(record.id)})">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button type="button" class="db-action-btn" title="Close Preview" onclick="closeExcelPreview()">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6L18 18M18 6L6 18" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>
            <div class="excel-preview-scroll">
                ${isEditable ? buildPreviewToolbarHtml(Number(record.id), { record: record, actions: false }) : ''}
                ${buildExcelPreviewMarkup(record, isEditing)}
            </div>
        </div>
    `;

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}


function closeExcelPreview() {
    const overlay = document.getElementById('excelPreviewOverlay');
    if (!overlay) return;

    // Closing discards any unsaved edits, the same as collapsing the
    // Entries dropdown does — Save Changes is the only thing that persists.
    if (activeExcelPreviewId !== null) {
        delete previewDrafts[activeExcelPreviewId];
        activeExcelPreviewId = null;
    }

    overlay.classList.add('hidden');
    document.body.style.overflow = '';
}


function getFilteredEntryRecords(records) {
    const statusFilter = document.getElementById('entryStatusFilter');
    const indicativeFilter = document.getElementById('entryIndicativeFilter');
    const typeFilter = document.getElementById('entryTypeFilter');
    const officeFilter = document.getElementById('entryOfficeFilter');
    const searchInput = document.getElementById('entrySearchInput');

    const statusValue = statusFilter ? statusFilter.value : 'All';
    const indicativeValue = indicativeFilter ? indicativeFilter.value : 'All';
    const typeValue = typeFilter ? typeFilter.value : 'All';
    const officeValue = officeFilter ? officeFilter.value : 'All';
    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';

    return records.filter(record => {
        const items = getRecordItems(record);
        const statusMatches = statusValue === 'All' || getPpmpStatus(record) === statusValue;
        const indicativeMatches = indicativeValue === 'All' || record.is_indicative === indicativeValue;
        const typeMatches = typeValue === 'All' || items.some(item => item.project_type === typeValue);
        const officeMatches = officeValue === 'All' || record.end_user === officeValue;
        const searchHaystack = [
            record.ppmp_no,
            record.end_user,
            record.fiscal_year,
            ...items.map(item => item.project_description),
            ...items.map(item => item.project_type),
            ...items.map(item => item.mode)
        ].join(' ').toLowerCase();

        return statusMatches && indicativeMatches && typeMatches && officeMatches && (!searchValue || searchHaystack.includes(searchValue));
    });
}


function getApprovedEntryNumbers(records) {
    // Only approved (Completed) entries get a number, and every office is
    // numbered on its own: FPIAP's fifth approval is "5" while an office with
    // nothing approved yet has no number at all. Numbers follow approval order
    // within the office and never shift because of filters or new requests.
    const numbers = new Map();
    const perOffice = new Map();

    records
        .filter(record => record.status === 'Completed')
        .sort((a, b) =>
            (Number(a.approved_at) || Number(a.id)) -
            (Number(b.approved_at) || Number(b.id))
        )
        .forEach(record => {
            const office = record.end_user || 'N/A';
            const next = (perOffice.get(office) || 0) + 1;
            perOffice.set(office, next);
            numbers.set(String(record.id), next);
        });

    return numbers;
}


// Fills the Office filter from the offices present in the records this account
// can see. Hidden when there is only one (requesting offices), so it only shows
// up for reviewers. Rebuilt only when the list changes, so an open dropdown
// is never disturbed by a re-render.
function populateOfficeFilter(records) {
    const select = document.getElementById('entryOfficeFilter');
    if (!select) return;

    const offices = [...new Set(records.map(r => r.end_user).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    const wrap = select.closest('.db-filter-control');
    if (wrap) wrap.classList.toggle('hidden', offices.length < 2);

    const wanted = ['All'].concat(offices);
    const have = Array.from(select.options).map(o => o.value);

    if (JSON.stringify(wanted) !== JSON.stringify(have)) {
        const current = select.value;
        select.innerHTML = wanted.map(o =>
            '<option value="' + escapeHtml(o) + '">' + (o === 'All' ? 'All offices' : escapeHtml(o)) + '</option>'
        ).join('');
        select.value = wanted.includes(current) ? current : 'All';
    }
}


// ------------------------------------------------------------
// Inline "Excel preview" dropdown on the Entries table.
// Clicking a row's PPMP number expands a preview of that PPMP directly
// under the row, built from the same buildExcelPreviewMarkup() used by
// the full-screen preview. Because renderEntries() re-runs on every
// filter/search change and re-derives this from the current filtered
// list, the dropdown is automatically "filter-aware": if the expanded
// PPMP gets filtered out, it collapses on its own.
// ------------------------------------------------------------
let expandedEntryId = null;

function toggleEntryPreviewRow(id) {
    // Whichever row was open loses its unsaved draft, whether we collapse it
    // or switch to another row.
    if (expandedEntryId !== null) {
        delete previewDrafts[expandedEntryId];
    }
    expandedEntryId = (expandedEntryId === id) ? null : id;
    renderEntries(getRecords());
}

// ------------------------------------------------------------
// Inline item editing — field handlers. These write into the draft only
// (never localStorage) and touch just the dirty indicator in the DOM, so
// typing never triggers a full table re-render and never drops focus.
// ------------------------------------------------------------
function updatePreviewDirtyIndicator(recordId) {
    document.querySelectorAll(`.ep-dirty-indicator[data-record-id="${recordId}"]`).forEach(el => {
        el.classList.toggle('hidden', !isPreviewDirty(recordId));
    });
}

function onPreviewFieldInput(el) {
    const recordId = Number(el.dataset.recordId);
    const itemId = Number(el.dataset.itemId);
    const field = el.dataset.field;
    const draft = previewDrafts[recordId];
    if (!draft) return;

    const item = draft.items.find(it => it.id == itemId);
    if (!item) return;

    item[field] = el.value;
    updatePreviewDirtyIndicator(recordId);
}

function onPreviewStrategyToggle(checkbox) {
    const recordId = Number(checkbox.dataset.recordId);
    const itemId = Number(checkbox.dataset.itemId);
    const draft = previewDrafts[recordId];
    if (!draft) return;

    const item = draft.items.find(it => it.id == itemId);
    if (!item) return;

    const current = new Set(Array.isArray(item.strategies) ? item.strategies : []);
    if (checkbox.checked) current.add(checkbox.value); else current.delete(checkbox.value);
    item.strategies = Array.from(current);
    updatePreviewDirtyIndicator(recordId);
}

function addPreviewItem(recordId) {
    const record = getRawRecordById(recordId);
    if (!record || isPpmpLocked(record)) return;

    const draft = ensurePreviewDraft(record);
    draft.items.push(blankPreviewItem());
    refreshPreviewSurfaces(recordId);
}

// "Add Item" in the preview dropdown now opens the request modal (the same
// form as the "+" row button) instead of inserting a blank row to type into.
// Unsaved inline edits are kept safe: closing the preview or hopping from
// entries.html to index.html would discard them, so ask to save first.
function addItemViaRequestModal(recordId) {
    const record = getRawRecordById(recordId);
    if (!record || isPpmpLocked(record)) return;

    if (isPreviewDirty(recordId)) {
        showToast('You have unsaved changes - Save or Discard them, then add the new item.');
        return;
    }

    // Close the full-screen preview (if it is the surface being used) so the
    // request modal is not opened underneath it.
    if (activeExcelPreviewId !== null && typeof closeExcelPreview === 'function') {
        closeExcelPreview();
    }

    requestAddEntryToPpmp(String(record.ppmp_no || ''));
}

// ------------------------------------------------------------
// SUBMIT FOR APPROVAL
// Moves a Draft PPMP to "For Approval". From then on it is visible to
// approvers (see getRecords) and locked against edits by the requester.
// Confirmation reuses the .logout-* dialog styling, like the approval one.
// ------------------------------------------------------------
let submitApprovalEl = null;
let submitApprovalRecordId = null;
let submitApprovalPrevFocus = null;

function buildSubmitApprovalDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'logout-overlay';
    overlay.id = 'submitApprovalOverlay';
    overlay.innerHTML =
        '<div class="logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="submitApprovalTitle" aria-describedby="submitApprovalDesc">' +
            '<div class="logout-icon is-approve">' +
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M5 12L19 5L15 19L11.5 13L5 12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
            '</div>' +
            '<h3 id="submitApprovalTitle">Submit for approval?</h3>' +
            '<p id="submitApprovalDesc"></p>' +
            '<div class="logout-actions">' +
                '<button type="button" class="logout-cancel-btn" data-submit-cancel>Cancel</button>' +
                '<button type="button" class="logout-confirm-btn is-approve" data-submit-confirm>Submit</button>' +
            '</div>' +
        '</div>';

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeSubmitApprovalDialog();
    });
    overlay.querySelector('[data-submit-cancel]').addEventListener('click', closeSubmitApprovalDialog);
    overlay.querySelector('[data-submit-confirm]').addEventListener('click', confirmSubmitForApproval);

    document.body.appendChild(overlay);
    return overlay;
}

function onSubmitApprovalKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // don't also close the Excel preview / request modal behind it
        closeSubmitApprovalDialog();
    }
}

function openSubmitApprovalDialog(recordId) {
    const record = getRawRecordById(recordId);
    if (!record || !isPpmpDraft(record)) return;

    if (isPreviewDirty(recordId)) {
        showToast('You have unsaved changes - Save or Cancel them before submitting.');
        return;
    }

    if (!submitApprovalEl) submitApprovalEl = buildSubmitApprovalDialog();
    submitApprovalRecordId = recordId;

    document.getElementById('submitApprovalTitle').textContent =
        'Submit PPMP No. ' + (record.ppmp_no || 'N/A') + ' for approval?';
    document.getElementById('submitApprovalDesc').textContent =
        (session_isHead() ? 'Its status will change from Draft to For Approval and it goes straight to the TOD. ' :
                            'Its status will change from Draft to For Approval and it goes to your Unit Head. ') +
        'While it is under review it can no longer be edited or get new items.';

    submitApprovalPrevFocus = document.activeElement;
    submitApprovalEl.classList.add('show');
    document.addEventListener('keydown', onSubmitApprovalKeydown, true);

    // Default focus on Cancel so a stray Enter never submits anything.
    submitApprovalEl.querySelector('[data-submit-cancel]').focus();
}

function closeSubmitApprovalDialog() {
    if (!submitApprovalEl) return;
    submitApprovalEl.classList.remove('show');
    document.removeEventListener('keydown', onSubmitApprovalKeydown, true);
    if (submitApprovalPrevFocus && typeof submitApprovalPrevFocus.focus === 'function') {
        submitApprovalPrevFocus.focus();
    }
}

function confirmSubmitForApproval() {
    const recordId = submitApprovalRecordId;
    closeSubmitApprovalDialog();
    submitApprovalRecordId = null;
    if (recordId === null) return;

    const session = typeof getSession === 'function' ? getSession() : null;
    if (!session) return;

    const all = JSON.parse(localStorage.getItem('procurement_records')) || [];
    const idx = all.findIndex(r => r.id == recordId);
    if (idx === -1) return;

    if (!isPpmpDraft(all[idx])) {
        showToast('This PPMP was already submitted for approval.');
        refreshPreviewSurfaces(recordId);
        return;
    }

    all[idx].status = 'For Approval';
    all[idx].submitted_at = Date.now();
    // A resubmission after a rejection starts a new review round.
    all[idx].returned_for_revision = false;
    all[idx].submission_round = (Number(all[idx].submission_round) || 1) + (all[idx].rejected_at ? 1 : 0);

    if (session.stage === 'HEAD') {
        // Unit Head submitting for their own unit: counts as the head's approval.
        all[idx].currentApproverRole = SECOND_APPROVAL_STAGE;
        if (!Array.isArray(all[idx].remarksHistory)) all[idx].remarksHistory = [];
        all[idx].remarksHistory.push({
            stage: 'HEAD',
            role: session.role,
            name: session.roleName,
            action: 'submitted',
            round: all[idx].submission_round,
            remarks: 'Submitted by the Unit Head.',
            date: new Date().toLocaleDateString(),
            at: Date.now()
        });
    } else {
        all[idx].currentApproverRole = FIRST_APPROVAL_STAGE;
    }
    all[idx].submitted_by = {
        name: session.roleName,
        role: session.role,
        email: session.email
    };

    try {
        localStorage.setItem('procurement_records', JSON.stringify(all));
    } catch (err) {
        showToast('Could not submit for approval — please try again.');
        return;
    }

    delete previewDrafts[recordId];
    refreshDashboardRecords();
    refreshPreviewSurfaces(recordId);
    showToast('PPMP No. ' + all[idx].ppmp_no + ' submitted for approval.');
}

function removePreviewItem(recordId, itemId) {
    const draft = previewDrafts[recordId];
    if (!draft) return;

    if (draft.items.length <= 1) {
        showToast('A PPMP needs at least one item — add a replacement before removing this one.');
        return;
    }

    draft.items = draft.items.filter(it => it.id != itemId);
    refreshPreviewSurfaces(recordId);
}

// Resets the draft back to the last-saved version (does not collapse the
// dropdown), so the person can see the discard take effect immediately.
function discardPreviewChanges(recordId) {
    delete previewDrafts[recordId];
    refreshPreviewSurfaces(recordId);
}

function savePreviewChanges(recordId) {
    const draft = previewDrafts[recordId];
    if (!draft) return;

    const hasEmptyDescription = draft.items.some(it => !String(it.project_description || '').trim());
    if (hasEmptyDescription) {
        showToast('Each item needs a project description before saving.');
        return;
    }

    const all = JSON.parse(localStorage.getItem('procurement_records')) || [];
    const idx = all.findIndex(r => r.id == recordId);
    if (idx === -1) return;

    if (getPpmpStatus(all[idx]) !== 'Draft') {
        showToast('This PPMP was submitted or approved while you were editing, so it is now read-only.');
        delete previewDrafts[recordId];
        refreshPreviewSurfaces(recordId);
        return;
    }

    all[idx].items = JSON.parse(JSON.stringify(draft.items));

    try {
        localStorage.setItem('procurement_records', JSON.stringify(all));
    } catch (err) {
        showToast('Could not save changes — please try again.');
        return;
    }

    delete previewDrafts[recordId];
    refreshDashboardRecords();
    refreshPreviewSurfaces(recordId);
    showToast('PPMP items saved.');
}


function renderEntries(records) {
    const tbody = document.getElementById('entriesTableBody');
    if (!tbody) return;

    const emptyState = document.getElementById('entriesEmptyState');
    const resultCount = document.getElementById('entriesResultCount');
    populateOfficeFilter(records);
    const filteredRecords = getFilteredEntryRecords(records).sort((a, b) => b.id - a.id);
    const approvedNumbers = getApprovedEntryNumbers(records);

    if (expandedEntryId !== null && !filteredRecords.some(r => r.id == expandedEntryId)) {
        delete previewDrafts[expandedEntryId];
        expandedEntryId = null;
    }

    if (resultCount) {
        resultCount.textContent =
            `${filteredRecords.length} ${filteredRecords.length === 1 ? 'entry' : 'entries'}` +
            ` · ${filteredRecords.filter(r => r.status === 'Completed').length} approved`;
    }

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = filteredRecords.map(record => {
        const status = getPpmpStatus(record);
        const submittedTitle = status === 'For Approval' && record.submitted_by
            ? ` title="Submitted by ${escapeHtml(record.submitted_by.name)}${record.submitted_at ? ' on ' + escapeHtml(formatApprovalDate(record.submitted_at)) : ''}"`
            : '';
        const ppmpType = record.is_indicative === 'Final' ? 'Final' : (record.is_indicative === 'Indicative' ? 'Indicative' : 'N/A');
        const description = getRecordDescriptionSummary(record);
        const budget = formatPeso(getRecordTotalBudget(record));
        const recordId = Number(record.id);
        const entryNumber = approvedNumbers.get(String(record.id));
        const isExpanded = expandedEntryId === record.id;
        const isEditable = isExpanded && !isPpmpLocked(record);
        const isEditing = isEditable && isPreviewEditing(record.id);

        return `
            <tr>
                <td class="db-entry-number"${entryNumber ? '' : ' style="opacity:.4" title="Numbered within its office once approved"'}>${entryNumber || '—'}</td>
                <td class="db-entry-ppmp-cell${isExpanded ? ' is-expanded' : ''}" onclick="toggleEntryPreviewRow(${recordId})" title="${isExpanded ? 'Hide' : 'Show'} Excel preview">
                    <svg class="db-entry-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6L15 12L9 18" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div><strong>PPMP No. ${escapeHtml(record.ppmp_no || 'N/A')}</strong><span>${escapeHtml(record.fiscal_year || '')}</span></div>
                </td>
                <td class="db-entry-description">${escapeHtml(description)}</td>
                <td>${escapeHtml(record.end_user || 'N/A')}</td>
                <td>${escapeHtml(getRecordProjectTypeSummary(record))}</td>
                <td>${escapeHtml(getRecordCriteriaSummary(record))}</td>
                <td>${escapeHtml(budget)}</td>
                <td>${renderStatusPill(record, submittedTitle)}</td>
                <td>${ppmpType === 'N/A' ? 'N/A' : `<span class="db-status-pill ${ppmpType === 'Final' ? 'is-type-final' : 'is-type-indicative'}">${ppmpType}</span>`}</td>
                <td>${renderApprovedByCell(record)}</td>
            </tr>
            ${isExpanded ? `
            <tr class="db-entry-expand-row">
                <td colspan="10">
                    <div class="db-entry-expand-inner">
                        ${buildPreviewToolbarHtml(Number(record.id), { record: record, canEdit: isEditable })}
                        ${buildExcelPreviewMarkup(record, isEditing)}
                    </div>
                </td>
            </tr>
            ` : ''}
        `;
    }).join('');
}

function initEntryFilters() {
    ['entryStatusFilter', 'entryIndicativeFilter', 'entryTypeFilter', 'entryOfficeFilter', 'entrySearchInput'].forEach(id => {
        const control = document.getElementById(id);
        if (!control) return;

        control.addEventListener('input', function () {
            renderEntries(getRecords());
        });

        control.addEventListener('change', function () {
            renderEntries(getRecords());
        });
    });
}


function openEntryRecord(id) {
    if (
        typeof openRequestModal === 'function' &&
        document.getElementById('requestModalOverlay')
    ) {
        openRequestModal(id);
    }
}
// Shared toast notification (used by every page that loads this file)
function showToast(message) {
    let toast = document.getElementById('dbToast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'dbToast';
        toast.className = 'db-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function () {
        toast.classList.remove('show');
    }, 3200);
}


// Function to Delete a record (or a single line item within one)
// pendingDelete shape: { type: 'record', id } or { type: 'item', recordId, itemId }
let pendingDelete = null;

// Swaps the confirm modal's heading/message. Falls back to doing nothing
// if a page (e.g. one without the delete feature) doesn't have these ids.
function setConfirmModalText(title, message) {
    const titleEl = document.getElementById('confirmModalTitle');
    const textEl = document.getElementById('confirmModalText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
}

// 1. Function called when clicking the trash icon on a whole PPMP row
function deleteRecord(id) {
    const target = getRecords().find(r => r.id == id);
    if (!target) return; // not visible to this account, so not theirs to delete
    if (!canDeleteRecord(target)) {
        showToast('An approved PPMP is closed and can only be deleted by an approver.');
        return;
    }

    pendingDelete = { type: 'record', id: id };
    setConfirmModalText(
        'Delete Request?',
        'Are you sure you want to delete this procurement request? This action cannot be undone.'
    );
    const confirmModal = document.getElementById('confirmModalOverlay');
    confirmModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
}

// 1b. Function called when clicking "Delete Item" while viewing a single
// line item inside the request modal. Warns up front if this is the only
// item left, since removing it removes the whole PPMP.
function deleteRecordItem(recordId, itemId) {
    if (!recordId || !itemId) return;

    const confirmModal = document.getElementById('confirmModalOverlay');
    if (!confirmModal) return; // page has no delete UI (e.g. Profile)

    const records = getRecords();
    const record = records.find(r => r.id == recordId);
    if (isPpmpLocked(record)) {
        showToast('This PPMP was submitted for approval or approved — its items can no longer be deleted.');
        return;
    }
    const items = record && typeof getRecordItems === 'function' ? getRecordItems(record) : [];
    const isOnlyItem = items.length <= 1;

    pendingDelete = { type: 'item', recordId: recordId, itemId: itemId };

    setConfirmModalText(
        isOnlyItem ? 'Delete Request?' : 'Delete This Item?',
        isOnlyItem
            ? 'This is the only item on this PPMP, so deleting it will delete the entire request. This action cannot be undone.'
            : 'Are you sure you want to delete this line item from the PPMP? This action cannot be undone.'
    );

    confirmModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// 2. Function to close the popup
function closeConfirmModal() {
    const confirmModal = document.getElementById('confirmModalOverlay');
    confirmModal.classList.add('hidden');
    document.body.style.overflow = '';
    pendingDelete = null;
}

// This gathers the rendering logic so it can be called from the modal
function refreshDashboardRecords() {
    const records = getRecords(); // This uses the filtered logic from our previous step

    if (typeof renderStats === 'function') renderStats(records);
    if (typeof renderActivity === 'function') renderActivity(records);
    
    // Entries page: render the table from the same (role-filtered) records.
    // (Previously called a non-existent renderEntriesTable(), so the table
    // stayed empty until a filter or search box was touched.)
    if (typeof renderEntries === 'function') renderEntries(records);

    // Update the Notification Dot
    const notifDot = document.getElementById('notifDot');
    if (notifDot) {
        // Show dot if there are any requests waiting for the current user's approval
        const pendingCount = records.filter(canSessionActOnRecord).length;
        notifDot.classList.toggle('hidden', pendingCount === 0);
    }
}

// 3. Event Listener for the actual "Delete" button inside the popup
document.addEventListener('DOMContentLoaded', function() {
    const session = getSession();
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.onclick = function() {
            if (!pendingDelete) return;

            if (pendingDelete.type === 'item') {
                executeItemDeletion(pendingDelete.recordId, pendingDelete.itemId);
            } else if (pendingDelete.type === 'record') {
                executeDeletion(pendingDelete.id);
            }

            closeConfirmModal();
        };
    }
    if (!session || !session.canRequest) {
        const newRequestButtons = document.querySelectorAll('.db-nav-item[onclick*="startNewRequest"], .db-nav-item[onclick*="open_new_request"], .db-nav-item[onclick*="openRequestModal"], .db-cta-btn');
        newRequestButtons.forEach(btn => btn.style.display = 'none');
    }
    
    refreshDashboardRecords();
});

// 4. The actual whole-record deletion logic
function executeDeletion(id) {
    let records = JSON.parse(localStorage.getItem('procurement_records')) || [];
    records = records.filter(r => r.id !== id);
    localStorage.setItem('procurement_records', JSON.stringify(records));
    
    // Update the Dashboard UI
    refreshDashboardRecords();
    
    // Show the Toast notification (if you have the function)
    if (typeof showToast === 'function') {
        showToast("Request deleted successfully.");
    }
}

// 4b. Deletes a single line item from a PPMP record. If it was the last
// remaining item, the whole record is removed instead (a PPMP with zero
// items has nothing left to show).
function executeItemDeletion(recordId, itemId) {
    let records = JSON.parse(localStorage.getItem('procurement_records')) || [];
    const idx = records.findIndex(r => r.id == recordId);
    if (idx === -1) return;

    const remainingItems = getRecordItems(records[idx]).filter(it => it.id != itemId);
    const wholeRecordRemoved = remainingItems.length === 0;

    if (wholeRecordRemoved) {
        records.splice(idx, 1);
    } else {
        records[idx] = Object.assign({}, records[idx], { items: remainingItems });
    }

    localStorage.setItem('procurement_records', JSON.stringify(records));

    refreshDashboardRecords();

    // If the request modal is currently open on this same record, keep it
    // in sync: jump to a neighboring item, or close it if nothing is left.
    if (typeof currentEditingId !== 'undefined' && currentEditingId == recordId) {
        if (wholeRecordRemoved) {
            if (typeof closeRequestModal === 'function') closeRequestModal();
        } else if (typeof loadRecordIntoModal === 'function') {
            const nextIndex = Math.min(
                typeof currentItemIndex === 'number' ? currentItemIndex : 0,
                remainingItems.length - 1
            );
            loadRecordIntoModal(recordId, nextIndex);
        }
    }

    if (typeof showToast === 'function') {
        showToast(wholeRecordRemoved ? 'Request deleted successfully.' : 'Item deleted successfully.');
    }
}


function initThemeToggle() {

    const root = document.documentElement;
    const toggleBtn = document.getElementById('themeToggle');
    const moonIcon = document.getElementById('themeIconMoon');
    const sunIcon = document.getElementById('themeIconSun');

    if (!toggleBtn) return;

    function applyTheme(theme) {

        root.setAttribute('data-theme', theme);

        if (moonIcon && sunIcon) {
            moonIcon.style.display = theme === 'dark' ? '' : 'none';
            sunIcon.style.display = theme === 'light' ? '' : 'none';
        }
    }

    const savedTheme = localStorage.getItem('dashboard_theme') || 'dark';
    applyTheme(savedTheme);

    toggleBtn.addEventListener('click', function () {

        const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

        applyTheme(nextTheme);
        localStorage.setItem('dashboard_theme', nextTheme);
    });
}

document.addEventListener('DOMContentLoaded', function () {

    initThemeToggle();
    initEntryFilters();
    refreshDashboardRecords();

    const openRecordId = sessionStorage.getItem('open_record_id');
    const shouldOpenNewRequest = sessionStorage.getItem('open_new_request') === '1';
    const addEntryPpmp = sessionStorage.getItem('add_entry_ppmp');

    if (openRecordId && typeof openRequestModal === 'function') {
        sessionStorage.removeItem('open_record_id');
        setTimeout(function () {
            openRequestModal(openRecordId);
        }, 0);
    } else if (addEntryPpmp && typeof addEntryToPpmp === 'function') {
        sessionStorage.removeItem('add_entry_ppmp');
        setTimeout(function () {
            addEntryToPpmp(addEntryPpmp);
        }, 0);
    } else if (shouldOpenNewRequest && typeof startNewRequest === 'function') {
        sessionStorage.removeItem('open_new_request');
        setTimeout(function () {
            startNewRequest();
        }, 0);
    } else if (shouldOpenNewRequest && typeof openRequestModal === 'function') {
        sessionStorage.removeItem('open_new_request');
        setTimeout(function () {
            openRequestModal();
        }, 0);
    }
});


document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeExcelPreview();
    }
});


document.addEventListener('click', function (event) {
    if (event.target && event.target.id === 'excelPreviewOverlay') {
        closeExcelPreview();
    }
});