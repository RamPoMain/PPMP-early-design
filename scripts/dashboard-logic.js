// ============================================================
// DASHBOARD LOGIC
// - Stat cards (total / pending / completed / total budget)
// - Recent activity feed (derived from saved records)
// - Dark / light theme toggle (persisted)
// ============================================================

function getRecords() {
    return JSON.parse(localStorage.getItem('procurement_records')) || [];
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
        (sum, record) => sum + parseBudgetNumber(record.budget),
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
    const numericBudget = parseBudgetNumber(record.budget);
    const formattedBudget = formatPesoExact(numericBudget);
    const isIndicative = record.is_indicative === 'Indicative';
    const isFinal = record.is_indicative === 'Final';
    const strategies = Array.isArray(record.strategies)
        ? record.strategies.join(', ')
        : record.strategies || '';

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
                        <tr>
                            <td>${escapeHtml(record.project_description || '')}</td>
                            <td>${escapeHtml(record.project_type || '')}</td>
                            <td>${escapeHtml(record.quantity_size || '')}</td>
                            <td>${escapeHtml(record.mode || '')}</td>
                            <td>${escapeHtml(record.pre_procurement || '')}</td>
                            <td>${escapeHtml(record.start_date || '')}</td>
                            <td>${escapeHtml(record.end_date || '')}</td>
                            <td>${escapeHtml(record.delivery_period || '')}</td>
                            <td>${escapeHtml(record.fund_source || '')}</td>
                            <td>${escapeHtml(formattedBudget)}</td>
                            <td>${escapeHtml(strategies)}</td>
                            <td>${escapeHtml(record.remarks || '')}</td>
                        </tr>
                        <tr>
                            <td colspan="9" class="excel-total-label">TOTAL BUDGET:</td>
                            <td class="excel-total-value">${escapeHtml(formattedBudget)}</td>
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
    const typeFilter = document.getElementById('entryTypeFilter');
    const searchInput = document.getElementById('entrySearchInput');

    const statusValue = statusFilter ? statusFilter.value : 'All';
    const typeValue = typeFilter ? typeFilter.value : 'All';
    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';

    return records.filter(record => {
        const statusMatches = statusValue === 'All' || record.status === statusValue;
        const typeMatches = typeValue === 'All' || record.project_type === typeValue;
        const searchHaystack = [
            record.ppmp_no,
            record.project_description,
            record.end_user,
            record.project_type,
            record.mode,
            record.fiscal_year
        ].join(' ').toLowerCase();

        return statusMatches && typeMatches && (!searchValue || searchHaystack.includes(searchValue));
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
        const description = record.project_description || record.quantity_size || 'N/A';
        const budget = formatPeso(parseBudgetNumber(record.budget));
        const recordId = Number(record.id);
        const entryNumber = approvedNumbers.get(String(record.id));

        return `
            <tr>
                <td class="db-entry-number"${entryNumber ? '' : ' style="opacity:.4" title="Numbered once approved"'}>${entryNumber || '—'}</td>
                <td><strong>PPMP No. ${escapeHtml(record.ppmp_no || 'N/A')}</strong><span>${escapeHtml(record.fiscal_year || '')}</span></td>
                <td class="db-entry-description">${escapeHtml(description)}</td>
                <td>${escapeHtml(record.end_user || 'N/A')}</td>
                <td>${escapeHtml(record.project_type || 'N/A')}</td>
                <td>${escapeHtml(budget)}</td>
                <td><span class="db-status-pill ${status === 'Completed' ? 'is-completed' : 'is-pending'}">${status}</span></td>
                <td>
                    <div class="db-entry-actions">
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
    ['entryStatusFilter', 'entryTypeFilter', 'entrySearchInput'].forEach(id => {
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
        return;
    }

    sessionStorage.setItem('open_record_id', String(id));
    window.location.href = 'index.html';
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


// Function to Delete a record
let recordIdToDelete = null;

// 1. Function called when clicking the trash icon
function deleteRecord(id) {
    recordIdToDelete = id; // Store the ID we want to delete
    const confirmModal = document.getElementById('confirmModalOverlay');
    confirmModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
}

// 2. Function to close the popup
function closeConfirmModal() {
    const confirmModal = document.getElementById('confirmModalOverlay');
    confirmModal.classList.add('hidden');
    document.body.style.overflow = '';
    recordIdToDelete = null;
}

// 3. Event Listener for the actual "Delete" button inside the popup
document.addEventListener('DOMContentLoaded', function() {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.onclick = function() {
            if (recordIdToDelete !== null) {
                executeDeletion(recordIdToDelete);
                closeConfirmModal();
            }
        };
    }
});

// 4. The actual deletion logic
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

    if (openRecordId && typeof openRequestModal === 'function') {
        sessionStorage.removeItem('open_record_id');
        setTimeout(function () {
            openRequestModal(openRecordId);
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