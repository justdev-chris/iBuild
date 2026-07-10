// ─── APP.JS ──────────────────────────────────────────────────
// Main application logic. Glues everything together.

// ─── STATE ──────────────────────────────────────────────────
let currentUser = null;
let currentToken = null;

// ─── UI HELPERS ──────────────────────────────────────────────────
function showDashboard(user) {
    const loginPrompt = document.getElementById('loginPrompt');
    const dashboard = document.getElementById('dashboard');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnMain = document.getElementById('loginBtnMain');
    const logoutBtn = document.getElementById('logoutBtn');
    const userDisplay = document.getElementById('userDisplay');

    if (loginPrompt) loginPrompt.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';
    if (loginBtnMain) loginBtnMain.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (userDisplay) {
        userDisplay.textContent = '🐱 ' + (user?.login || 'logged in');
        userDisplay.style.display = 'inline-block';
    }
}

function showLoginPrompt() {
    const loginPrompt = document.getElementById('loginPrompt');
    const dashboard = document.getElementById('dashboard');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnMain = document.getElementById('loginBtnMain');
    const logoutBtn = document.getElementById('logoutBtn');
    const userDisplay = document.getElementById('userDisplay');

    if (loginPrompt) loginPrompt.style.display = 'block';
    if (dashboard) dashboard.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (loginBtnMain) loginBtnMain.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userDisplay) userDisplay.style.display = 'none';
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
            console.warn('loadProjects not loaded');
        }

    } catch (err) {
        console.error('Load user error:', err);
        showLoginPrompt();
        showToast('❌ Failed to load user info', true);
    }
}

// ─── LOGIN / LOGOUT WRAPPERS ──────────────────────────────────
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
        localStorage.removeItem('github_token');
        showLoginPrompt();
        showToast('👋 Logged out');
    }
}

// ─── EXPOSE FUNCTIONS GLOBALLY ──────────────────────────────
window.showDashboard = showDashboard;
window.showLoginPrompt = showLoginPrompt;
window.loadUserInfo = loadUserInfo;
window.loginWithGitHub = loginWithGitHub;
window.logout = logout;
window.currentToken = currentToken;
window.currentUser = currentUser;

// ─── ON LOGIN SUCCESS HANDLER ──────────────────────────────────
window.onLoginSuccess = function(user) {
    console.log('✅ onLoginSuccess called with user:', user);
    currentUser = user;
    showDashboard(user);
    if (typeof loadProjects === 'function') {
        loadProjects();
    }
};

window.onLogout = function() {
    console.log('👋 onLogout called');
    currentUser = null;
    currentToken = null;
    showLoginPrompt();
};

// ─── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    console.log('🐱 iBuild Web — App initializing');

    const token = localStorage.getItem('github_token');
    if (token) {
        loadUserInfo();
    } else {
        showLoginPrompt();
    }

    // ─── EVENT BINDINGS ────────────────────────────────────
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnMain = document.getElementById('loginBtnMain');
    const logoutBtn = document.getElementById('logoutBtn');
    const newProjectBtn = document.getElementById('newProjectBtn');
    const modalClose = document.getElementById('modalClose');
    const newProjectForm = document.getElementById('newProjectForm');

    if (loginBtn) loginBtn.addEventListener('click', loginWithGitHub);
    if (loginBtnMain) loginBtnMain.addEventListener('click', loginWithGitHub);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // New Project
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', function() {
            const modal = document.getElementById('newProjectModal');
            const status = document.getElementById('modalStatus');
            if (modal) modal.style.display = 'flex';
            if (status) status.textContent = '';
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', function() {
            const modal = document.getElementById('newProjectModal');
            const status = document.getElementById('modalStatus');
            if (modal) modal.style.display = 'none';
            if (status) status.textContent = '';
        });
    }

    const newProjectModal = document.getElementById('newProjectModal');
    if (newProjectModal) {
        newProjectModal.addEventListener('click', function(e) {
            if (e.target === e.currentTarget) {
                const status = document.getElementById('modalStatus');
                if (newProjectModal) newProjectModal.style.display = 'none';
                if (status) status.textContent = '';
            }
        });
    }

    if (newProjectForm) {
        newProjectForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const nameInput = document.getElementById('projectName');
            const descInput = document.getElementById('projectDescription');
            const name = nameInput ? nameInput.value.trim() : '';
            const description = descInput ? descInput.value.trim() : '';

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
    }
});

console.log('✅ app.js loaded');