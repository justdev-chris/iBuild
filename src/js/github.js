// ─── GITHUB.JS ──────────────────────────────────────────────────
// GitHub Device Flow OAuth — Full debugging

// ─── CONFIG ──────────────────────────────────────────────────────
const GITHUB_CLIENT_ID = 'Ov23liRwgQO7k9ys1ued'; // ⚠️ REPLACE THIS IF FORKING

// ─── STATE ──────────────────────────────────────────────────────
let githubToken = null;
let deviceFlowInterval = null;
let isPolling = false;

// ─── LOGGING ────────────────────────────────────────────────────
function debugLog(...args) {
    console.log('🔍 [GitHub]', ...args);
}

function debugError(...args) {
    console.error('❌ [GitHub]', ...args);
}

// ─── DEVICE FLOW ──────────────────────────────────────────────
async function startDeviceFlow() {
    debugLog('Starting device flow...');
    debugLog('Client ID:', GITHUB_CLIENT_ID);

    try {
        if (!GITHUB_CLIENT_ID || GITHUB_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
            throw new Error('GitHub Client ID not set. Please set GITHUB_CLIENT_ID in github.js');
        }

        debugLog('Sending request to GitHub...');
        const res = await fetch('https://github.com/login/device/code', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                scope: 'repo workflow',
            }),
        });

        debugLog('Response status:', res.status);

        if (!res.ok) {
            const text = await res.text();
            debugError('HTTP error:', res.status, text);
            let errMsg;
            try {
                const json = JSON.parse(text);
                errMsg = json.error_description || json.error || text;
            } catch {
                errMsg = text || 'Unknown error';
            }
            throw new Error(`HTTP ${res.status}: ${errMsg}`);
        }

        const data = await res.json();
        debugLog('Device flow response:', data);

        if (data.error) {
            throw new Error(data.error_description || data.error);
        }

        if (!data.device_code || !data.user_code || !data.verification_uri) {
            debugError('Invalid response from GitHub:', data);
            throw new Error('Invalid response from GitHub');
        }

        debugLog('✅ Device code received:', data.user_code);
        showDeviceFlowModal(data.user_code, data.verification_uri);
        pollForToken(data.device_code, data.interval);
        return data;

    } catch (err) {
        debugError('Device flow error:', err);
        showToast('❌ Login failed: ' + err.message, true);
        throw err;
    }
}

// ─── POLL FOR TOKEN ──────────────────────────────────────────
function pollForToken(deviceCode, interval) {
    debugLog('Starting token polling...');
    if (isPolling) {
        debugLog('Already polling, skipping');
        return;
    }
    isPolling = true;
    debugLog('Polling interval:', interval || 5, 'seconds');

    const poll = async () => {
        debugLog('Polling for token...');
        try {
            const res = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: GITHUB_CLIENT_ID,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                }),
            });

            debugLog('Token response status:', res.status);

            if (!res.ok) {
                const text = await res.text();
                debugError('Token HTTP error:', res.status, text);
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            const data = await res.json();
            debugLog('Token response:', data);

            if (data.access_token) {
                debugLog('✅ Access token received!');
                githubToken = data.access_token;
                localStorage.setItem('github_token', githubToken);
                isPolling = false;
                closeDeviceFlowModal();
                onLoginSuccess();
                return;
            }

            if (data.error === 'authorization_pending') {
                debugLog('⏳ Waiting for user authorization...');
                deviceFlowInterval = setTimeout(poll, (interval || 5) * 1000);
                updateDeviceStatus('⏳ Waiting for authorization...');
                return;
            }

            if (data.error === 'slow_down') {
                debugLog('⏳ Rate limited, slowing down...');
                deviceFlowInterval = setTimeout(poll, (interval || 5) * 1000 + 5000);
                updateDeviceStatus('⏳ Rate limited. Waiting...');
                return;
            }

            if (data.error === 'expired_token') {
                debugLog('❌ Device code expired');
                throw new Error('Device code expired. Please try again.');
            }

            throw new Error(data.error_description || data.error || 'Unknown polling error');

        } catch (err) {
            debugError('Polling error:', err);
            isPolling = false;
            updateDeviceStatus('❌ Error: ' + err.message);
            showToast('❌ Authentication failed: ' + err.message, true);
            if (deviceFlowInterval) {
                clearTimeout(deviceFlowInterval);
                deviceFlowInterval = null;
            }
        }
    };

    poll();
}

// ─── CANCEL DEVICE FLOW ──────────────────────────────────────
function cancelDeviceFlow() {
    debugLog('Cancelling device flow');
    if (deviceFlowInterval) {
        clearTimeout(deviceFlowInterval);
        deviceFlowInterval = null;
    }
    isPolling = false;
    closeDeviceFlowModal();
    showToast('👋 Cancelled login');
}

// ─── LOGIN ──────────────────────────────────────────────────────
function loginWithGitHub() {
    debugLog('loginWithGitHub() called');
    const token = localStorage.getItem('github_token');
    if (token) {
        debugLog('Token found in localStorage');
        githubToken = token;
        onLoginSuccess();
        return;
    }
    debugLog('No token found, starting device flow');
    startDeviceFlow();
}

// ─── LOGOUT ──────────────────────────────────────────────────────
function logout() {
    debugLog('Logging out');
    githubToken = null;
    localStorage.removeItem('github_token');
    onLogout();
}

// ─── GET TOKEN ──────────────────────────────────────────────────
function getGitHubToken() {
    if (githubToken) {
        debugLog('Token from memory');
        return githubToken;
    }
    const token = localStorage.getItem('github_token');
    if (token) {
        debugLog('Token from localStorage');
        githubToken = token;
        return token;
    }
    debugLog('No token found');
    return null;
}

// ─── API HELPER ──────────────────────────────────────────────────
async function githubFetch(url, options = {}) {
    const token = getGitHubToken();
    if (!token) {
        debugError('No token available for API call:', url);
        throw new Error('Not authenticated');
    }

    const headers = {
        'Accept': 'application/json',
        'Authorization': `token ${token}`,
        ...options.headers,
    };

    debugLog('API call:', url);
    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        debugError('Token expired or invalid');
        logout();
        throw new Error('Session expired. Please login again.');
    }

    if (!res.ok) {
        const text = await res.text();
        debugError('API error:', res.status, text);
        throw new Error(`API error ${res.status}: ${text}`);
    }

    return res;
}

// ─── UI HELPERS ──────────────────────────────────────────────────
function showDeviceFlowModal(userCode, verificationUri) {
    debugLog('Showing device flow modal');
    document.getElementById('userCode').textContent = userCode;
    document.getElementById('verificationUri').textContent = verificationUri;
    document.getElementById('verificationUri').href = verificationUri;
    document.getElementById('deviceStatus').textContent = '⏳ Waiting for authorization...';
    document.getElementById('deviceFlowModal').style.display = 'flex';
}

function closeDeviceFlowModal() {
    debugLog('Closing device flow modal');
    document.getElementById('deviceFlowModal').style.display = 'none';
    if (deviceFlowInterval) {
        clearTimeout(deviceFlowInterval);
        deviceFlowInterval = null;
    }
    isPolling = false;
}

function updateDeviceStatus(msg) {
    document.getElementById('deviceStatus').textContent = msg;
}

function onLoginSuccess() {
    debugLog('Login success');
    closeDeviceFlowModal();
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('loginBtnMain').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    document.getElementById('loginPrompt').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Fetch user info
    githubFetch('https://api.github.com/user')
        .then(res => res.json())
        .then(user => {
            debugLog('User info:', user.login);
            document.getElementById('userDisplay').textContent = '🐱 ' + user.login;
            document.getElementById('userDisplay').style.display = 'inline-block';
        })
        .catch(err => {
            debugError('Failed to fetch user info:', err);
            document.getElementById('userDisplay').textContent = '🐱 logged in';
            document.getElementById('userDisplay').style.display = 'inline-block';
        });

    if (typeof loadProjects === 'function') {
        debugLog('Loading projects...');
        loadProjects();
    } else {
        debugLog('loadProjects not defined');
    }

    showToast('✅ Logged in successfully!');
}

function onLogout() {
    debugLog('Logout');
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('loginBtnMain').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('userDisplay').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loginPrompt').style.display = 'block';
    showToast('👋 Logged out');
}

// ─── TOAST ──────────────────────────────────────────────────────
let toastTimeout = null;

function showToast(msg, isWarning = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `toast${isWarning ? ' warning' : ''}`;
    el.textContent = msg;
    document.body.appendChild(el);

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        el.classList.add('hidden');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ─── WINDOW EXPOSURE (for debugging) ──────────────────────────
window.debugGitHub = {
    login: loginWithGitHub,
    logout: logout,
    getToken: getGitHubToken,
    startDeviceFlow: startDeviceFlow,
    cancelDeviceFlow: cancelDeviceFlow,
    state: () => ({
        token: githubToken,
        isPolling: isPolling,
        clientId: GITHUB_CLIENT_ID,
    }),
};

// ─── EVENT BINDING ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM loaded, binding events');

    document.getElementById('loginBtn')?.addEventListener('click', loginWithGitHub);
    document.getElementById('loginBtnMain')?.addEventListener('click', loginWithGitHub);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('cancelDeviceFlow')?.addEventListener('click', cancelDeviceFlow);

    // Auto-login if token exists
    const token = localStorage.getItem('github_token');
    if (token) {
        debugLog('Auto-login with existing token');
        githubToken = token;
        onLoginSuccess();
    } else {
        debugLog('No token found, showing login prompt');
    }
});