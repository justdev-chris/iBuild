// ─── GITHUB.JS ──────────────────────────────────────────────────
// GitHub Device Flow OAuth — Maximum Debugging

// ─── CONFIG ──────────────────────────────────────────────────────
const GITHUB_CLIENT_ID = 'Ov23liRwgQO7k9ys1ued';
const CORS_PROXY = 'https://corsproxy.io/?';

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
    debugLog('🚀 START DEVICE FLOW');
    debugLog('📋 Client ID:', GITHUB_CLIENT_ID);
    debugLog('🌐 Proxy:', CORS_PROXY);
    debugLog('📱 User Agent:', navigator.userAgent);
    debugLog('🌍 URL:', window.location.href);
    debugLog('🔒 HTTPS:', window.location.protocol === 'https:');

    try {
        // Check if Client ID is set
        if (!GITHUB_CLIENT_ID || GITHUB_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
            throw new Error('GitHub Client ID not set.');
        }

        // Build the request URL
        const url = CORS_PROXY + 'https://github.com/login/device/code';
        debugLog('📤 Request URL:', url);

        const body = JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            scope: 'repo workflow',
        });
        debugLog('📦 Request body:', body);

        debugLog('⏳ Sending fetch request...');
        const startTime = Date.now();

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: body,
        });

        const elapsed = Date.now() - startTime;
        debugLog(`⏱️ Request completed in ${elapsed}ms`);
        debugLog('📥 Response status:', res.status);
        debugLog('📥 Response status text:', res.statusText);
        debugLog('📥 Response headers:', [...res.headers.entries()]);

        if (!res.ok) {
            const text = await res.text();
            debugError('❌ HTTP error response body:', text);
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
        debugLog('📥 Response data:', data);
        debugLog('📥 Response keys:', Object.keys(data));

        if (data.error) {
            debugError('❌ GitHub API error:', data.error);
            throw new Error(data.error_description || data.error);
        }

        if (!data.device_code || !data.user_code || !data.verification_uri) {
            debugError('❌ Invalid response structure:', data);
            throw new Error('Invalid response from GitHub');
        }

        debugLog('✅ Device code received!');
        debugLog('🔑 User code:', data.user_code);
        debugLog('🔗 Verification URI:', data.verification_uri);
        debugLog('⏱️ Interval:', data.interval);
        debugLog('⏰ Expires in:', data.expires_in);

        // Show the modal
        if (typeof showDeviceFlowModal === 'function') {
            debugLog('📱 Showing modal via showDeviceFlowModal');
            showDeviceFlowModal(data.user_code, data.verification_uri);
        } else if (typeof window.showDeviceFlowModal === 'function') {
            debugLog('📱 Showing modal via window.showDeviceFlowModal');
            window.showDeviceFlowModal(data.user_code, data.verification_uri);
        } else {
            debugError('❌ showDeviceFlowModal is not defined!');
            // Fallback
            document.getElementById('userCode').textContent = data.user_code;
            document.getElementById('verificationUri').textContent = data.verification_uri;
            document.getElementById('verificationUri').href = data.verification_uri;
            document.getElementById('deviceStatus').textContent = '⏳ Waiting for authorization...';
            document.getElementById('deviceFlowModal').style.display = 'flex';
        }

        debugLog('🚀 Starting token polling...');
        pollForToken(data.device_code, data.interval);
        return data;

    } catch (err) {
        debugError('💥 DEVICE FLOW ERROR:');
        debugError('  Message:', err.message);
        debugError('  Name:', err.name);
        debugError('  Stack:', err.stack);
        debugError('  Type:', typeof err);
        debugError('  Keys:', Object.keys(err));
        debugError('  Full error:', err);

        // Try to show toast
        const errorMsg = err.message || 'Unknown error';
        if (typeof showToast === 'function') {
            showToast('❌ Login failed: ' + errorMsg, true);
        } else if (typeof window.showToast === 'function') {
            window.showToast('❌ Login failed: ' + errorMsg, true);
        } else {
            alert('Login failed: ' + errorMsg);
        }
        throw err;
    }
}

// ─── POLL FOR TOKEN ──────────────────────────────────────────
function pollForToken(deviceCode, interval) {
    debugLog('🔁 Starting token polling...');
    debugLog('  Device code:', deviceCode);
    debugLog('  Interval:', interval || 5);

    if (isPolling) {
        debugLog('⚠️ Already polling, skipping');
        return;
    }
    isPolling = true;

    const poll = async () => {
        debugLog('⏳ Polling for token...');
        try {
            const url = CORS_PROXY + 'https://github.com/login/oauth/access_token';
            const body = JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            });

            debugLog('📤 Poll URL:', url);
            debugLog('📦 Poll body:', body);

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: body,
            });

            debugLog('📥 Poll response status:', res.status);

            if (!res.ok) {
                const text = await res.text();
                debugError('❌ Poll HTTP error:', res.status, text);
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            const data = await res.json();
            debugLog('📥 Poll response data:', data);

            if (data.access_token) {
                debugLog('✅ ACCESS TOKEN RECEIVED!');
                debugLog('🔑 Token:', data.access_token.substring(0, 20) + '...');
                debugLog('🔑 Token type:', data.token_type);
                debugLog('🔑 Scope:', data.scope);

                githubToken = data.access_token;
                localStorage.setItem('github_token', githubToken);
                isPolling = false;

                if (typeof closeDeviceFlowModal === 'function') {
                    closeDeviceFlowModal();
                } else if (typeof window.closeDeviceFlowModal === 'function') {
                    window.closeDeviceFlowModal();
                }

                if (typeof onLoginSuccess === 'function') {
                    onLoginSuccess();
                } else if (typeof window.onLoginSuccess === 'function') {
                    window.onLoginSuccess();
                } else {
                    debugError('❌ onLoginSuccess is not defined!');
                }
                return;
            }

            if (data.error === 'authorization_pending') {
                debugLog('⏳ Waiting for user authorization...');
                deviceFlowInterval = setTimeout(poll, (interval || 5) * 1000);
                if (typeof updateDeviceStatus === 'function') {
                    updateDeviceStatus('⏳ Waiting for authorization...');
                } else if (typeof window.updateDeviceStatus === 'function') {
                    window.updateDeviceStatus('⏳ Waiting for authorization...');
                }
                return;
            }

            if (data.error === 'slow_down') {
                debugLog('⏳ Rate limited, slowing down...');
                const newInterval = (interval || 5) * 1000 + 5000;
                deviceFlowInterval = setTimeout(poll, newInterval);
                if (typeof updateDeviceStatus === 'function') {
                    updateDeviceStatus('⏳ Rate limited. Waiting...');
                } else if (typeof window.updateDeviceStatus === 'function') {
                    window.updateDeviceStatus('⏳ Rate limited. Waiting...');
                }
                return;
            }

            if (data.error === 'expired_token') {
                debugError('❌ Device code expired');
                throw new Error('Device code expired. Please try again.');
            }

            throw new Error(data.error_description || data.error || 'Unknown polling error');

        } catch (err) {
            debugError('💥 POLLING ERROR:');
            debugError('  Message:', err.message);
            debugError('  Stack:', err.stack);
            isPolling = false;

            if (typeof updateDeviceStatus === 'function') {
                updateDeviceStatus('❌ Error: ' + err.message);
            } else if (typeof window.updateDeviceStatus === 'function') {
                window.updateDeviceStatus('❌ Error: ' + err.message);
            }

            if (typeof showToast === 'function') {
                showToast('❌ Authentication failed: ' + err.message, true);
            } else if (typeof window.showToast === 'function') {
                window.showToast('❌ Authentication failed: ' + err.message, true);
            }

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
    debugLog('❌ Cancelling device flow');
    if (deviceFlowInterval) {
        clearTimeout(deviceFlowInterval);
        deviceFlowInterval = null;
    }
    isPolling = false;
    if (typeof closeDeviceFlowModal === 'function') {
        closeDeviceFlowModal();
    } else if (typeof window.closeDeviceFlowModal === 'function') {
        window.closeDeviceFlowModal();
    }
    if (typeof showToast === 'function') {
        showToast('👋 Cancelled login');
    } else if (typeof window.showToast === 'function') {
        window.showToast('👋 Cancelled login');
    }
}

// ─── LOGIN ──────────────────────────────────────────────────────
function loginWithGitHub() {
    debugLog('🔑 loginWithGitHub() called');
    const token = localStorage.getItem('github_token');
    if (token) {
        debugLog('🔑 Token found in localStorage, using it');
        githubToken = token;
        if (typeof onLoginSuccess === 'function') {
            onLoginSuccess();
        } else if (typeof window.onLoginSuccess === 'function') {
            window.onLoginSuccess();
        }
        return;
    }
    debugLog('🔑 No token found, starting device flow');
    startDeviceFlow();
}

// ─── LOGOUT ──────────────────────────────────────────────────────
function logout() {
    debugLog('🚪 Logging out');
    githubToken = null;
    localStorage.removeItem('github_token');
    if (typeof onLogout === 'function') {
        onLogout();
    } else if (typeof window.onLogout === 'function') {
        window.onLogout();
    }
}

// ─── GET TOKEN ──────────────────────────────────────────────────
function getGitHubToken() {
    if (githubToken) {
        debugLog('🔑 Token from memory');
        return githubToken;
    }
    const token = localStorage.getItem('github_token');
    if (token) {
        debugLog('🔑 Token from localStorage');
        githubToken = token;
        return token;
    }
    debugLog('🔑 No token found');
    return null;
}

// ─── API HELPER ──────────────────────────────────────────────────
async function githubFetch(url, options = {}) {
    const token = getGitHubToken();
    if (!token) {
        debugError('❌ No token available for API call:', url);
        throw new Error('Not authenticated');
    }

    const headers = {
        'Accept': 'application/json',
        'Authorization': `token ${token}`,
        ...options.headers,
    };

    debugLog('📤 API call:', url);
    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        debugError('❌ Token expired or invalid');
        logout();
        throw new Error('Session expired. Please login again.');
    }

    if (!res.ok) {
        const text = await res.text();
        debugError('❌ API error:', res.status, text);
        throw new Error(`API error ${res.status}: ${text}`);
    }

    return res;
}

// ─── UI HELPERS (use global functions from app.js) ──────────
function showDeviceFlowModal(userCode, verificationUri) {
    debugLog('📱 showDeviceFlowModal called');
    debugLog('  userCode:', userCode);
    debugLog('  verificationUri:', verificationUri);

    if (typeof window.showDeviceFlowModal === 'function') {
        debugLog('📱 Using window.showDeviceFlowModal');
        window.showDeviceFlowModal(userCode, verificationUri);
    } else {
        debugLog('📱 Using fallback DOM');
        const userCodeEl = document.getElementById('userCode');
        const verificationUriEl = document.getElementById('verificationUri');
        const deviceStatus = document.getElementById('deviceStatus');
        const modal = document.getElementById('deviceFlowModal');

        if (userCodeEl) userCodeEl.textContent = userCode;
        if (verificationUriEl) {
            verificationUriEl.textContent = verificationUri;
            verificationUriEl.href = verificationUri;
        }
        if (deviceStatus) deviceStatus.textContent = '⏳ Waiting for authorization...';
        if (modal) modal.style.display = 'flex';
    }
}

function closeDeviceFlowModal() {
    debugLog('📱 closeDeviceFlowModal called');
    if (typeof window.closeDeviceFlowModal === 'function') {
        window.closeDeviceFlowModal();
    } else {
        const modal = document.getElementById('deviceFlowModal');
        if (modal) modal.style.display = 'none';
    }
}

function updateDeviceStatus(msg) {
    debugLog('📱 updateDeviceStatus:', msg);
    if (typeof window.updateDeviceStatus === 'function') {
        window.updateDeviceStatus(msg);
    } else {
        const deviceStatus = document.getElementById('deviceStatus');
        if (deviceStatus) deviceStatus.textContent = msg;
    }
}

function onLoginSuccess() {
    debugLog('✅ onLoginSuccess called');
    closeDeviceFlowModal();

    // Fetch user info
    debugLog('📤 Fetching user info...');
    githubFetch('https://api.github.com/user')
        .then(res => res.json())
        .then(user => {
            debugLog('✅ User info received:', user.login);
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) {
                userDisplay.textContent = '🐱 ' + user.login;
                userDisplay.style.display = 'inline-block';
            }
            // Show dashboard
            if (typeof window.showDashboard === 'function') {
                window.showDashboard(user);
            }
            // Load projects
            if (typeof loadProjects === 'function') {
                debugLog('📤 Loading projects...');
                loadProjects();
            }
        })
        .catch(err => {
            debugError('❌ Failed to fetch user info:', err);
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) {
                userDisplay.textContent = '🐱 logged in';
                userDisplay.style.display = 'inline-block';
            }
        });

    if (typeof showToast === 'function') {
        showToast('✅ Logged in successfully!');
    } else if (typeof window.showToast === 'function') {
        window.showToast('✅ Logged in successfully!');
    }
}

function onLogout() {
    debugLog('👋 onLogout called');
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
    if (typeof showToast === 'function') {
        showToast('👋 Logged out');
    } else if (typeof window.showToast === 'function') {
        window.showToast('👋 Logged out');
    }
}

// ─── EXPOSE GLOBALLY ──────────────────────────────────────────
debugLog('📦 Exposing globals...');
window._loginWithGitHub = loginWithGitHub;
window._logout = logout;
window._cancelDeviceFlow = cancelDeviceFlow;
window._getGitHubToken = getGitHubToken;
window._startDeviceFlow = startDeviceFlow;
window._onLoginSuccess = onLoginSuccess;
window._onLogout = onLogout;

debugLog('✅ github.js loaded and exposed');
console.log('✅ github.js loaded and exposed');