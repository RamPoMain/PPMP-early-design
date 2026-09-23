// ============================================================
// DASHBOARD LOGIC
// - Stat cards (total / pending / completed / total budget)
// - Recent activity feed (derived from saved records)
// - Dark / light theme toggle (persisted)
// ============================================================

function getRecords() {
    const all = JSON.parse(localStorage.getItem('procurement_records')) || [];

    // Scope every read to the signed-in office so one account never sees
    // another office's PPMPs/entries. Writes still go straight to
    // localStorage (see saveProcurementRequest, etc.) against the full,
    // unfiltered list, so this never risks losing other offices' data.
    const session = typeof getSession === 'function' ? getSession() : null;
    if (!session || !session.office) return all;

    const office = session.office.trim().toLowerCase();
    return all.filter(r => (r.end_user || '').trim().toLowerCase() === office);
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
        records.filter(r => r.status === 'Pending').length;

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
                        <span class="db-activity-time">${time}</span>
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
                    <button class="db-action-btn delete" title="Delete" onclick="deleteRecord(${recordId})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </li>
        `;
    }).join('');
}


function buildExcelPreviewMarkup(record) {
    const isIndicative = record.is_indicative === 'Indicative';
    const isFinal = record.is_indicative === 'Final';
    const items = getRecordItems(record);
    const formattedTotal = formatPesoExact(getRecordTotalBudget(record));

    const itemRows = items.map(item => {
        const itemStrategies = Array.isArray(item.strategies)
            ? item.strategies.join(', ')
            : item.strategies || '';

        return `
                        <tr>
                            <td>${escapeHtml(item.project_description || '')}</td>
                            <td>${escapeHtml(item.project_type || '')}</td>
                            <td>${escapeHtml(item.quantity_size || '')}</td>
                            <td>${escapeHtml(item.mode || '')}</td>
                            <td>${escapeHtml(item.pre_procurement || '')}</td>
                            <td>${escapeHtml(item.start_date || '')}</td>
                            <td>${escapeHtml(item.end_date || '')}</td>
                            <td>${escapeHtml(item.delivery_period || '')}</td>
                            <td>${escapeHtml(item.fund_source || '')}</td>
                            <td>${escapeHtml(formatPesoExact(parseBudgetNumber(item.budget)))}</td>
                            <td>${escapeHtml(itemStrategies)}</td>
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
                            <th colspan="5">PROCUREMENT PROJECT DETAILS</th>
                            <th colspan="3">PROJECTED TIMELINE (MM/YYYY)</th>
                            <th colspan="2">FUNDING DETAILS</th>
                            <th rowspan="2">ATTACHED SUPPORTING DOCUMENTS</th>
                            <th rowspan="2">REMARKS</th>
                        </tr>
                        <tr>
                            <th>General Description and Objective of the Project to be Procured</th>
                            <th>Type of the Project to be Procured</th>
                            <th>Quantity and Size of the Project to be Procured</th>
                            <th>Recommended Mode of Procurement</th>
                            <th>Pre-Procurement Conference (Yes/No)</th>
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
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                        <tr>
                            <td colspan="9" class="excel-total-label">TOTAL BUDGET:</td>
                            <td class="excel-total-value">${escapeHtml(formattedTotal)}</td>
                            <td></td>
                            <td></td>
                        </tr>
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
    const records = getRecords();
    const record = records.find(item => item.id == id);
    if (!record) return;

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
                ${buildExcelPreviewMarkup(record)}
            </div>
        </div>
    `;

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}


function closeExcelPreview() {
    const overlay = document.getElementById('excelPreviewOverlay');
    if (!overlay) return;

    overlay.classList.add('hidden');
    document.body.style.overflow = '';
}


function getFilteredEntryRecords(records) {
    const statusFilter = document.getElementById('entryStatusFilter');
    const indicativeFilter = document.getElementById('entryIndicativeFilter');
    const typeFilter = document.getElementById('entryTypeFilter');
    const searchInput = document.getElementById('entrySearchInput');

    const statusValue = statusFilter ? statusFilter.value : 'All';
    const indicativeValue = indicativeFilter ? indicativeFilter.value : 'All';
    const typeValue = typeFilter ? typeFilter.value : 'All';
    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';

    return records.filter(record => {
        const items = getRecordItems(record);
        const statusMatches = statusValue === 'All' || record.status === statusValue;
        const indicativeMatches = indicativeValue === 'All' || record.is_indicative === indicativeValue;
        const typeMatches = typeValue === 'All' || items.some(item => item.project_type === typeValue);
        const searchHaystack = [
            record.ppmp_no,
            record.end_user,
            record.fiscal_year,
            ...items.map(item => item.project_description),
            ...items.map(item => item.project_type),
            ...items.map(item => item.mode)
        ].join(' ').toLowerCase();

        return statusMatches && indicativeMatches && typeMatches && (!searchValue || searchHaystack.includes(searchValue));
    });
}


function getApprovedEntryNumbers(records) {
    // Only approved (Completed) entries get a number, assigned in the order
    // they were approved. Pending entries, filters and new requests never
    // shift these numbers.
    const numbers = new Map();

    records
        .filter(record => record.status === 'Completed')
        .sort((a, b) =>
            (Number(a.approved_at) || Number(a.id)) -
            (Number(b.approved_at) || Number(b.id))
        )
        .forEach((record, index) => numbers.set(String(record.id), index + 1));

    return numbers;
}


function renderEntries(records) {
    const tbody = document.getElementById('entriesTableBody');
    if (!tbody) return;

    const emptyState = document.getElementById('entriesEmptyState');
    const resultCount = document.getElementById('entriesResultCount');
    const filteredRecords = getFilteredEntryRecords(records).sort((a, b) => b.id - a.id);
    const approvedNumbers = getApprovedEntryNumbers(records);

    if (resultCount) {
        resultCount.textContent =
            `${filteredRecords.length} ${filteredRecords.length === 1 ? 'entry' : 'entries'}` +
            ` · ${approvedNumbers.size} approved`;
    }

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = filteredRecords.map(record => {
        const status = record.status === 'Completed' ? 'Completed' : 'Pending';
        const ppmpType = record.is_indicative === 'Final' ? 'Final' : (record.is_indicative === 'Indicative' ? 'Indicative' : 'N/A');
        const description = getRecordDescriptionSummary(record);
        const budget = formatPeso(getRecordTotalBudget(record));
        const recordId = Number(record.id);
        const entryNumber = approvedNumbers.get(String(record.id));

        return `
            <tr>
                <td class="db-entry-number"${entryNumber ? '' : ' style="opacity:.4" title="Numbered once approved"'}>${entryNumber || '—'}</td>
                <td><strong>PPMP No. ${escapeHtml(record.ppmp_no || 'N/A')}</strong><span>${escapeHtml(record.fiscal_year || '')}</span></td>
                <td class="db-entry-description">${escapeHtml(description)}</td>
                <td>${escapeHtml(record.end_user || 'N/A')}</td>
                <td>${escapeHtml(getRecordProjectTypeSummary(record))}</td>
                <td>${escapeHtml(budget)}</td>
                <td><span class="db-status-pill ${status === 'Completed' ? 'is-completed' : 'is-pending'}">${status}</span></td>
                <td>${ppmpType === 'N/A' ? 'N/A' : `<span class="db-status-pill ${ppmpType === 'Final' ? 'is-type-final' : 'is-type-indicative'}">${ppmpType}</span>`}</td>
                <td>
                    <div class="db-entry-actions">
                        ${status === 'Pending' ? `
                        <button class="db-action-btn" title="Add another entry to this PPMP" onclick="requestAddEntryToPpmp('${escapeHtml(record.ppmp_no || '')}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5V19M5 12H19"/></svg>
                        </button>
                        ` : ''}
                        <button class="db-action-btn" title="Preview Excel Format" onclick="openExcelPreview(${recordId})">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H18.5C19.3 4 20 4.7 20 5.5V18.5C20 19.3 19.3 20 18.5 20H5.5C4.7 20 4 19.3 4 18.5V5.5Z"/><path d="M4 9H20M4 14H20M9 4V20M15 4V20"/></svg>
                        </button>
                        <button class="db-action-btn" title="View Details" onclick="openEntryRecord(${recordId})">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="db-action-btn delete" title="Delete" onclick="deleteRecord(${recordId})">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}


function refreshDashboardRecords() {
    const records = getRecords();

    renderStats(records);
    renderActivity(records);
    renderEntries(records);

    const notifDot = document.getElementById('notifDot');

    if (notifDot) {
        const pendingCount = records.filter(r => r.status === 'Pending').length;
        notifDot.classList.toggle('hidden', pendingCount === 0);
    }
}


function initEntryFilters() {
    ['entryStatusFilter', 'entryIndicativeFilter', 'entryTypeFilter', 'entrySearchInput'].forEach(id => {
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

// 3. Event Listener for the actual "Delete" button inside the popup
document.addEventListener('DOMContentLoaded', function() {
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