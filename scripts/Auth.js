// ============================================================
// DICT PROCUREMENT — AUTH (client-side only, no backend yet)
//
// Three hardcoded office accounts. Each account's `office` string
// must exactly match the "End-User or Implementing Unit" value
// stored on a PPMP record — getRecords() in dashboard-logic.js
// filters on it, and enableModalFields() in request-modal.js
// auto-fills/locks the End-User field to it. Change an office
// name here and both stay in sync automatically.
// ============================================================

const ACCOUNTS = [
    {
        email: 'tod@dict.gov.ph',
        password: 'tod123',
        role: 'TOD',
        roleName: 'Technical Operations Division',
        office: 'Technical Operations Division'
    },
    {
        email: 'aafd@dict.gov.ph',
        password: 'aafd123',
        role: 'AAFD',
        roleName: 'Administrative and Finance Division',
        office: 'Administrative and Finance Division'
    },
    {
        email: 'test@dict.gov.ph',
        password: 'test123',
        role: 'POP',
        roleName: 'POP (Test Account)',
        office: 'POP Test Office'
    }
];

// Looks up an account by email + password (case-insensitive email).
function findAccount(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    return ACCOUNTS.find(function (acct) {
        return acct.email.toLowerCase() === normalizedEmail && acct.password === password;
    }) || null;
}

function getSession() {
    try {
        return JSON.parse(localStorage.getItem('dashboard_session'));
    } catch (e) {
        return null;
    }
}

function setSession(account) {
    localStorage.setItem('dashboard_session', JSON.stringify({
        email: account.email,
        role: account.role,
        roleName: account.roleName,
        office: account.office
    }));
}

function clearSession() {
    localStorage.removeItem('dashboard_session');
}

// Call at the very top of every protected page (in <head>, before the
// page renders) — bounces straight to login.html if no one's signed in.
function requireAuth() {
    if (!getSession()) {
        window.location.replace('login.html');
    }
}

// Fills the sidebar's avatar/name/email from the current session.
// Safe to call on any page that has the standard .db-avatar /
// .db-user-name / .db-user-email sidebar markup.
function applySessionToSidebar() {
    const session = getSession();
    if (!session) return;

    const initials = (session.role || '??').slice(0, 2).toUpperCase();

    document.querySelectorAll('.db-avatar').forEach(function (el) {
        el.textContent = initials;
    });
    document.querySelectorAll('.db-user-name').forEach(function (el) {
        el.textContent = session.roleName;
    });
    document.querySelectorAll('.db-user-email').forEach(function (el) {
        el.textContent = session.email;
    });

    // Optional per-page greetings (only index.html has these right now)
    const subtitle = document.getElementById('db-subtitle-greeting');
    if (subtitle) subtitle.textContent = 'Welcome back, ' + session.roleName;

    const heading = document.getElementById('db-welcome-heading');
    if (heading) heading.textContent = 'Good day, ' + session.role + '!';
}

// ============================================================
// LOGOUT — custom confirmation modal (replaces the browser confirm())
//
// The modal is built on first use and appended to <body>, so no page
// needs extra markup. Styles live in dashboard.css (.logout-*), which
// follows the same dark/light theme variables as the rest of the app.
// ============================================================

let logoutModalEl = null;
let logoutPrevFocus = null;

function buildLogoutModal() {
    const overlay = document.createElement('div');
    overlay.className = 'logout-overlay';
    overlay.id = 'logoutOverlay';
    overlay.innerHTML =
        '<div class="logout-modal" role="alertdialog" aria-modal="true" ' +
            'aria-labelledby="logoutTitle" aria-describedby="logoutDesc">' +
            '<div class="logout-icon">' +
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="none">' +
                    '<path d="M9 20H5.6C5 20 4.5 19.5 4.5 18.9V5.1C4.5 4.5 5 4 5.6 4H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
                    '<path d="M15.5 16L19.5 12L15.5 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '<path d="M19.2 12H10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
                '</svg>' +
            '</div>' +
            '<h3 id="logoutTitle">Log out?</h3>' +
            '<p id="logoutDesc">You will need to sign in again to get back to your procurement records.</p>' +
            '<div class="logout-actions">' +
                '<button type="button" class="logout-cancel-btn" data-logout-cancel>Cancel</button>' +
                '<button type="button" class="logout-confirm-btn" data-logout-confirm>Log out</button>' +
            '</div>' +
        '</div>';

    // Click on the dimmed backdrop (but not the card) cancels.
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeLogoutModal();
    });
    overlay.querySelector('[data-logout-cancel]').addEventListener('click', closeLogoutModal);
    overlay.querySelector('[data-logout-confirm]').addEventListener('click', performLogout);

    document.body.appendChild(overlay);
    return overlay;
}

// Escape closes; Tab is kept inside the two buttons while the modal is open.
function onLogoutKeydown(e) {
    if (!logoutModalEl || !logoutModalEl.classList.contains('show')) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeLogoutModal();
        return;
    }

    if (e.key === 'Tab') {
        const buttons = logoutModalEl.querySelectorAll('button');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
}

function openLogoutModal() {
    if (!logoutModalEl) logoutModalEl = buildLogoutModal();

    logoutPrevFocus = document.activeElement;
    logoutModalEl.classList.add('show');
    document.addEventListener('keydown', onLogoutKeydown);

    // Default focus on Cancel so a stray Enter press never logs anyone out.
    logoutModalEl.querySelector('[data-logout-cancel]').focus();
}

function closeLogoutModal() {
    if (!logoutModalEl) return;
    logoutModalEl.classList.remove('show');
    document.removeEventListener('keydown', onLogoutKeydown);
    if (logoutPrevFocus && typeof logoutPrevFocus.focus === 'function') {
        logoutPrevFocus.focus();
    }
}

function performLogout() {
    // Keep application data such as procurement_records —
    // only the session itself is cleared.
    clearSession();

    // replace() (not href) so the Back button can't return to a
    // protected page after logging out.
    window.location.replace('login.html');
}

// Wires every logout trigger on the page to the confirmation modal.
// Triggers: the sidebar .db-logout link, or any element with a
// data-logout attribute (used by the Logout button on profile.html).
function initLogoutLinks() {
    document.querySelectorAll('.db-logout, [data-logout]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            openLogoutModal();
        });
    });
}

// If a protected page is restored from the browser's back/forward cache
// after logging out, the head script (requireAuth) doesn't run again —
// re-check here so the old page can't be viewed while signed out.
window.addEventListener('pageshow', function (e) {
    const onLoginPage = /login(\.html)?$/i.test(window.location.pathname);
    if (e.persisted && !onLoginPage && !getSession()) {
        window.location.replace('login.html');
    }
});

document.addEventListener('DOMContentLoaded', function () {
    applySessionToSidebar();
    initLogoutLinks();
});