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

// Builds the logout confirmation modal once and appends it to <body>,
// reusing the same .db-modal-overlay / .db-modal classes as the app's
// existing delete-confirmation modal (see index.html #confirmModalOverlay)
// so it matches the rest of the UI without needing markup on every page.
function ensureLogoutModal() {
    if (document.getElementById('logoutModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'logoutModalOverlay';
    overlay.className = 'db-modal-overlay hidden';
    overlay.style.zIndex = '2000';
    overlay.innerHTML = `
        <div class="db-modal" style="max-width: 380px; text-align: center; padding: 40px 30px;">
            <div style="background: var(--db-accent-soft, rgba(59,130,246,0.14)); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--db-accent, #3B82F6)" stroke-width="1.7">
                    <path d="M9 20H5.6C5 20 4.5 19.5 4.5 18.9V5.1C4.5 4.5 5 4 5.6 4H9" stroke-linecap="round"/>
                    <path d="M15.5 16L19.5 12L15.5 8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M19.2 12H10" stroke-linecap="round"/>
                </svg>
            </div>
            <h3 style="font-size: 18px; margin-bottom: 10px; color: var(--db-text, #E7EAF3);">Log out?</h3>
            <p style="color: var(--db-text-dim, #8B94A8); font-size: 14px; margin-bottom: 30px; line-height: 1.5;">
                You'll need to sign in again to access your PPMPs and entries.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button type="button" class="back-btn" id="logoutCancelBtn" style="flex: 1;">Cancel</button>
                <button type="button" class="next-btn" id="logoutConfirmBtn" style="flex: 1; background: var(--db-accent, #3B82F6);">Log Out</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('logoutCancelBtn').addEventListener('click', closeLogoutModal);
    document.getElementById('logoutConfirmBtn').addEventListener('click', function () {
        // Keep application data such as procurement_records —
        // only the session itself is cleared.
        clearSession();
        window.location.href = 'login.html';
    });
}

function openLogoutModal() {
    ensureLogoutModal();
    document.getElementById('logoutModalOverlay').classList.remove('hidden');
}

function closeLogoutModal() {
    const overlay = document.getElementById('logoutModalOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// Wires every .db-logout link on the page to open the modal above
// instead of a browser confirm() popup.
function initLogoutLinks() {
    document.querySelectorAll('.db-logout').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            openLogoutModal();
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    applySessionToSidebar();
    initLogoutLinks();
});