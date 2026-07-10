// ─── GITHUB.JS ──────────────────────────────────────────────────
// GitHub PAT-based auth 

let githubToken = null;

// ─── LOGIN WITH PAT ─────────────────────────────────────────────
function loginWithGitHub() {
    const token = prompt('Enter your GitHub Personal Access Token:\n\n(Requires repo and workflow scopes)');
    if (!token) return;

    // Show loading state
    showToast('⏳ Validating token...');

    fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            if (res.status === 401) throw new Error('Invalid token');
            if (res.status === 403) throw new Error('Token lacks required scopes (repo, workflow)');
            throw new Error('Failed to validate token');
        }
        return res.json();
    })
    .then(user => {
        githubToken = token;
        localStorage.setItem('github_token', token);
        showToast('✅ Logged in as ' + user.login);

        // Update UI directly
        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) {
            userDisplay.textContent = '🐱 ' + user.login;
            userDisplay.style.display = 'inline-block';
        }

        const loginBtn = document.getElementById('loginBtn');
        const loginBtnMain = document.getElementById('loginBtnMain');
        const logoutBtn = document.getElementById('logoutBtn');
        const loginPrompt = document.getElementById('loginPrompt');
        const dashboard = document.getElementById('dashboard');

        if (loginBtn) loginBtn.style.display = 'none';
        if (loginBtnMain) loginBtnMain.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (loginPrompt) loginPrompt.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';

        // Load projects
        if (typeof loadProjects === 'function') {
            loadProjects();
        } else {
            console.warn('loadProjects not loaded');
        }

        // Call global handler if it exists
        if (typeof window.onLoginSuccess === 'function') {
            window.onLoginSuccess(user);
        }
    })
    .catch(err => {
        showToast('❌ ' + err.message, true);
    });
}

// ─── LOGOUT ──────────────────────────────────────────────────────
function logout() {
    githubToken = null;
    localStorage.removeItem('github_token');

    const loginBtn = document.getElementById('loginBtn');
    const loginBtnMain = document.getElementById('loginBtnMain');
    const logoutBtn = document.getElementById('logoutBtn');
    const userDisplay = document.getElementById('userDisplay');
    const loginPrompt = document.getElementById('loginPrompt');
    const dashboard = document.getElementById('dashboard');

    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (loginBtnMain) loginBtnMain.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userDisplay) userDisplay.style.display = 'none';
    if (loginPrompt) loginPrompt.style.display = 'block';
    if (dashboard) dashboard.style.display = 'none';

    showToast('👋 Logged out');

    if (typeof window.onLogout === 'function') {
        window.onLogout();
    }
}

// ─── GET TOKEN ──────────────────────────────────────────────────
function getGitHubToken() {
    if (githubToken) return githubToken;
    const token = localStorage.getItem('github_token');
    if (token) {
        githubToken = token;
        return token;
    }
    return null;
}

// ─── API HELPER ──────────────────────────────────────────────────
async function githubFetch(url, options = {}) {
    const token = getGitHubToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const headers = {
        'Accept': 'application/json',
        'Authorization': `token ${token}`,
        ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please login again.');
    }

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }

    return res;
}

// ─── EXPOSE GLOBALLY ──────────────────────────────────────────
window._loginWithGitHub = loginWithGitHub;
window._logout = logout;
window._getGitHubToken = getGitHubToken;
window.githubFetch = githubFetch;

console.log('✅ github.js (PAT version) loaded');