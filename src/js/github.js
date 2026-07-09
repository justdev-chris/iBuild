// ─── GitHub Device Flow OAuth ──────────────────────────────
// No backend. No secrets. Just frontend.

const GITHUB_CLIENT_ID = 'Ov23liRwgQO7k9ys1ued'; // <-- Replace with your OAuth App client_id

// ─── STATE ──────────────────────────────────────────────────
let githubToken = null;
let deviceFlowInterval = null;
let isPolling = false;

// ─── DEVICE FLOW ──────────────────────────────────────────────
async function startDeviceFlow() {
    try {
        // 1. Request device and user codes
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

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error_description || 'Failed to start device flow');
        }

        const data = await res.json();
        // data = { device_code, user_code, verification_uri, interval, expires_in }

        // 2. Show the modal with user code
        showDeviceFlowModal(data.user_code, data.verification_uri);

        // 3. Start polling for token
        pollForToken(data.device_code, data.interval);

        return data;
    } catch (err) {
        console.error('Device flow error:', err);
        showToast('❌ ' + err.message, true);
        throw err;
    }
}

// ─── POLL FOR TOKEN ──────────────────────────────────────────
function pollForToken(deviceCode, interval) {
    if (isPolling) return;
    isPolling = true;

    const poll = async () => {
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

            const data = await res.json();

            if (data.access_token) {
                // ✅ Success!
                githubToken = data.access_token;
                localStorage.setItem('github_token', githubToken);
                isPolling = false;
                closeDeviceFlowModal();
                onLoginSuccess();
                return;
            }

            if (data.error === 'authorization_pending') {
                // Keep waiting
                deviceFlowInterval = setTimeout(poll, (interval || 5) * 1000);
                updateDeviceStatus('⏳ Waiting for authorization...');
                return;
            }

            if (data.error === 'slow_down') {
                // Increase interval
                deviceFlowInterval = setTimeout(poll, (interval || 5) * 1000 + 5000);
                updateDeviceStatus('⏳ Rate limited. Waiting...');
                return;
            }

            // Other errors
            throw new Error(data.error_description || data.error || 'Unknown error');
        } catch (err) {
            console.error('Polling error:', err);
            isPolling = false;
            updateDeviceStatus('❌ Error: ' + err.message);
            showToast('❌ Authentication failed', true);
        }
    };

    poll();
}

// ─── CANCEL DEVICE FLOW ──────────────────────────────────────
function cancelDeviceFlow() {
    if (deviceFlowInterval) {
        clearTimeout(deviceFlowInterval);
        deviceFlowInterval = null;
    }
    isPolling = false;
    closeDeviceFlowModal();
}

// ─── LOGIN ──────────────────────────────────────────────────
function loginWithGitHub() {
    // Check if token already exists
    const token = localStorage.getItem('github_token');
    if (token) {
        githubToken = token;
        onLoginSuccess();
        return;
    }
    startDeviceFlow();
}

// ─── LOGOUT ──────────────────────────────────────────────────
function logout() {
    githubToken = null;
    localStorage.removeItem('github_token');
    onLogout();
}

// ─── GET TOKEN ──────────────────────────────────────────────
function getGitHubToken() {
    if (!githubToken) {
        const token = localStorage.getItem('github_token');
        if (token) {
            githubToken = token;
            return token;
        }
        return null;
    }
    return githubToken;
}

// ─── API HELPER ──────────────────────────────────────────────
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
        // Token expired or invalid
        logout();
        throw new Error('Session expired. Please login again.');
    }

    return res;
}

// ─── UI HELPERS ──────────────────────────────────────────────
function showDeviceFlowModal(userCode, verificationUri) {
    document.getElementById('userCode').textContent = userCode;
    document.getElementById('verificationUri').textContent = verificationUri;
    document.getElementById('verificationUri').href = verificationUri;
    document.getElementById('deviceStatus').textContent = '⏳ Waiting for authorization...';
    document.getElementById('deviceFlowModal').style.display = 'flex';
}

function closeDeviceFlowModal() {
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
            document.getElementById('userDisplay').textContent = '🐱 ' + user.login;
            document.getElementById('userDisplay').style.display = 'inline-block';
        })
        .catch(() => {
            document.getElementById('userDisplay').textContent = '🐱 logged in';
            document.getElementById('userDisplay').style.display = 'inline-block';
        });

    // Load projects
    if (typeof loadProjects === 'function') {
        loadProjects();
    }

    showToast('✅ Logged in successfully!');
}

function onLogout() {
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('loginBtnMain').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('userDisplay').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loginPrompt').style.display = 'block';
    showToast('👋 Logged out');
}

// ─── TOAST ──────────────────────────────────────────────────
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

// ─── EVENT BINDING ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Login buttons
    document.getElementById('loginBtn').addEventListener('click', loginWithGitHub);
    document.getElementById('loginBtnMain').addEventListener('click', loginWithGitHub);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Cancel device flow
    document.getElementById('cancelDeviceFlow').addEventListener('click', cancelDeviceFlow);

    // Auto-login if token exists
    const token = localStorage.getItem('github_token');
    if (token) {
        githubToken = token;
        onLoginSuccess();
    }
});