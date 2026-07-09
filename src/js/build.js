// ─── BUILD.JS ──────────────────────────────────────────────────
// Build and download functions for iBuild Web

// ─── BUILD PROJECT ──────────────────────────────────────────────
async function buildProject(repoName) {
    const token = localStorage.getItem('github_token');
    if (!token) {
        showToast('❌ Please login first', true);
        return;
    }

    try {
        const user = await getUserInfo(token);
        const owner = user.login;

        showToast('🔨 Triggering build...');

        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/build.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ref: 'main' }),
            }
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to trigger build');
        }

        showToast('✅ Build triggered! Check your repo Actions tab.');

    } catch (err) {
        console.error('Build error:', err);
        showToast(`❌ ${err.message}`, true);
    }
}

// ─── DOWNLOAD IPA ──────────────────────────────────────────────
async function downloadIPA(repoName) {
    const token = localStorage.getItem('github_token');
    if (!token) {
        showToast('❌ Please login first', true);
        return;
    }

    try {
        const user = await getUserInfo(token);
        const owner = user.login;

        showToast('📦 Fetching latest IPA...');

        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/actions/artifacts`,
            {
                headers: { 'Authorization': `token ${token}` }
            }
        );

        if (!res.ok) throw new Error('Failed to fetch artifacts');

        const data = await res.json();

        if (!data.artifacts || data.artifacts.length === 0) {
            showToast('⚠️ No artifacts found. Build first!', true);
            return;
        }

        const artifact = data.artifacts[0];

        const downloadRes = await fetch(artifact.archive_download_url, {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!downloadRes.ok) throw new Error('Failed to download artifact');

        const blob = await downloadRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${repoName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('✅ Download started!');

    } catch (err) {
        console.error('Download error:', err);
        showToast(`❌ ${err.message}`, true);
    }
}

// ─── HELPERS ──────────────────────────────────────────────────
async function getUserInfo(token) {
    const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}` }
    });
    if (!res.ok) throw new Error('Failed to get user info');
    return res.json();
}

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

// ─── EXPOSE ──────────────────────────────────────────────────
window._buildProject = buildProject;
window._downloadIPA = downloadIPA;