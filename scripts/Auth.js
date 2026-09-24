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

// Wires every .db-logout link on the page to confirm, clear the
// session, and send the user back to the login screen.
function initLogoutLinks() {
    document.querySelectorAll('.db-logout').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            if (!confirm('Are you sure you want to logout?')) return;

            // Keep application data such as procurement_records —
            // only the session itself is cleared.
            clearSession();
            window.location.href = 'login.html';
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    applySessionToSidebar();
    initLogoutLinks();
});