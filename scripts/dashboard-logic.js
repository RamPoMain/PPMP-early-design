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
        const time = formatRelativeTime(record.id);

        return `
            <li class="db-activity-item">
                <div class="db-activity-main">
                    <span class="db-activity-icon ${icon.className}">${icon.svg}</span>
                    <div>
                        <p class="db-activity-text" title="${label}">${label}</p>
                        <span class="db-activity-time">${time}</span>
                    </div>
                </div>
                
                <div class="db-activity-actions">
                    <!-- VIEW BUTTON -->
                    <button class="db-action-btn" title="View Details" onclick="openRequestModal(${record.id})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    
                    <!-- DELETE BUTTON -->
                    <button class="db-action-btn delete" title="Delete" onclick="deleteRecord(${record.id})">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </li>
        `;
    }).join('');
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
    renderStats(records);
    renderActivity(records);
    
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

    // Theme must initialize regardless of what page we're on — run it
    // before anything dashboard-specific that might not apply here.
    initThemeToggle();

    const records = getRecords();

    renderStats(records);
    renderActivity(records);

    const notifDot = document.getElementById('notifDot');

    if (notifDot) {
        const pendingCount = records.filter(r => r.status === 'Pending').length;
        notifDot.classList.toggle('hidden', pendingCount === 0);
    }
});


// Kept for compatibility with the "View Details" flow used elsewhere.
function openView(id) {
    sessionStorage.setItem('view_record_id', id);
    // You can add a flag here if you want to distinguish between 
    // "Read Only" and "Edit Mode", but your current setup 
    // will load the data into the form perfectly.
    window.location.href = 'page1.html';
}