const GITHUB_CLIENT_ID = 'Ov23liRwgQO7k9ys1ued';
const CORS_PROXY = 'https://corsproxy.io/?';

async function startDeviceFlow() {
    try {
        const res = await fetch(CORS_PROXY + 'https://github.com/login/device/code', {
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

        if (!res.ok) throw new Error('Failed to get device code');
        const data = await res.json();
        
        showDeviceFlowModal(data.user_code, data.verification_uri);
        pollForToken(data.device_code, data.interval);
    } catch (err) {
        console.error('Device flow error:', err);
        showToast('❌ Login failed: ' + err.message, true);
    }
}

async function pollForToken(deviceCode, interval) {
    const poll = async () => {
        try {
            const res = await fetch(CORS_PROXY + 'https://github.com/login/oauth/access_token', {
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
                githubToken = data.access_token;
                localStorage.setItem('github_token', githubToken);
                closeDeviceFlowModal();
                onLoginSuccess();
                return;
            }

            if (data.error === 'authorization_pending') {
                setTimeout(poll, (interval || 5) * 1000);
                updateDeviceStatus('⏳ Waiting for authorization...');
                return;
            }

            throw new Error(data.error_description || data.error || 'Unknown error');
        } catch (err) {
            console.error('Polling error:', err);
            updateDeviceStatus('❌ Error: ' + err.message);
        }
    };
    poll();
}