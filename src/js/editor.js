// ─── EDITOR.JS ──────────────────────────────────────────────────
// Full editor logic: file tree, CRUD, Monaco, save, upload, folders

const REPO = new URLSearchParams(window.location.search).get('repo');
if (!REPO) {
    document.body.innerHTML = '<div style="text-align:center;padding:80px;color:#888;"><h2>No project selected</h2><p><a href="index.html">← Back to Dashboard</a></p></div>';
    throw new Error('No repo specified');
}

document.getElementById('repoName').textContent = REPO;
document.getElementById('projectName').textContent = REPO.replace('ibuild-', '');

let editor = null;
let currentContent = '';
let isDirty = false;
let currentToken = null;
let currentOwner = null;
let currentPath = 'Sources/main.swift';
let fileTree = [];

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

// ─── LOAD FILE TREE ──────────────────────────────────────────
async function loadFileTree() {
    const container = document.getElementById('fileList');
    container.innerHTML = '<li style="color:#555;text-align:center;padding:20px;">Loading...</li>';
    try {
        const res = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/git/trees/main?recursive=1`,
            { headers: { 'Authorization': `token ${currentToken}` } }
        );
        if (!res.ok) throw new Error('Failed to fetch file tree');
        const data = await res.json();
        fileTree = data.tree.filter(f => f.type === 'blob').sort((a, b) => a.path.localeCompare(b.path));
        renderFileTree();
    } catch (err) {
        console.error('Load file tree error:', err);
        container.innerHTML = '<li style="color:#555;text-align:center;padding:20px;">❌ Failed to load files</li>';
    }
}

function renderFileTree() {
    const container = document.getElementById('fileList');
    if (fileTree.length === 0) {
        container.innerHTML = '<li style="color:#555;text-align:center;padding:20px;">No files found</li>';
        return;
    }
    container.innerHTML = fileTree.map(f => {
        const isActive = f.path === currentPath;
        const icon = f.path.endsWith('.swift') ? '🦅' :
                    f.path.endsWith('.plist') ? '📋' :
                    f.path.endsWith('.yml') || f.path.endsWith('.yaml') ? '⚙️' : '📄';
        return `
            <li class="${isActive ? 'active' : ''}" data-path="${f.path}">
                <span><span class="file-icon">${icon}</span> ${f.path}</span>
                <span class="file-actions">
                    <button class="rename" onclick="event.stopPropagation(); openRenameModal('${f.path}')" title="Rename">✏️</button>
                    <button onclick="event.stopPropagation(); deleteFile('${f.path}')" title="Delete">🗑️</button>
                </span>
            </li>
        `;
    }).join('');
    container.querySelectorAll('li[data-path]').forEach(el => {
        el.addEventListener('click', () => {
            const path = el.dataset.path;
            if (isDirty && !confirm('You have unsaved changes. Switch files anyway?')) return;
            loadFile(path);
        });
    });
}

// ─── LOAD FILE ──────────────────────────────────────────────
async function loadFile(path) {
    currentPath = path;
    document.getElementById('currentFileName').textContent = path;
    try {
        const res = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${path}`,
            { headers: { 'Authorization': `token ${currentToken}` } }
        );
        if (res.ok) {
            const data = await res.json();
            currentContent = atob(data.content.replace(/\n/g, ''));
        } else if (res.status === 404) {
            currentContent = `// File not found: ${path}\n`;
        } else {
            throw new Error('Failed to fetch file');
        }
        if (editor) {
            editor.setValue(currentContent);
            isDirty = false;
            document.getElementById('saveStatus').textContent = '✅ Saved';
            document.getElementById('saveStatus').className = 'saved';
        }
        renderFileTree();
    } catch (err) {
        console.error('Load file error:', err);
        currentContent = `// Error loading file: ${err.message}\n`;
        if (editor) editor.setValue(currentContent);
    }
}

// ─── SAVE FILE ──────────────────────────────────────────────
async function saveFile() {
    if (!editor) return;
    const content = editor.getValue();
    try {
        let sha = '';
        const checkRes = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${currentPath}`,
            { headers: { 'Authorization': `token ${currentToken}` } }
        );
        if (checkRes.ok) {
            const data = await checkRes.json();
            sha = data.sha;
        }
        const encoded = btoa(unescape(encodeURIComponent(content)));
        const res = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${currentPath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Update ${currentPath} from iBuild Web`,
                    content: encoded,
                    sha: sha || undefined,
                    branch: 'main',
                }),
            }
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Save failed');
        }
        isDirty = false;
        document.getElementById('saveStatus').textContent = '✅ Saved';
        document.getElementById('saveStatus').className = 'saved';
        showToast('💾 Saved successfully!');
        await loadFileTree();
    } catch (err) {
        console.error('Save error:', err);
        showToast('❌ Save failed: ' + err.message, true);
    }
}

// ─── CREATE NEW FILE ─────────────────────────────────────────
async function createNewFile() {
    const path = document.getElementById('newFileName').value.trim();
    const status = document.getElementById('newFileStatus');
    if (!path) { status.textContent = '⚠️ Please enter a file path'; return; }
    status.textContent = '⏳ Creating...';
    try {
        const checkRes = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${path}`,
            { headers: { 'Authorization': `token ${currentToken}` } }
        );
        if (checkRes.ok) { status.textContent = '⚠️ File already exists'; return; }
        const content = '// New file created in iBuild Web\n';
        const encoded = btoa(unescape(encodeURIComponent(content)));
        const res = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Create ${path} from iBuild Web`,
                    content: encoded,
                    branch: 'main',
                }),
            }
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Create failed');
        }
        status.textContent = '✅ Created!';
        document.getElementById('newFileModal').style.display = 'none';
        showToast('✅ Created ' + path);
        await loadFileTree();
        await loadFile(path);
    } catch (err) {
        console.error('Create file error:', err);
        status.textContent = '❌ ' + err.message;
    }
}

// ─── CREATE NEW FOLDER ───────────────────────────────────────
async function createNewFolder() {
    const path = document.getElementById('newFolderName').value.trim();
    const status = document.getElementById('newFolderStatus');
    if (!path) { status.textContent = '⚠️ Please enter a folder path'; return; }
    status.textContent = '⏳ Creating folder...';
    try {
        const filePath = `${path}/.gitkeep`;
        const checkRes = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${filePath}`,
            { headers: { 'Authorization': `token ${currentToken}` } }
        );
        if (checkRes.ok) { status.textContent = '⚠️ Folder already exists'; return; }
        const encoded = btoa('');
        const res = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Create folder ${path} from iBuild Web`,
                    content: encoded,
                    branch: 'main',
                }),
            }
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Create folder failed');
        }
        status.textContent = '✅ Folder created!';
        document.getElementById('newFolderModal').style.display = 'none';
        showToast('✅ Created folder ' + path);
        await loadFileTree();
    } catch (err) {
        console.error('Create folder error:', err);
        status.textContent = '❌ ' + err.message;
    }
}

// ─── UPLOAD FILES ────────────────────────────────────────────
async function uploadFiles(files) {
    for (const file of files) {
        try {
            const path = `Sources/${file.name}`;
            const reader = new FileReader();
            const content = await new Promise((resolve) => {
                reader.onload = () => resolve(btoa(reader.result));
                reader.readAsBinaryString(file);
            });
            const res = await fetch(
                `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${currentToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: `Upload ${path} from iBuild Web`,
                        content: content,
                        branch: 'main',
                    }),
                }
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || `Failed to upload ${file.name}`);
            }
            showToast('✅ Uploaded ' + file.name);
        } catch (err) {
            console.error('Upload error:', err);
            showToast('❌ Upload failed: ' + err.message, true);
        }
    }
    await loadFileTree();
}

// ─── DELETE FILE ─────────────────────────────────────────────
async function deleteFile(path) {
    if (!confirm(`Delete "${path}"? This cannot be undone.`)) return;
    try {
        const checkRes = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${path}`,
            { headers: { 'Authorization': `token ${currentToken}` } }
        );
        if (!checkRes.ok) throw new Error('File not found');
        const data = await checkRes.json();
        const res = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${path}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Delete ${path} from iBuild Web`,
                    sha: data.sha,
                    branch: 'main',
                }),
            }
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Delete failed');
        }
        showToast('🗑️ Deleted ' + path);
        if (path === currentPath) {
            const firstFile = fileTree.find(f => f.path !== path);
            if (firstFile) await loadFile(firstFile.path);
        }
        await loadFileTree();
    } catch (err) {
        console.error('Delete error:', err);
        showToast('❌ Delete failed: ' + err.message, true);
    }
}

// ─── RENAME FILE ─────────────────────────────────────────────
let renameTarget = null;

function openRenameModal(path) {
    renameTarget = path;
    document.getElementById('renameFileName').value = path;
    document.getElementById('renameStatus').textContent = '';
    document.getElementById('renameModal').style.display = 'flex';
    document.getElementById('renameFileName').focus();
}

async function renameFile() {
    const newPath = document.getElementById('renameFileName').value.trim();
    const status = document.getElementById('renameStatus');
    if (!newPath || !renameTarget) { status.textContent = '⚠️ Invalid path'; return; }
    if (newPath === renameTarget) { document.getElementById('renameModal').style.display = 'none'; return; }
    status.textContent = '⏳ Renaming...';
    try {
        const oldRes = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${renameTarget}`,
            { headers: { 'Authorization': `token ${currentToken}` } }
        );
        if (!oldRes.ok) throw new Error('File not found');
        const oldData = await oldRes.json();
        const content = atob(oldData.content.replace(/\n/g, ''));
        const encoded = btoa(unescape(encodeURIComponent(content)));
        const createRes = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${newPath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Rename ${renameTarget} to ${newPath} from iBuild Web`,
                    content: encoded,
                    branch: 'main',
                }),
            }
        );
        if (!createRes.ok) throw new Error('Failed to create new file');
        const deleteRes = await fetch(
            `https://api.github.com/repos/${currentOwner}/${REPO}/contents/${renameTarget}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Delete ${renameTarget} after rename from iBuild Web`,
                    sha: oldData.sha,
                    branch: 'main',
                }),
            }
        );
        if (!deleteRes.ok) throw new Error('Failed to delete old file');
        status.textContent = '✅ Renamed!';
        document.getElementById('renameModal').style.display = 'none';
        showToast('✏️ Renamed to ' + newPath);
        const oldPath = renameTarget;
        renameTarget = null;
        await loadFileTree();
        if (currentPath === oldPath || currentPath === newPath) {
            await loadFile(newPath);
        }
    } catch (err) {
        console.error('Rename error:', err);
        status.textContent = '❌ ' + err.message;
    }
}

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
    const token = localStorage.getItem('github_token');
    if (!token) {
        document.body.innerHTML = '<div style="text-align:center;padding:80px;color:#888;"><h2>Not logged in</h2><p><a href="index.html">← Back to Dashboard</a></p></div>';
        return;
    }
    currentToken = token;
    try {
        const user = await getUserInfo(token);
        currentOwner = user.login;
        document.getElementById('userDisplay').textContent = '🐱 ' + user.login;
        await loadFileTree();
        await loadFile(currentPath);
        await MonacoLoader.load();
        editor = MonacoLoader.createEditor('editor-container', { value: currentContent });
        editor.onDidChangeModelContent(() => {
            isDirty = true;
            document.getElementById('saveStatus').textContent = '⚠️ Unsaved';
            document.getElementById('saveStatus').className = 'unsaved';
        });
        editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS, saveFile);

        // Event bindings
        document.getElementById('saveBtn').addEventListener('click', saveFile);
        document.getElementById('buildBtn').addEventListener('click', () => {
            if (typeof window._buildProject === 'function') window._buildProject(REPO);
            else showToast('⚠️ Build function not loaded', true);
        });
        document.getElementById('downloadBtn').addEventListener('click', () => {
            if (typeof window._downloadIPA === 'function') window._downloadIPA(REPO);
            else showToast('⚠️ Download function not loaded', true);
        });
        document.getElementById('backBtn').addEventListener('click', () => {
            if (isDirty && !confirm('You have unsaved changes. Go back anyway?')) return;
            window.location.href = 'index.html';
        });
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('github_token');
            window.location.href = 'index.html';
        });

        // New file
        document.getElementById('newFileBtn').addEventListener('click', () => {
            document.getElementById('newFileModal').style.display = 'flex';
            document.getElementById('newFileName').value = '';
            document.getElementById('newFileStatus').textContent = '';
            document.getElementById('newFileName').focus();
        });
        document.getElementById('newFileCancel').addEventListener('click', () => {
            document.getElementById('newFileModal').style.display = 'none';
        });
        document.getElementById('newFileModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) document.getElementById('newFileModal').style.display = 'none';
        });
        document.getElementById('newFileConfirm').addEventListener('click', createNewFile);

        // New folder
        document.getElementById('newFolderBtn').addEventListener('click', () => {
            document.getElementById('newFolderModal').style.display = 'flex';
            document.getElementById('newFolderName').value = '';
            document.getElementById('newFolderStatus').textContent = '';
            document.getElementById('newFolderName').focus();
        });
        document.getElementById('newFolderCancel').addEventListener('click', () => {
            document.getElementById('newFolderModal').style.display = 'none';
        });
        document.getElementById('newFolderModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) document.getElementById('newFolderModal').style.display = 'none';
        });
        document.getElementById('newFolderConfirm').addEventListener('click', createNewFolder);

        // Rename
        document.getElementById('renameCancel').addEventListener('click', () => {
            document.getElementById('renameModal').style.display = 'none';
        });
        document.getElementById('renameModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) document.getElementById('renameModal').style.display = 'none';
        });
        document.getElementById('renameConfirm').addEventListener('click', renameFile);

        // Upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileUploadInput').click();
        });
        document.getElementById('fileUploadInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                uploadFiles(e.target.files);
                e.target.value = '';
            }
        });

    } catch (err) {
        console.error('Init error:', err);
        document.getElementById('editor-container').innerHTML = '<div style="padding:40px;text-align:center;color:#888;">❌ Failed to load: ' + err.message + '</div>';
    }
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
    if (e.key === 'Escape') {
        document.getElementById('newFileModal').style.display = 'none';
        document.getElementById('newFolderModal').style.display = 'none';
        document.getElementById('renameModal').style.display = 'none';
    }
});

init();