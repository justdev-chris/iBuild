// ─── APP.JS ──────────────────────────────────────────────────
// Main application logic. Glues everything together.

// ─── STATE ──────────────────────────────────────────────────
let currentUser = null;
let currentToken = null;

// ─── HELPERS ──────────────────────────────────────────────────
function showToast(msg, isWarning = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `toast${isWarning ? ' warning' : ''}`;
    el.textContent = msg;
    document.body.appendChild(el);

    setTimeout(() => {
        el.classList.add('hidden');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ─── UI HELPERS ──────────────────────────────────────────────────
function showDashboard(user) {
    document.getElementById('loginPrompt').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('loginBtnMain').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';

    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = '🐱 ' + (user?.login || 'logged in');
        userDisplay.style.display = 'inline-block';
    }
}

function showLoginPrompt() {
    document.getElementById('loginPrompt').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('loginBtnMain').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';

    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.style.display = 'none';
    }
}

// ─── DEVICE FLOW MODAL ──────────────────────────────────────────
function showDeviceFlowModal(userCode, verificationUri) {
    document.getElementById('userCode').textContent = userCode;
    document.getElementById('verificationUri').textContent = verificationUri;
    document.getElementById('verificationUri').href = verificationUri;
    document.getElementById('deviceStatus').textContent = '⏳ Waiting for authorization...';
    document.getElementById('deviceFlowModal').style.display = 'flex';
}

function closeDeviceFlowModal() {
    document.getElementById('deviceFlowModal').style.display = 'none';
}

function updateDeviceStatus(msg) {
    document.getElementById('deviceStatus').textContent = msg;
}

// ─── LOGIN / LOGOUT (wrapped to avoid undefined errors) ──────
function loginWithGitHub() {
    if (typeof window._loginWithGitHub === 'function') {
        window._loginWithGitHub();
    } else {
        console.error('loginWithGitHub not loaded');
        showToast('❌ GitHub module not loaded', true);
    }
}

function logout() {
    if (typeof window._logout === 'function') {
        window._logout();
    } else {
        console.error('logout not loaded');
        localStorage.removeItem('github_token');
        showLoginPrompt();
        showToast('👋 Logged out');
    }
}

function cancelDeviceFlow() {
    if (typeof window._cancelDeviceFlow === 'function') {
        window._cancelDeviceFlow();
    } else {
        closeDeviceFlowModal();
    }
}

// ─── LOAD USER INFO ──────────────────────────────────────────
async function loadUserInfo() {
    try {
        const token = localStorage.getItem('github_token');
        if (!token) {
            showLoginPrompt();
            return;
        }

        const res = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('github_token');
                showLoginPrompt();
                return;
            }
            throw new Error('Failed to fetch user info');
        }

        const user = await res.json();
        currentUser = user;
        currentToken = token;

        showDashboard(user);

        if (typeof loadProjects === 'function') {
            loadProjects();
        } else {
            console.error('loadProjects not loaded');
        }

    } catch (err) {
        console.error('Load user error:', err);
        showLoginPrompt();
        showToast('❌ Failed to load user info', true);
    }
}

// ─── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('🐱 iBuild Web — App initializing');

    // Show login prompt by default
    showLoginPrompt();

    // Check if already logged in
    const token = localStorage.getItem('github_token');
    if (token) {
        loadUserInfo();
    }

    // ─── EVENT BINDINGS ────────────────────────────────────
    document.getElementById('loginBtn')?.addEventListener('click', loginWithGitHub);
    document.getElementById('loginBtnMain')?.addEventListener('click', loginWithGitHub);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('cancelDeviceFlow')?.addEventListener('click', cancelDeviceFlow);

    // Close device flow modal on background click
    document.getElementById('deviceFlowModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            cancelDeviceFlow();
        }
    });

    // New Project button
    document.getElementById('newProjectBtn')?.addEventListener('click', () => {
        document.getElementById('newProjectModal').style.display = 'flex';
        document.getElementById('modalStatus').textContent = '';
    });

    document.getElementById('modalClose')?.addEventListener('click', () => {
        document.getElementById('newProjectModal').style.display = 'none';
        document.getElementById('modalStatus').textContent = '';
    });

    document.getElementById('newProjectModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('newProjectModal').style.display = 'none';
            document.getElementById('modalStatus').textContent = '';
        }
    });

    document.getElementById('newProjectForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('projectName')?.value.trim();
        const description = document.getElementById('projectDescription')?.value.trim();

        if (!name) {
            showToast('⚠️ Please enter a project name', true);
            return;
        }

        if (typeof createProject === 'function') {
            createProject(name, description);
        } else {
            console.error('createProject not loaded');
            showToast('❌ Projects module not loaded', true);
        }
    });
});

// ─── EXPOSE FOR OTHER MODULES ──────────────────────────────────
window.showToast = showToast;
window.showDashboard = showDashboard;
window.showLoginPrompt = showLoginPrompt;
window.loadUserInfo = loadUserInfo;
window.showDeviceFlowModal = showDeviceFlowModal;
window.closeDeviceFlowModal = closeDeviceFlowModal;
window.updateDeviceStatus = updateDeviceStatus;
window.loginWithGitHub = loginWithGitHub;
window.logout = logout;
window.cancelDeviceFlow = cancelDeviceFlow;
window.currentToken = currentToken;
window.currentUser = currentUser;