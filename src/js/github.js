// ─── GITHUB.JS ──────────────────────────────────────────────────
// GitHub PAT-based auth — No OAuth, no CORS, no backend, no Client ID

let githubToken = null;

// ─── LOGIN WITH PAT ─────────────────────────────────────────────
function loginWithGitHub() {
    const token = prompt('Enter your GitHub Personal Access Token:\n\n(Requires repo and workflow scopes)');
    if (!token) return;

    fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
    })
    .then(user => {
        githubToken = token;
        localStorage.setItem('github_token', token);
        showToast('✅ Logged in as ' + user.login);
        onLoginSuccess();
    })
    .catch(err => {
        showToast('❌ Invalid token: ' + err.message, true);
    });
}

function logout() {
    githubToken = null;
    localStorage.removeItem('github_token');
    onLogout();
}

function getGitHubToken() {
    if (githubToken) return githubToken;
    const token = localStorage.getItem('github_token');
    if (token) {
        githubToken = token;
        return token;
    }
    return null;
}

async function githubFetch(url, options = {}) {
    const token = getGitHubToken();
    if (!token) throw new Error('Not authenticated');

    const headers = {
        'Accept': 'application/json',
        'Authorization': `token ${token}`,
        ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    return res;
}

// ─── EXPOSE ──────────────────────────────────────────────────────
window._loginWithGitHub = loginWithGitHub;
window._logout = logout;
window._getGitHubToken = getGitHubToken;

console.log('✅ github.js (PAT version) loaded');