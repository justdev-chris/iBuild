// ─── APP.JS ──────────────────────────────────────────────────
// Main application logic. Glues everything together.

// ─── STATE ──────────────────────────────────────────────────
let currentUser = null;
let currentToken = null;

// ─── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const token = localStorage.getItem('github_token');
    if (token) {
        currentToken = token;
        loadUserInfo();
    } else {
        showLoginPrompt();
    }

    // ─── EVENT BINDINGS ──────────────────────────────────
    // Login buttons
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        if (typeof loginWithGitHub === 'function') {
            loginWithGitHub();
        } else {
            console.error('loginWithGitHub not loaded');
            showToast('❌ GitHub module not loaded', true);
        }
    });

    document.getElementById('loginBtnMain')?.addEventListener('click', () => {
        if (typeof loginWithGitHub === 'function') {
            loginWithGitHub();
        } else {
            console.error('loginWithGitHub not loaded');
            showToast('❌ GitHub module not loaded', true);
        }
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (typeof logout === 'function') {
            logout();
        } else {
            console.error('logout not loaded');
        }
    });

    // ─── DEVICE FLOW ──────────────────────────────────
    document.getElementById('cancelDeviceFlow')?.addEventListener('click', () => {
        if (typeof cancelDeviceFlow === 'function') {
            cancelDeviceFlow();
        } else {
            console.error('cancelDeviceFlow not loaded');
            closeDeviceFlowModal();
        }
    });

    // Close device flow modal on background click
    document.getElementById('deviceFlowModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            if (typeof cancelDeviceFlow === 'function') {
                cancelDeviceFlow();
            } else {
                closeDeviceFlowModal();
            }
        }
    });

    // ─── NEW PROJECT MODAL ──────────────────────────────────
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

// ─── USER INFO ──────────────────────────────────────────────────
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

        // Load projects
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

// ─── EXPOSE FOR OTHER MODULES ──────────────────────────────────
window.showDeviceFlowModal = showDeviceFlowModal;
window.closeDeviceFlowModal = closeDeviceFlowModal;
window.updateDeviceStatus = updateDeviceStatus;
window.showDashboard = showDashboard;
window.showLoginPrompt = showLoginPrompt;
window.loadUserInfo = loadUserInfo;
window.currentToken = currentToken;
window.currentUser = currentUser;