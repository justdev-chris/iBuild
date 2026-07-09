// ─── PROJECTS ──────────────────────────────────────────────────
// Depends on: github.js (githubFetch, getGitHubToken, showToast)

const TEMPLATE_OWNER = 'justdev-chris';     // Your GitHub username
const TEMPLATE_REPO = 'iBuild-Template';    // The template repo name
const PROJECTS_PER_PAGE = 30;

// ─── LOAD PROJECTS ──────────────────────────────────────────────
async function loadProjects() {
    const container = document.getElementById('projectList');
    container.innerHTML = '<p class="loading-text">Loading projects...</p>';

    try {
        const token = getGitHubToken();
        if (!token) {
            container.innerHTML = '<p class="empty-text">Please login first.</p>';
            return;
        }

        const res = await githubFetch(
            `https://api.github.com/user/repos?per_page=${PROJECTS_PER_PAGE}&sort=updated&direction=desc`
        );

        if (!res.ok) throw new Error('Failed to fetch repos');

        const repos = await res.json();
        const projects = repos.filter(repo => repo.name.startsWith('ibuild-'));

        if (projects.length === 0) {
            container.innerHTML = `
                <p class="empty-text">No projects yet. Click "New Project" to get started!</p>
            `;
            return;
        }

        container.innerHTML = projects.map(repo => `
            <div class="project-item" data-repo="${repo.name}">
                <div class="project-info">
                    <span class="project-name">
                        ${repo.name.replace('ibuild-', '')}
                        <span class="repo-badge">${repo.private ? '🔒' : '🌐'}</span>
                    </span>
                    <span class="project-desc">${repo.description || 'No description'}</span>
                    <div class="project-meta">
                        <span>📅 ${new Date(repo.updated_at).toLocaleDateString()}</span>
                        <span>⭐ ${repo.stargazers_count}</span>
                        <span>🍴 ${repo.forks_count}</span>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="btn-secondary" onclick="openProject('${repo.name}')">📝 Open</button>
                    <button class="btn-secondary" onclick="buildProject('${repo.name}')">🔨 Build</button>
                    <button class="btn-secondary" onclick="downloadIPA('${repo.name}')">📦 IPA</button>
                    <button class="btn-danger" onclick="deleteProject('${repo.name}')">🗑️</button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Load projects error:', err);
        container.innerHTML = `<p class="empty-text">❌ Failed to load projects: ${err.message}</p>`;
    }
}

// ─── CREATE PROJECT ────────────────────────────────────────────
async function createProject(name, description) {
    const modalStatus = document.getElementById('modalStatus');
    modalStatus.textContent = '⏳ Creating project...';

    try {
        const token = getGitHubToken();
        if (!token) throw new Error('Not logged in');

        const repoName = `ibuild-${name}`;

        // Check if repo already exists
        const checkRes = await githubFetch(`https://api.github.com/repos/${token.user}/repos/${repoName}`);
        if (checkRes.status === 200) {
            throw new Error(`Repository "${repoName}" already exists`);
        }

        // ─── 1. Create empty repo ──────────────────────────────
        const createRes = await githubFetch('https://api.github.com/user/repos', {
            method: 'POST',
            body: JSON.stringify({
                name: repoName,
                description: description || 'iOS app built with iBuild Web',
                private: false,
                auto_init: false, // We'll push files manually
            }),
        });

        if (!createRes.ok) {
            const err = await createRes.json();
            throw new Error(err.message || 'Failed to create repo');
        }

        const repo = await createRes.json();

        // ─── 2. Get template files ─────────────────────────────
        modalStatus.textContent = '⏳ Copying template...';

        // Fetch template repo contents
        const templateFiles = await getTemplateContents();

        // ─── 3. Push files to new repo ─────────────────────────
        modalStatus.textContent = '⏳ Pushing files...';

        const owner = repo.owner.login;
        const defaultBranch = repo.default_branch || 'main';

        // Get the SHA of the default branch (needed for commits)
        const refRes = await githubFetch(
            `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`
        );
        const refData = await refRes.json();
        const baseSha = refData.object.sha;

        // Create blobs for each file
        const blobs = [];
        for (const file of templateFiles) {
            // Replace placeholder in main.swift with project name
            let content = file.content;
            if (file.path === 'Sources/main.swift') {
                content = content.replace(/\$\{PROJECT_NAME\}/g, name);
            }

            const encoded = btoa(unescape(encodeURIComponent(content)));

            const blobRes = await githubFetch(
                `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        content: encoded,
                        encoding: 'base64',
                    }),
                }
            );
            const blobData = await blobRes.json();
            blobs.push({
                path: file.path,
                sha: blobData.sha,
                mode: '100644', // Regular file
            });
        }

        // Create a tree
        const treeRes = await githubFetch(
            `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
            {
                method: 'POST',
                body: JSON.stringify({
                    base_tree: baseSha,
                    tree: blobs.map(b => ({
                        path: b.path,
                        mode: b.mode,
                        type: 'blob',
                        sha: b.sha,
                    })),
                }),
            }
        );
        const treeData = await treeRes.json();

        // Create a commit
        const commitRes = await githubFetch(
            `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
            {
                method: 'POST',
                body: JSON.stringify({
                    message: `Initial commit for ${name}`,
                    tree: treeData.sha,
                    parents: [baseSha],
                }),
            }
        );
        const commitData = await commitRes.json();

        // Update the reference (branch) to point to the new commit
        await githubFetch(
            `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    sha: commitData.sha,
                    force: false,
                }),
            }
        );

        modalStatus.textContent = '✅ Project created!';
        showToast('✅ Project created successfully!');

        setTimeout(() => {
            document.getElementById('newProjectModal').style.display = 'none';
            document.getElementById('projectName').value = '';
            document.getElementById('projectDescription').value = '';
            modalStatus.textContent = '';
            loadProjects();
        }, 1500);

    } catch (err) {
        console.error('Create project error:', err);
        modalStatus.textContent = `❌ ${err.message}`;
        showToast(`❌ ${err.message}`, true);
    }
}

// ─── GET TEMPLATE CONTENTS ──────────────────────────────────────
async function getTemplateContents() {
    const files = [
        'Sources/main.swift',
        'Info.plist',
        'project.yml',
        '.github/workflows/build.yml'
    ];

    const contents = [];

    for (const path of files) {
        const res = await fetch(
            `https://raw.githubusercontent.com/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/main/${path}`
        );
        if (!res.ok) {
            throw new Error(`Failed to fetch template file: ${path}`);
        }
        const content = await res.text();
        contents.push({ path, content });
    }

    return contents;
}

// ─── OPEN PROJECT ──────────────────────────────────────────────
function openProject(repoName) {
    window.location.href = `editor.html?repo=${repoName}`;
}

// ─── BUILD PROJECT ──────────────────────────────────────────────
async function buildProject(repoName) {
    const token = getGitHubToken();
    if (!token) {
        showToast('❌ Please login first', true);
        return;
    }

    const owner = token.user || 'user';

    try {
        showToast('🔨 Triggering build...');

        const res = await githubFetch(
            `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/build.yml/dispatches`,
            {
                method: 'POST',
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
    const token = getGitHubToken();
    if (!token) {
        showToast('❌ Please login first', true);
        return;
    }

    const owner = token.user || 'user';

    try {
        showToast('📦 Fetching latest IPA...');

        const res = await githubFetch(
            `https://api.github.com/repos/${owner}/${repoName}/actions/artifacts`
        );

        if (!res.ok) throw new Error('Failed to fetch artifacts');

        const data = await res.json();

        if (!data.artifacts || data.artifacts.length === 0) {
            showToast('⚠️ No artifacts found. Build first!', true);
            return;
        }

        const artifact = data.artifacts[0];
        const downloadRes = await githubFetch(artifact.archive_download_url);

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

// ─── DELETE PROJECT ────────────────────────────────────────────
async function deleteProject(repoName) {
    const token = getGitHubToken();
    if (!token) {
        showToast('❌ Please login first', true);
        return;
    }

    const owner = token.user || 'user';

    if (!confirm(`Delete "${repoName}" and all its files? This cannot be undone.`)) {
        return;
    }

    try {
        const res = await githubFetch(
            `https://api.github.com/repos/${owner}/${repoName}`,
            { method: 'DELETE' }
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to delete repo');
        }

        showToast('✅ Project deleted');
        loadProjects();

    } catch (err) {
        console.error('Delete error:', err);
        showToast(`❌ ${err.message}`, true);
    }
}

// ─── EVENT BINDING ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('newProjectBtn').addEventListener('click', () => {
        document.getElementById('newProjectModal').style.display = 'flex';
        document.getElementById('modalStatus').textContent = '';
    });

    document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('newProjectModal').style.display = 'none';
        document.getElementById('modalStatus').textContent = '';
    });

    document.getElementById('newProjectModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('newProjectModal').style.display = 'none';
            document.getElementById('modalStatus').textContent = '';
        }
    });

    document.getElementById('newProjectForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();

        if (!name) {
            showToast('⚠️ Please enter a project name', true);
            return;
        }

        createProject(name, description);
    });
});