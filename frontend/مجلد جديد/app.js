/**
 * Arkivo AI — Frontend Application Logic
 * ==========================================
 */

const API_BASE = window.location.origin;

// ═══ DOM Elements ═══════════════════════════════════════════════════════════
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const uploadFileName = document.getElementById('uploadFileName');
const uploadStatus = document.getElementById('uploadStatus');
const progressBarFill = document.getElementById('progressBarFill');
const documentsGrid = document.getElementById('documentsGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const modalOverlay = document.getElementById('modalOverlay');
const modalDocName = document.getElementById('modalDocName');
const modalMeta = document.getElementById('modalMeta');
const modalClose = document.getElementById('modalClose');
const extractedText = document.getElementById('extractedText'); // <textarea>
const copyTextBtn = document.getElementById('copyTextBtn');
const downloadBtn = document.getElementById('downloadBtn');
const totalDocs = document.getElementById('totalDocs');
const totalPages = document.getElementById('totalPages');
const toast = document.getElementById('toast');

// Editing Elements
const editTextBtn = document.getElementById('editTextBtn');
const saveTextBtn = document.getElementById('saveTextBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editActionContainer = document.getElementById('editActionContainer');
let isEditMode = false;
let originalTextBackup = "";
let currentLayoutData = null;

// Preview elements
const previewImage = document.getElementById('previewImage');
const previewLoading = document.getElementById('previewLoading');
const previewError = document.getElementById('previewError');
const previewContainer = document.getElementById('previewContainer');
const previewPageNav = document.getElementById('previewPageNav');
const pageIndicator = document.getElementById('pageIndicator');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomFitBtn = document.getElementById('zoomFitBtn');
const zoomLevelEl = document.getElementById('zoomLevel');
const modalTabs = document.getElementById('modalTabs');
const previewPane = document.getElementById('previewPane');
const textPane = document.getElementById('textPane');
const mainContent = document.getElementById('mainContent');
const aiAssistantView = document.getElementById('aiAssistantView');
const assistantChatHistory = document.getElementById('assistantChatHistory');
const assistantChatInput = document.getElementById('assistantChatInput');
const assistantSendBtn = document.getElementById('assistantSendBtn');

let allDocuments = [];
let currentDocId = null;
let currentDocName = '';
let currentDocType = '';
let currentPageCount = 1;
let currentPage = 1;
let zoomScale = 1;
let currentLoadSession = 0;

// ═══ Initialization ═════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    setupSidebar();
    setupUploadHandlers();
    setupModalHandlers();
    setupSearch();
    setupDocumentGridHandlers();
    setupPreviewHandlers();
    setupLayoutHandlers();
    setupTabHandlers();
    setupRightPaneTabs();
    setupAssistantHandlers();
    // Start on Dashboard view
    switchView('navDashboard');
});;

// ═══ Theme Handling ═════════════════════════════════════════════════════════
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('arkivo_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', initialTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('arkivo_theme', newTheme);
    });
}

// ═══ Upload Handlers & Global Export ════════════════════════════════════════
function setupUploadHandlers() {
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) await handleBatchUpload(e.target.files);
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) await handleBatchUpload(e.dataTransfer.files);
    });

    // Global Export Menu Logic
    const exportAllMenuBtn = document.getElementById('exportAllMenuBtn');
    const exportAllDropdownMenu = document.getElementById('exportAllDropdownMenu');

    if (exportAllMenuBtn && exportAllDropdownMenu) {
        exportAllMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportAllDropdownMenu.style.display = exportAllDropdownMenu.style.display === 'flex' ? 'none' : 'flex';
        });

        document.addEventListener('click', () => {
            exportAllDropdownMenu.style.display = 'none';
            const folderMenu = document.getElementById('folderExportAllDropdownMenu');
            if (folderMenu) folderMenu.style.display = 'none';
            const langMenu = document.getElementById('langDropdownMenu');
            if (langMenu) langMenu.style.display = 'none';
        });

        document.querySelectorAll('.export-dropdown-item[data-export-all]').forEach(item => {
            item.addEventListener('click', (e) => {
                const format = e.target.closest('.export-dropdown-item').dataset.exportAll;
                window.location.href = `${API_BASE}/api/export/all?format=${format}`;
                exportAllDropdownMenu.style.display = 'none';
            });
        });
    }

    // Custom Language Selector Logic
    const langMenuBtn = document.getElementById('langMenuBtn');
    const langDropdownMenu = document.getElementById('langDropdownMenu');
    const langOptions = document.querySelectorAll('.lang-option');
    const ocrLangInput = document.getElementById('ocrLang');
    const langSelectedText = document.getElementById('langSelectedText');

    if (langMenuBtn && langDropdownMenu) {
        langMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdownMenu.style.display = langDropdownMenu.style.display === 'flex' ? 'none' : 'flex';
        });

        langOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                if (ocrLangInput) ocrLangInput.value = opt.getAttribute('data-value');
                if (langSelectedText) langSelectedText.textContent = opt.textContent.trim();
                langDropdownMenu.style.display = 'none';
            });
        });
    }
}

async function handleBatchUpload(files) {
    const fileArray = Array.from(files);
    let successCount = 0;
    let failCount = 0;
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];

    uploadProgress.style.display = 'block';

    for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const ext = file.name.split('.').pop().toLowerCase();

        if (!allowedExts.includes(ext) || file.size > 20 * 1024 * 1024) {
            failCount++;
            continue;
        }

        uploadFileName.textContent = `[${i + 1}/${fileArray.length}] ${file.name}`;
        uploadStatus.textContent = 'Uploading & Analyzing (AI)...';
        uploadStatus.className = 'progress-status';
        progressBarFill.style.width = '0%';
        progressBarFill.style.background = 'var(--text-primary)';

        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 15;
                progressBarFill.style.width = Math.min(progress, 90) + '%';
            }
        }, 200);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const lang = document.getElementById('ocrLang').value || 'latin';
            const response = await fetch(`${API_BASE}/api/documents/upload?lang=${lang}`, {
                method: 'POST', body: formData,
            });

            clearInterval(progressInterval);
            progressBarFill.style.width = '100%';

            if (response.ok) {
                const doc = await response.json();
                if (doc.status === 'completed') successCount++; else failCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            clearInterval(progressInterval);
            failCount++;
        }
    }

    progressBarFill.style.width = '100%';
    uploadStatus.textContent = '✓ Completed';
    uploadStatus.className = 'progress-status completed';
    if (failCount > 0) progressBarFill.style.background = 'var(--danger)';

    fileInput.value = '';

    await loadDocuments();

    setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressBarFill.style.background = '';
    }, 4500);
}

// ═══ Documents List ═════════════════════════════════════════════════════════
let currentFolderId = null;

async function loadDocuments() {
    try {
        const response = await fetch(`${API_BASE}/api/documents`);
        if (!response.ok) throw new Error('Failed to load documents');
        allDocuments = await response.json();

        if (currentFolderId !== null && typeof window.closeFolder === 'function') {
            window.closeFolder();
        } else {
            renderDocuments(allDocuments);
        }
        updateStats(allDocuments);
    } catch (err) {
        showToast('Failed to load documents', 'error');
    }
}

async function openFolder(docId, docName) {
    currentFolderId = docId;
    try {
        const response = await fetch(`${API_BASE}/api/documents/${docId}/children`);
        if (!response.ok) throw new Error('Failed to load folder contents');
        const children = await response.json();

        let nav = document.getElementById('folderNav');
        if (!nav) {
            nav = document.createElement('div');
            nav.id = 'folderNav';
            nav.className = 'folder-nav';
            nav.style.display = 'flex';
            nav.style.alignItems = 'center';
            nav.style.justifyContent = 'space-between';
            nav.style.marginTop = '16px';
            nav.style.marginBottom = '16px';
            nav.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn btn-outline" onclick="closeFolder()" style="display:flex; align-items:center; gap:6px; height:32px; padding:0 12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        Back to Documents
                    </button>
                    <div style="color:var(--text-secondary); font-size:14px; margin-left:4px;">/ <span id="folderNavName" style="color:var(--text-primary); font-weight:500;"></span></div>
                </div>
                
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button class="btn btn-extract" id="folderExtractAllBtn" onclick="extractAllFolderDocs()" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                            <path d="M2 17l10 5 10-5"></path>
                            <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        AI Data Extraction ALL
                    </button>
                    
                    <div style="position: relative; display: inline-block;">
                        <button class="btn btn-outline" id="folderExportAllMenuBtn" onclick="toggleFolderExportMenu(event)" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export FOLDER All
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div id="folderExportAllDropdownMenu" style="display: none; position: absolute; top: 100%; right: 0; background: var(--bg-card, #222); border: 1px solid var(--border, #444); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); padding: 4px 0; z-index: 100; margin-top: 8px; min-width: 160px; flex-direction: column;">
                            <button class="export-dropdown-item" onclick="exportFolderDocs('csv')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="3" y1="9" x2="21" y2="9"></line>
                                    <line x1="3" y1="15" x2="21" y2="15"></line>
                                    <line x1="9" y1="9" x2="9" y2="21"></line>
                                    <line x1="15" y1="9" x2="15" y2="21"></line>
                                </svg>
                                Export as CSV
                            </button>
                            <button class="export-dropdown-item" onclick="exportFolderDocs('excel')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <path d="M9.5 11.5l5 5"></path>
                                    <path d="M14.5 11.5l-5 5"></path>
                                </svg>
                                Export as Excel
                            </button>
                            <button class="export-dropdown-item" onclick="exportFolderDocs('txt')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                                Export as Text
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.querySelector('.documents-section .section-header').insertAdjacentElement('afterend', nav);
        }
        nav.style.display = 'flex';
        document.getElementById('folderNavName').textContent = docName;

        renderDocuments(children, true);
    } catch (err) {
        showToast('Failed to open folder', 'error');
    }
}

window.closeFolder = function () {
    currentFolderId = null;
    const nav = document.getElementById('folderNav');
    if (nav) nav.style.display = 'none';
    renderDocuments(allDocuments);
};

window.openFolder = openFolder;

window.toggleFolderExportMenu = function (e) {
    e.stopPropagation();
    const menu = document.getElementById('folderExportAllDropdownMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    }
};

window.exportFolderDocs = function (format) {
    if (!currentFolderId) return;
    window.location.href = `${API_BASE}/api/export/folder/${currentFolderId}?format=${format}`;
    const menu = document.getElementById('folderExportAllDropdownMenu');
    if (menu) menu.style.display = 'none';
};

window.extractAllFolderDocs = async function () {
    if (!currentFolderId) return;

    // Disable button visually and set up progress animation
    const btn = document.getElementById('folderExtractAllBtn');
    if (!btn) return;
    const originalHtml = btn.innerHTML;
    const originalWidth = btn.offsetWidth;

    btn.style.width = originalWidth + 'px';
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.style.pointerEvents = 'none';

    btn.innerHTML = `
        <div id="extractProgressFill" style="position:absolute; left:0; bottom:0; width:0%; height:4px; background:var(--success, #10B981); transition: width 0.3s ease; z-index:1; border-radius: 0 0 6px 6px;"></div>
        <div style="position:relative; z-index:2; display:flex; align-items:center; justify-content:center; width: 100%; gap:8px;">
            <div class="preview-spinner" style="width:14px;height:14px;borderWidth:2px;margin:0"></div>
            <span id="extractProgressText" style="font-size: 13px; font-weight: 500;">Starting...</span>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/api/documents/${currentFolderId}/children`);
        if (!response.ok) throw new Error('Failed to fetch folder docs');
        const children = await response.json();

        // Filter out docs that already have metadata
        const validDocs = children.filter(child => {
            const hasText = child.status === 'completed' && child.extracted_text_preview;
            const notExtracted = !child.extracted_metadata || Object.keys(child.extracted_metadata).length === 0;
            return hasText && notExtracted;
        });
        const total = validDocs.length;

        if (total === 0) {
            showToast('All documents are already extracted or none are ready', 'info');

            // Restore button
            btn.innerHTML = originalHtml;
            btn.style.pointerEvents = 'auto';
            btn.style.width = '';
            return;
        }

        const progressFill = document.getElementById('extractProgressFill');
        const progressText = document.getElementById('extractProgressText');

        let successCount = 0;
        for (let i = 0; i < total; i++) {
            const child = validDocs[i];

            if (progressText) progressText.textContent = `Extracting ${i + 1}/${total}`;
            if (progressFill) progressFill.style.width = `${(i / total) * 100}%`;

            try {
                const extractRes = await fetch(`${API_BASE}/api/documents/${child.id}/extract`, { method: 'POST' });
                if (extractRes.ok) successCount++;
            } catch (e) {
                console.error('Failed to extract doc', child.id, e);
            }
        }

        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = 'Completed!';

        showToast(`Extracted data for ${successCount} documents in folder`, 'success');

        // Refresh folder view
        setTimeout(() => {
            if (currentFolderId && document.getElementById('folderNavName')) {
                openFolder(currentFolderId, document.getElementById('folderNavName').textContent);
            }
        }, 600);

    } catch (err) {
        showToast('Failed to start folder extraction', 'error');
    } finally {
        setTimeout(() => {
            const currentBtn = document.getElementById('folderExtractAllBtn');
            if (currentBtn) {
                currentBtn.innerHTML = originalHtml;
                currentBtn.style.pointerEvents = 'auto';
                currentBtn.style.width = '';
            }
        }, 1500);
    }
};

function renderDocuments(docs, isFolderView = false) {
    if (docs.length === 0) {
        documentsGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    documentsGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    documentsGrid.innerHTML = docs.map(doc => {
        if (doc.file_type === 'folder') {
            return `
            <div class="doc-card" style="cursor:pointer;" onclick="openFolder(${doc.id}, '${escapeAttr(doc.original_filename)}')" data-id="${doc.id}">
                <div class="doc-card-header">
                    <span class="doc-card-title" title="${escapeAttr(doc.original_filename)}">${escapeHtml(doc.original_filename)}</span>
                    <span class="doc-card-badge" style="background:var(--bg-secondary); border:1px solid var(--border); color:var(--text-primary);">FOLDER</span>
                </div>
                <div class="doc-card-thumbnail" style="display:flex; align-items:center; justify-content:center; background:var(--bg-secondary);">
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-secondary);">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <div class="doc-card-meta">
                    <div class="doc-card-meta-left">
                        <span class="doc-card-status status-${doc.status}">
                            <span class="status-dot"></span>
                            ${capitalize(doc.status)}
                        </span>
                        <span style="display:flex; align-items:center; gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            ${doc.page_count} pg
                        </span>
                    </div>
                    <button class="doc-card-delete" onclick="event.stopPropagation(); window.deleteDocument(${doc.id}, '${escapeAttr(doc.original_filename)}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>`;
        }

        return `
        <div class="doc-card" onclick="openDocument(${doc.id})" data-id="${doc.id}">
            <div class="doc-card-header">
                <span class="doc-card-title" title="${escapeAttr(doc.original_filename)}">${escapeHtml(doc.original_filename)}</span>
                <span class="doc-card-badge badge-${doc.file_type}">${doc.file_type.toUpperCase()}</span>
            </div>
            <div class="doc-card-thumbnail">
                <img src="${API_BASE}/api/documents/${doc.id}/preview?page=1&t=${doc.created_at ? new Date(doc.created_at).getTime() : Date.now()}" alt="Thumbnail" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);\\'>Preview Error</div>';">
            </div>
            <div class="doc-card-meta">
                <div class="doc-card-meta-left">
                    <span class="doc-card-status status-${doc.status}">
                        <span class="status-dot"></span>
                        ${capitalize(doc.status)}
                    </span>
                    ${!isFolderView ? `<span>${formatFileSize(doc.file_size)}</span>` : ''}
                </div>
                <button class="doc-card-delete" onclick="event.stopPropagation(); window.deleteDocument(${doc.id}, '${escapeAttr(doc.original_filename)}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        </div>`;
    }).join('');
}

function updateStats(docs) {
    totalDocs.textContent = docs.length;
    totalPages.textContent = docs.reduce((sum, d) => sum + (d.page_count || 0), 0);
}

// ═══ Document Detail Modal ══════════════════════════════════════════════════
function setupModalHandlers() {
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    copyTextBtn.addEventListener('click', copyExtractedText);
    downloadBtn.addEventListener('click', downloadOriginal);

    if (editTextBtn) editTextBtn.addEventListener('click', toggleEditText);
    if (saveTextBtn) saveTextBtn.addEventListener('click', saveText);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);
}

async function openDocument(docId) {
    currentLoadSession++;
    const sessionId = currentLoadSession;

    currentDocId = docId;
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Hide AI Chat Bar when modal is open
    const chatBar = document.querySelector('.ai-chat-container');
    if (chatBar) chatBar.style.display = 'none';

    extractedText.value = 'Loading...';

    resetPreview();

    try {
        const response = await fetch(`${API_BASE}/api/documents/${docId}`);
        if (!response.ok) throw new Error('Failed to load document');
        const doc = await response.json();

        if (currentLoadSession !== sessionId) return;

        modalDocName.textContent = doc.original_filename;
        currentDocName = doc.original_filename;
        currentDocType = doc.file_type;
        window.currentDocCreatedAt = doc.created_at;
        currentPageCount = doc.page_count || 1;
        currentPage = 1;

        modalMeta.innerHTML = `
            <span style="display:inline-flex;align-items:center;gap:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>${doc.file_type.toUpperCase()}</span>
            <span style="display:inline-flex;align-items:center;gap:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>${doc.page_count} page${doc.page_count > 1 ? 's' : ''}</span>
            <span style="display:inline-flex;align-items:center;gap:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>${formatFileSize(doc.file_size)}</span>
            <span style="display:inline-flex;align-items:center;gap:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${formatDate(doc.created_at)}</span>
        `;

        if (doc.status === 'completed' && doc.extracted_text) {
            extractedText.value = doc.extracted_text;
        } else if (doc.status === 'failed') {
            extractedText.value = `OCR processing failed:\n${doc.error_message || 'Unknown error'}`;
        } else {
            extractedText.value = 'No text extracted from this document.';
        }

        loadPreviewPage(docId, 1);

        if (doc.file_type === 'pdf' && currentPageCount > 1) {
            previewPageNav.style.display = 'flex';
            updatePageIndicator();
        }

    } catch (err) {
        if (currentLoadSession !== sessionId) return;
        extractedText.value = 'Error loading document details.';
        showToast('Failed to load document', 'error');
    }
}

// ── Text & Layout Edit Functions ──
function toggleEditText() {
    isEditMode = true;
    originalTextBackup = extractedText.value;

    if (editTextBtn) editTextBtn.style.display = 'none';
    if (editActionContainer) editActionContainer.style.display = 'flex';

    applyEditModeToCurrentView();
}

function applyEditModeToCurrentView() {
    if (!isEditMode) return;

    const isLayoutView = document.querySelector('.toggle-btn[data-view="layout"]').classList.contains('active');

    if (isLayoutView) {
        extractedText.setAttribute('readonly', 'true');
        extractedText.style.borderColor = 'var(--border)';
        extractedText.style.boxShadow = 'none';

        document.querySelectorAll('.layout-block').forEach(b => b.setAttribute('contenteditable', 'true'));
    } else {
        extractedText.removeAttribute('readonly');
        extractedText.focus();
        extractedText.style.borderColor = 'var(--primary)';
        extractedText.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.1)';

        document.querySelectorAll('.layout-block').forEach(b => b.removeAttribute('contenteditable'));
    }
}

function cancelEdit() {
    extractedText.value = originalTextBackup;

    if (currentLayoutData) {
        renderLayout(currentLayoutData);
    }
    resetEditState();
}

async function saveText() {
    if (!currentDocId) return;

    saveTextBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Saving...';
    saveTextBtn.disabled = true;

    const isLayoutView = document.querySelector('.toggle-btn[data-view="layout"]').classList.contains('active');

    try {
        if (isLayoutView) {
            const blocksToSave = currentLayoutData.blocks;
            document.querySelectorAll('.layout-block').forEach(el => {
                const idx = el.dataset.index;
                if (idx !== undefined) blocksToSave[idx].text = el.innerText;
            });

            const response = await fetch(`${API_BASE}/api/documents/${currentDocId}/layout`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: currentLayoutPage, blocks: blocksToSave })
            });

            if (!response.ok) throw new Error('Failed to save layout text');
            showToast('Layout text updated successfully!', 'success');

        } else {
            const newText = extractedText.value;
            const response = await fetch(`${API_BASE}/api/documents/${currentDocId}/text`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extracted_text: newText })
            });

            if (!response.ok) throw new Error('Failed to save text');
            showToast('Text updated successfully!', 'success');
            originalTextBackup = newText;
        }

        resetEditState();
    } catch (err) {
        console.error(err);
        showToast('Error saving changes', 'error');
    } finally {
        saveTextBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save';
        saveTextBtn.disabled = false;
    }
}

function resetEditState() {
    isEditMode = false;

    extractedText.setAttribute('readonly', 'true');
    extractedText.style.borderColor = 'var(--border)';
    extractedText.style.boxShadow = 'none';

    document.querySelectorAll('.layout-block').forEach(b => b.removeAttribute('contenteditable'));

    if (editTextBtn) editTextBtn.style.display = 'inline-flex';
    if (editActionContainer) editActionContainer.style.display = 'none';
}

function resetPreview() {
    previewImage.style.display = 'none';
    previewImage.src = '';
    previewImage.style.width = '';
    previewImage.style.transform = '';
    previewLoading.style.display = 'flex';
    previewError.style.display = 'none';
    previewPageNav.style.display = 'none';
    zoomScale = 1;
    imgNaturalW = 0;
    imgNaturalH = 0;
    isDragging = false;
    updateZoomDisplay();
    currentPage = 1;
    currentPageCount = 1;
    previewContainer.scrollTop = 0;
    previewContainer.scrollLeft = 0;

    previewPane.classList.remove('hidden-tab');
    textPane.classList.remove('hidden-tab');
    modalTabs.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    const previewTabBtn = modalTabs.querySelector('[data-tab="preview"]');
    if (previewTabBtn) previewTabBtn.classList.add('active');

    layoutZoom = 1;
    const lcw = document.getElementById('layoutCanvasWrapper');
    if (lcw) lcw.style.transform = `scale(1)`;

    resetEditState();
}

let imgNaturalW = 0;
let imgNaturalH = 0;

function loadPreviewPage(docId, page) {
    previewImage.style.display = 'none';
    previewLoading.style.display = 'flex';
    previewError.style.display = 'none';

    const sessionId = currentLoadSession;

    const img = new Image();
    img.onload = () => {
        if (currentLoadSession !== sessionId) return;
        imgNaturalW = img.naturalWidth;
        imgNaturalH = img.naturalHeight;
        previewImage.src = img.src;
        previewImage.style.display = 'block';
        previewLoading.style.display = 'none';
        zoomScale = 1;
        applyZoom();
    };
    img.onerror = () => {
        if (currentLoadSession !== sessionId) return;
        previewLoading.style.display = 'none';
        previewError.style.display = 'flex';
    };

    const cacheBuster = window.currentDocCreatedAt ? new Date(window.currentDocCreatedAt).getTime() : Date.now();
    img.src = `${API_BASE}/api/documents/${docId}/preview?page=${page}&t=${cacheBuster}`;
}

function closeModal() {
    currentLoadSession++;
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentDocId = null;
    currentDocName = '';
    currentDocType = '';

    // Show AI Chat Bar when modal is closed
    const chatBar = document.querySelector('.ai-chat-container');
    if (chatBar) chatBar.style.display = 'flex';
}

// ═══ Preview Controls (Zoom + Pan) ══════════════════════════════════════════
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let scrollStartX = 0;
let scrollStartY = 0;

function setupPreviewHandlers() {
    zoomInBtn.addEventListener('click', () => { setZoom(Math.min(zoomScale + 0.25, 5)); });
    zoomOutBtn.addEventListener('click', () => { setZoom(Math.max(zoomScale - 0.25, 0.25)); });
    zoomFitBtn.addEventListener('click', () => {
        setZoom(1);
        previewContainer.scrollTop = 0;
        previewContainer.scrollLeft = 0;
    });

    previewContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.25, Math.min(zoomScale + delta, 5));
        const rect = previewContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const scrollX = previewContainer.scrollLeft;
        const scrollY = previewContainer.scrollTop;
        const contentX = (scrollX + mouseX);
        const contentY = (scrollY + mouseY);
        const ratio = newScale / zoomScale;
        zoomScale = newScale;
        applyZoom();
        previewContainer.scrollLeft = contentX * ratio - mouseX;
        previewContainer.scrollTop = contentY * ratio - mouseY;
    }, { passive: false });

    previewContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        scrollStartX = previewContainer.scrollLeft;
        scrollStartY = previewContainer.scrollTop;
        previewContainer.style.cursor = 'grabbing';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        previewContainer.scrollLeft = scrollStartX - dx;
        previewContainer.scrollTop = scrollStartY - dy;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            previewContainer.style.cursor = 'grab';
        }
    });

    previewContainer.addEventListener('dblclick', () => {
        setZoom(1);
        previewContainer.scrollTop = 0;
        previewContainer.scrollLeft = 0;
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            currentLoadSession++;
            loadPreviewPage(currentDocId, currentPage);
            updatePageIndicator();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < currentPageCount) {
            currentPage++;
            currentLoadSession++;
            loadPreviewPage(currentDocId, currentPage);
            updatePageIndicator();
        }
    });
}

function setZoom(newScale) {
    zoomScale = newScale;
    applyZoom();
}

function applyZoom() {
    if (!imgNaturalW) return;
    if (zoomScale <= 1) {
        previewImage.style.width = (zoomScale * 100) + '%';
        previewImage.style.maxWidth = '100%';
        previewImage.style.maxHeight = '100%';
        previewImage.style.margin = '0 auto';
    } else {
        const containerW = previewContainer.clientWidth;
        previewImage.style.width = (containerW * zoomScale) + 'px';
        previewImage.style.maxWidth = 'none';
        previewImage.style.maxHeight = 'none';
        previewImage.style.margin = '0';
    }
    previewImage.style.transform = '';
    updateZoomDisplay();
}

function updateZoomDisplay() {
    zoomLevelEl.textContent = Math.round(zoomScale * 100) + '%';
}

function updatePageIndicator() {
    pageIndicator.textContent = `${currentPage} / ${currentPageCount}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= currentPageCount;
}

// ═══ Mobile Tab Handling ════════════════════════════════════════════════════
function setupTabHandlers() {
    modalTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.modal-tab');
        if (!tab) return;
        const tabName = tab.dataset.tab;

        modalTabs.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (tabName === 'preview') {
            previewPane.classList.remove('hidden-tab');
            textPane.classList.add('hidden-tab');
        } else {
            previewPane.classList.add('hidden-tab');
            textPane.classList.remove('hidden-tab');
        }
    });
}

// ═══ Right Pane Tab Handling ════════════════════════════════════════════════
function setupRightPaneTabs() {
    const tabs = document.querySelectorAll('.rp-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetId = tab.dataset.target;
            const textViewer = document.getElementById('textViewer');
            const extractionPanel = document.getElementById('extractionPanel');

            if (targetId === 'textViewer') {
                textViewer.classList.add('active-view');
                textViewer.classList.remove('view-hidden');
                extractionPanel.classList.add('view-hidden');
                extractionPanel.classList.remove('active-view');
            } else {
                extractionPanel.classList.add('active-view');
                extractionPanel.classList.remove('view-hidden');
                textViewer.classList.add('view-hidden');
                textViewer.classList.remove('active-view');
            }
        });
    });
}

async function copyExtractedText() {
    const text = extractedText.value;
    if (!text || text === 'Loading...') return;

    try {
        await navigator.clipboard.writeText(text);
        showToast('Text copied to clipboard!', 'success');
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Text copied to clipboard!', 'success');
    }
}

function downloadOriginal() {
    if (!currentDocId) return;
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/documents/${currentDocId}/download`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ═══ Delete Document ═══════════════════════════════════════════════════════
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmDocName = document.getElementById('confirmDocName');
const confirmCancel = document.getElementById('confirmCancel');
const confirmDelete = document.getElementById('confirmDelete');

function showConfirmDialog(filename) {
    return new Promise((resolve) => {
        confirmDocName.textContent = filename;
        confirmOverlay.classList.add('active');

        function cleanup() {
            confirmOverlay.classList.remove('active');
            confirmCancel.removeEventListener('click', onCancel);
            confirmDelete.removeEventListener('click', onConfirm);
        }

        function onCancel() { cleanup(); resolve(false); }
        function onConfirm() { cleanup(); resolve(true); }

        confirmCancel.addEventListener('click', onCancel);
        confirmDelete.addEventListener('click', onConfirm);
    });
}

async function deleteDocument(docId, filename) {
    const confirmed = await showConfirmDialog(filename);
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/api/documents/${docId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        showToast('Document deleted', 'info');
        if (currentDocId === docId) closeModal();
        if (currentFolderId) {
            openFolder(currentFolderId, document.getElementById('folderNavName').textContent);
        } else {
            await loadDocuments();
        }
    } catch (err) {
        showToast('Failed to delete document: ' + err.message, 'error');
    }
}
window.deleteDocument = deleteDocument;

// ═══ Search & Filters ═══════════════════════════════════════════════════════
const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
const advancedFilterDrawer = document.getElementById('advancedFilterDrawer');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const exportFilteredBtn = document.getElementById('exportFilteredBtn');

let currentActiveFilters = {};

function setupSearch() {
    // 1. Hybrid local search
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query && Object.keys(currentActiveFilters).length === 0) {
            renderDocuments(allDocuments);
            return;
        }
        if (!query) return; // If filters are active, keep them. Otherwise handled by clear.
        const filtered = allDocuments.filter(doc =>
            doc.original_filename.toLowerCase().includes(query) ||
            (doc.extracted_text_preview || '').toLowerCase().includes(query)
        );
        renderDocuments(filtered);
    });

    // 3. Toggle Advanced Filters
    if (toggleFiltersBtn) {
        toggleFiltersBtn.addEventListener('click', () => {
            const isHidden = advancedFilterDrawer.style.display === 'none';
            advancedFilterDrawer.style.display = isHidden ? 'block' : 'none';
            toggleFiltersBtn.classList.toggle('active', isHidden);
            if (isHidden) {
                toggleFiltersBtn.style.background = 'var(--bg-secondary)';
            } else {
                toggleFiltersBtn.style.background = 'transparent';
            }
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => performAdvancedSearch(false));
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            document.getElementById('filterDocType').value = '';
            document.getElementById('filterDateFrom').value = '';
            document.getElementById('filterDateTo').value = '';
            document.getElementById('filterCompany').value = '';
            document.getElementById('filterClient').value = '';
            searchInput.value = '';
            currentActiveFilters = {};
            loadDocuments();
        });
    }

    if (exportFilteredBtn) {
        exportFilteredBtn.addEventListener('click', () => {
            if (Object.keys(currentActiveFilters).length === 0 && !searchInput.value) {
                showToast('Please apply filters or search before exporting.', 'warning');
                return;
            }
            exportCustomFiltered();
        });
    }
}

async function performAdvancedSearch(useAIQuery = false, customQuery = null) {
    const query = customQuery !== null ? customQuery : searchInput.value.trim();
    let bodyData = {};

    if (useAIQuery && query) {
        bodyData = { query: query };

        try {
            const res = await fetch(`${API_BASE}/api/documents/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();

            // Auto populate filters based on AI
            const f = data.filters || {};
            document.getElementById('filterDocType').value = f.document_type || '';
            document.getElementById('filterCompany').value = f.company || '';
            document.getElementById('filterClient').value = f.client_name || '';
            if (f.date_range) {
                document.getElementById('filterDateFrom').value = f.date_range.from || '';
                document.getElementById('filterDateTo').value = f.date_range.to || '';
            }

            // Open drawer to show the user what was extracted
            const advDrawer = document.getElementById('advancedFilterDrawer');
            if (advDrawer) advDrawer.style.display = 'block';

            const togFiltersBtn = document.getElementById('toggleFiltersBtn');
            if (togFiltersBtn) togFiltersBtn.style.background = 'var(--bg-secondary)';

            currentActiveFilters = f;
            renderDocuments(data.results);
            showToast(`Found ${data.results.length} matches`, 'success');

        } catch (e) {
            showToast('AI Search failed: ' + e.message, 'error');
        }

    } else {
        // Manual filter application
        const dr_from = document.getElementById('filterDateFrom').value;
        const dr_to = document.getElementById('filterDateTo').value;
        const f = {
            document_type: document.getElementById('filterDocType').value || null,
            company: document.getElementById('filterCompany').value || null,
            client_name: document.getElementById('filterClient').value || null,
            keyword: query || null
        };
        if (dr_from || dr_to) {
            f.date_range = { from: dr_from || null, to: dr_to || null };
        }

        bodyData = { filters: f };
        currentActiveFilters = f;

        const originalBtnText = applyFiltersBtn.textContent;
        applyFiltersBtn.textContent = 'Applying...';
        applyFiltersBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/api/documents/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            renderDocuments(data.results);
            showToast(`Applied filters. Found ${data.results.length} items.`, 'success');
        } catch (e) {
            showToast('Filter failed: ' + e.message, 'error');
        } finally {
            applyFiltersBtn.textContent = originalBtnText;
            applyFiltersBtn.disabled = false;
        }
    }
}

async function exportCustomFiltered() {
    const format = 'excel';
    const originalText = exportFilteredBtn.innerHTML;
    exportFilteredBtn.innerHTML = '<div class="preview-spinner" style="width:14px;height:14px;borderWidth:2px;margin-right:6px"></div> Exporting...';
    exportFilteredBtn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/export/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: currentActiveFilters, format: format })
        });

        if (!res.ok) throw new Error('Export generation failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `custom_export.${format === 'excel' ? 'xlsx' : format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        showToast('Export successful!', 'success');
    } catch (e) {
        showToast('Export failed: ' + e.message, 'error');
    } finally {
        exportFilteredBtn.innerHTML = originalText;
        exportFilteredBtn.disabled = false;
    }
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setupDocumentGridHandlers() { }

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}


// ═══ Milestone 2: AI Extraction ═════════════════════════════════════════════
const extractDataBtn = document.getElementById('extractDataBtn');
const extractionLoading = document.getElementById('extractionLoading');
const extractionResults = document.getElementById('extractionResults');
const extractionTypeBadge = document.getElementById('extractionTypeBadge');
const extractionTableBody = document.getElementById('extractionTableBody');
const extractionConfidence = document.getElementById('extractionConfidence');

// Individual Document Export Dropdown
const exportMenuBtn = document.getElementById('exportMenuBtn');
const exportDropdownMenu = document.getElementById('exportDropdownMenu');

extractDataBtn.addEventListener('click', () => {
    if (currentDocId) extractDocument(currentDocId);
});

if (exportMenuBtn && exportDropdownMenu) {
    exportMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdownMenu.style.display = exportDropdownMenu.style.display === 'flex' ? 'none' : 'flex';
    });

    document.addEventListener('click', () => {
        exportDropdownMenu.style.display = 'none';
    });

    document.querySelectorAll('.export-dropdown-item[data-format]').forEach(item => {
        item.addEventListener('click', (e) => {
            const format = e.target.closest('.export-dropdown-item').dataset.format;
            if (currentDocId) exportData(currentDocId, format);
            exportDropdownMenu.style.display = 'none';
        });
    });
}

async function extractDocument(docId) {
    extractDataBtn.disabled = true;
    extractionLoading.style.display = 'flex';
    extractionResults.style.display = 'none';
    const scanner = document.getElementById('imageScanner');
    if (scanner) scanner.style.display = 'block';

    try {
        const startTime = Date.now();
        const response = await fetch(`${API_BASE}/api/documents/${docId}/extract`, { method: 'POST' });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Extraction failed');
        }
        const data = await response.json();
        const elapsed = Date.now() - startTime;
        if (elapsed < 1500) await new Promise(r => setTimeout(r, 1500 - elapsed));

        renderExtractionResults(data);
        showToast('Data extraction completed!', 'success');
    } catch (err) {
        showToast('Extraction failed: ' + err.message, 'error');
        extractionLoading.style.display = 'none';
    } finally {
        extractDataBtn.disabled = false;
        if (scanner) scanner.style.display = 'none';
    }
}

function renderExtractionResults(data) {
    extractionLoading.style.display = 'none';
    extractionResults.style.display = 'block';

    const docType = data.type || 'other';
    extractionTypeBadge.textContent = docType.toUpperCase();
    extractionTypeBadge.className = `extraction-type-badge type-${docType}`;

    const fields = [
        { label: 'Invoice Number', key: 'invoice_number', data: data.invoice_number },
        { label: 'Date', key: 'date', data: data.date },
        { label: 'Due Date', key: 'due_date', data: data.due_date },
        { label: 'Expiry Date', key: 'expiry_date', data: data.expiry_date },
        { label: 'Total Amount', key: 'total_amount', data: data.total_amount },
        { label: 'Currency', key: 'currency', data: data.currency },
        { label: 'Company', key: 'company', data: data.company },
        { label: 'Client Name', key: 'client_name', data: data.client_name }
    ];

    extractionTableBody.innerHTML = `
        <tr>
            <td>Document Type</td>
            <td><strong>${escapeHtml(capitalize(docType))}</strong></td>
        </tr>
    ` + fields.map(f => {
        let val = f.data ? f.data.value : '';
        let conf = f.data ? f.data.confidence : 0;
        let badgeColor = conf >= 80 ? 'var(--success)' : conf >= 60 ? 'var(--warning)' : 'var(--danger)';
        let displayConf = conf > 0 ? `${conf}%` : 'N/A';
        return `
        <tr>
            <td style="vertical-align: middle;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${escapeHtml(f.label)}</span>
                    <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: ${badgeColor};" title="AI Extraction Confidence">
                        ${displayConf}
                    </span>
                </div>
            </td>
            <td><input type="text" class="edit-input" data-key="${f.key}" data-conf="${conf}" value="${escapeAttr(String(val || ''))}" placeholder="—"></td>
        </tr>`;
    }).join('');

    let saveBtn = document.getElementById('saveExtractionBtn');
    if (!saveBtn) {
        saveBtn = document.createElement('button');
        saveBtn.id = 'saveExtractionBtn';
        saveBtn.className = 'btn btn-accent';
        saveBtn.style.width = '100%';
        saveBtn.style.marginTop = '16px';
        saveBtn.style.marginBottom = '16px';
        document.getElementById('extractionTable').after(saveBtn);
    }
    saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="save-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Metadata`;
    saveBtn.onclick = () => saveExtractionData(data);

    extractionConfidence.innerHTML = '';
}

async function saveExtractionData(originalData) {
    const inputs = document.querySelectorAll('.edit-input');
    const updateData = { ...originalData };
    delete updateData.type;
    delete updateData.confidence;
    delete updateData.doc_id;

    inputs.forEach(input => {
        let conf = parseInt(input.dataset.conf) || 0;
        updateData[input.dataset.key] = {
            "value": input.value,
            "confidence": conf
        };
    });

    const saveBtn = document.getElementById('saveExtractionBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API_BASE}/api/documents/${currentDocId}/extract`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata: updateData })
        });
        if (!res.ok) throw new Error('Failed to save data');
        showToast('Extraction data saved successfully!', 'success');
        saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="save-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Metadata`;
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
        saveBtn.textContent = 'Retry Save';
    } finally {
        saveBtn.disabled = false;
    }
}

function exportData(docId, format) {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/documents/${docId}/export?format=${format}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Exporting as ${format.toUpperCase()}...`, 'info');
}

const _originalResetPreview = resetPreview;
resetPreview = function () {
    _originalResetPreview();
    extractionLoading.style.display = 'none';
    extractionResults.style.display = 'none';
    extractDataBtn.disabled = false;

    const scanner = document.getElementById('imageScanner');
    if (scanner) scanner.style.display = 'none';

    document.querySelectorAll('.rp-tab').forEach(t => t.classList.remove('active'));
    const firstTab = document.querySelector('.rp-tab[data-target="textViewer"]');
    if (firstTab) firstTab.classList.add('active');

    document.getElementById('textViewer').classList.add('active-view');
    document.getElementById('textViewer').classList.remove('view-hidden');
    document.getElementById('extractionPanel').classList.add('view-hidden');
    document.getElementById('extractionPanel').classList.remove('active-view');

    layoutDataLoaded = false;
    currentLayoutPage = 1;

    const wrapper = document.getElementById('plainTextWrapper');
    if (wrapper) wrapper.style.display = 'flex';
    document.getElementById('layoutViewport').style.display = 'none';
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    const plainBtn = document.querySelector('.toggle-btn[data-view="plain"]');
    if (plainBtn) plainBtn.classList.add('active');
};

const _originalOpenDocument = openDocument;
openDocument = async function (docId) {
    await _originalOpenDocument(docId);
    layoutDataLoaded = false;
    currentLayoutPage = 1;
    try {
        const resp = await fetch(`${API_BASE}/api/documents/${docId}/extract`);
        if (resp.ok) {
            const data = await resp.json();
            if (data.type && data.type !== 'unknown') {
                renderExtractionResults(data);
            }
        }
    } catch (e) { }
};


// ═══ View Toggle & Layout Editing & Zoom ══════════════════════════════════════
let layoutDataLoaded = false;
let currentLayoutPage = 1;
let layoutZoom = 1;

const layoutCanvas = document.getElementById('layoutCanvas');
const layoutCanvasWrapper = document.getElementById('layoutCanvasWrapper');
const layoutLoading = document.getElementById('layoutLoading');
const layoutEmpty = document.getElementById('layoutEmpty');
const layoutInfo = document.getElementById('layoutInfo');
const layoutViewport = document.getElementById('layoutViewport');

document.getElementById('viewToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    const view = btn.dataset.view;

    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const wrapper = document.getElementById('plainTextWrapper');

    if (view === 'plain') {
        wrapper.style.display = 'flex';
        layoutViewport.style.display = 'none';
    } else {
        wrapper.style.display = 'none';
        layoutViewport.style.display = 'block';
        if (currentDocId && !layoutDataLoaded) {
            loadLayoutPage(currentDocId, 1);
        }
    }

    applyEditModeToCurrentView();
});

async function loadLayoutPage(docId, page) {
    layoutLoading.style.display = 'flex';
    layoutCanvas.style.display = 'none';
    layoutEmpty.style.display = 'none';

    try {
        const resp = await fetch(`${API_BASE}/api/documents/${docId}/layout?page=${page}`);
        if (!resp.ok) {
            layoutLoading.style.display = 'none';
            layoutEmpty.style.display = 'flex';
            return;
        }
        const data = await resp.json();
        currentLayoutData = data;
        layoutDataLoaded = true;
        renderLayout(data);
    } catch (err) {
        layoutLoading.style.display = 'none';
        layoutEmpty.style.display = 'flex';
    }
}

function renderLayout(data) {
    layoutLoading.style.display = 'none';
    layoutCanvas.style.display = 'block';

    const imgW = data.image_width || 1700;
    const imgH = data.image_height || 2200;
    const blocks = data.blocks || [];

    const viewportW = layoutViewport.clientWidth - 32;
    const scale = Math.min(viewportW / imgW, 1);
    const canvasW = Math.round(imgW * scale);
    const canvasH = Math.round(imgH * scale);

    layoutCanvas.style.width = canvasW + 'px';
    layoutCanvas.style.height = canvasH + 'px';
    layoutCanvas.innerHTML = '';

    layoutInfo.textContent = `${blocks.length} blocks \u00b7 ${imgW}\u00d7${imgH}px \u00b7 ${Math.round(scale * 100)}%`;

    blocks.forEach((block, idx) => {
        const el = document.createElement('div');
        el.className = 'layout-block';
        el.dataset.index = idx;

        if (block.confidence >= 0.8) el.classList.add('conf-high');
        else if (block.confidence >= 0.5) el.classList.add('conf-medium');
        else el.classList.add('conf-low');

        el.style.left = Math.round(block.x * scale) + 'px';
        el.style.top = Math.round(block.y * scale) + 'px';
        el.style.width = Math.round(block.width * scale) + 'px';
        el.style.height = Math.round(block.height * scale) + 'px';

        const fontSize = Math.max(8, Math.round(block.height * scale * 0.7));
        el.style.fontSize = fontSize + 'px';

        el.textContent = block.text;
        el.title = `Confidence: ${Math.round(block.confidence * 100)}%`;

        layoutCanvas.appendChild(el);
    });

    if (isEditMode) {
        applyEditModeToCurrentView();
    }
}

// ── Layout Pan and Zoom Handlers ──
function setupLayoutHandlers() {
    let isLayoutDragging = false;
    let layoutDragStartX = 0;
    let layoutDragStartY = 0;
    let layoutScrollStartX = 0;
    let layoutScrollStartY = 0;

    if (!layoutViewport) return;

    layoutViewport.addEventListener('wheel', (e) => {
        if (!layoutDataLoaded) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        layoutZoom = Math.max(0.25, Math.min(layoutZoom + delta, 5));

        layoutCanvasWrapper.style.transform = `scale(${layoutZoom})`;
        layoutInfo.textContent = `Zoom: ${Math.round(layoutZoom * 100)}%`;
    }, { passive: false });

    layoutViewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.classList.contains('layout-block')) return;
        isLayoutDragging = true;
        layoutDragStartX = e.clientX;
        layoutDragStartY = e.clientY;
        layoutScrollStartX = layoutViewport.scrollLeft;
        layoutScrollStartY = layoutViewport.scrollTop;
        layoutViewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isLayoutDragging) return;
        const dx = e.clientX - layoutDragStartX;
        const dy = e.clientY - layoutDragStartY;
        layoutViewport.scrollLeft = layoutScrollStartX - dx;
        layoutViewport.scrollTop = layoutScrollStartY - dy;
    });

    window.addEventListener('mouseup', () => {
        if (isLayoutDragging) {
            isLayoutDragging = false;
            layoutViewport.style.cursor = 'grab';
        }
    });
}

// ═══ Sidebar & Navigation ════════════════════════════════════════════════════
function setupSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    const openBtn = document.getElementById('sidebarOpenBtn');
    if (!sidebar || !collapseBtn) return;

    const savedState = localStorage.getItem('arkivo_sidebar_collapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
    }

    collapseBtn.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        localStorage.setItem('arkivo_sidebar_collapsed', 'true');
    });

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.remove('collapsed');
            localStorage.setItem('arkivo_sidebar_collapsed', 'false');
        });
    }

    const navItems = sidebar.querySelectorAll('.sidebar-nav-item:not(.sidebar-settings-btn)');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const id = item.id;
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            switchView(id);
        });
    });
}

function switchView(viewId) {
    const dashboardSection = document.getElementById('dashboardSection');
    const documentsSection = document.getElementById('documentsSection');
    const uploadSection = document.getElementById('uploadSection');
    const aiAssistantView = document.getElementById('aiAssistantView');

    if (dashboardSection) dashboardSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'none';
    if (uploadSection) uploadSection.style.display = 'none';
    if (aiAssistantView) aiAssistantView.style.display = 'none';

    if (viewId === 'navDashboard') {
        document.body.style.overflow = 'auto';
        if (dashboardSection) dashboardSection.style.display = 'block';
        updateDashboardStats();
    } else if (viewId === 'navAllDocs') {
        document.body.style.overflow = 'auto';
        if (uploadSection) uploadSection.style.display = 'block';
        if (documentsSection) documentsSection.style.display = 'grid';
        loadDocuments();
    } else if (viewId === 'navAIAssistant') {
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);
        if (aiAssistantView) aiAssistantView.style.display = 'block';
    }
}

// ═══ Dashboard Stats ════════════════════════════════════════════════════════
function countUp(el, target, duration = 900) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}

function setDashGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    const el = document.getElementById('dashGreeting');
    if (el) el.textContent = greeting + ' 👋';
    const dateEl = document.getElementById('dashDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

async function updateDashboardStats() {
    setDashGreeting();
    try {
        const response = await fetch(`${API_BASE}/api/documents`);
        if (!response.ok) return;
        const docs = await response.json();

        const total = docs.length;
        const totalPages = docs.reduce((s, d) => s + (d.page_count || 0), 0);
        const processed = docs.filter(d => d.status === 'completed').length;
        const failed = docs.filter(d => d.status === 'failed').length;
        const folders = docs.filter(d => d.file_type === 'folder').length;
        const extracted = docs.filter(d => d.extracted_metadata && Object.keys(d.extracted_metadata).length > 0).length;

        const getEl = (id) => document.getElementById(id);

        countUp(getEl('dashTotalDocs'), total);
        countUp(getEl('dashTotalPages'), totalPages, 1100);
        countUp(getEl('dashProcessed'), processed, 950);
        countUp(getEl('dashExtracted'), extracted, 1000);
        countUp(getEl('dashFailed'), failed, 800);
        countUp(getEl('dashFolders'), folders, 700);

        // Update header stats too
        if (document.getElementById('totalDocs')) totalDocs.textContent = total;
        if (document.getElementById('totalPages')) totalPages_el = document.getElementById('totalPages'), totalPages_el && (totalPages_el.textContent = totalPages);

        // Recent documents (last 10, sorted by most recent)
        const recent = [...docs]
            .filter(d => d.file_type !== 'folder')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);

        const countEl = document.getElementById('dashRecentCount');
        if (countEl) countEl.textContent = recent.length;

        const recentEl = document.getElementById('dashRecentDocs');
        if (!recentEl) return;

        if (recent.length === 0) {
            recentEl.innerHTML = `<div class="dash-empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 9 21 9"/></svg>
                <p>No documents yet</p>
                <button class="btn btn-accent" style="margin-top:8px;font-size:.78rem;padding:6px 14px;" onclick="document.getElementById('navAllDocs').click()">Upload your first document</button>
            </div>`;
            return;
        }

        const statusBadge = (status) => {
            const map = {
                completed: { cls: 'badge-success', label: 'Completed' },
                failed: { cls: 'badge-danger', label: 'Failed' },
                processing: { cls: 'badge-warning', label: 'Processing' },
            };
            const s = map[status] || { cls: 'badge-muted', label: capitalize(status) };
            return `<span class="recent-badge ${s.cls}">${s.label}</span>`;
        };

        const typeIcon = (type) => {
            const colors = { pdf: '#EF4444', png: '#8B5CF6', jpg: '#F59E0B', jpeg: '#F59E0B' };
            const color = colors[type] || 'var(--text-muted)';
            return `<div class="recent-item-icon" style="color:${color};border-color:${color}22;background:${color}11;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 9 21 9"/></svg>
            </div>`;
        };

        recentEl.innerHTML = recent.map((doc, i) => `
            <div class="dashboard-recent-item" onclick="openDocument(${doc.id})" style="animation-delay:${i * 40}ms">
                ${typeIcon(doc.file_type)}
                <div class="recent-item-info">
                    <span class="recent-item-name" title="${escapeAttr(doc.original_filename)}">${escapeHtml(doc.original_filename)}</span>
                    <span class="recent-item-meta">${doc.file_type.toUpperCase()} &middot; ${formatDate(doc.created_at)}</span>
                </div>
                ${statusBadge(doc.status)}
            </div>
        `).join('');
    } catch (err) {
        console.error('Dashboard stats error:', err);
    }
}



// ═══ AI Assistant Handlers ══════════════════════════════════════════════════
function setupAssistantHandlers() {
    const assistantSendBtn = document.getElementById('assistantSendBtn');
    const assistantChatInput = document.getElementById('assistantChatInput');
    if (!assistantSendBtn || !assistantChatInput) return;

    assistantSendBtn.addEventListener('click', () => sendAssistantMessage());
    assistantChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAssistantMessage();
    });

    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            assistantChatInput.value = btn.dataset.query || btn.textContent;
            sendAssistantMessage();
        });
    });
}

async function sendAssistantMessage() {
    const assistantChatInput = document.getElementById('assistantChatInput');
    const message = assistantChatInput.value.trim();
    if (!message) return;

    assistantChatInput.value = '';
    renderChatMessage('user', message);
    const typingId = renderTypingIndicator();

    try {
        const response = await fetch(`${API_BASE}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: message })
        });

        if (!response.ok) throw new Error('Assistant API failed');
        const data = await response.json();

        removeTypingIndicator(typingId);
        renderChatMessage('assistant', data.message, data.results);

    } catch (error) {
        if (typeof typingId !== 'undefined') removeTypingIndicator(typingId);
        renderChatMessage('assistant', 'Sorry, I encountered an error communicating with the AI.');
        showToast('Assistant Error', 'error');
        console.error(error);
    }
}

function formatMarkdown(text) {
    if (!text) return '';
    // Bold: **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Newlines to <br>
    text = text.replace(/\n/g, '<br>');
    return text;
}

function renderChatMessage(role, content, results = []) {
    const assistantChatHistory = document.getElementById('assistantChatHistory');
    if (!assistantChatHistory) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message message-${role}`;
    msgDiv.innerHTML = `<div class="message-content">${formatMarkdown(content)}</div>`;

    if (results && results.length > 0) {
        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'assistant-results-grid';

        results.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.innerHTML = `
                <div class="doc-card-header">
                    <span class="doc-card-title">${doc.original_filename}</span>
                </div>
                <div class="doc-card-thumbnail">
                    <img src="${API_BASE}/api/documents/${doc.id}/preview" alt="Preview">
                </div>
            `;
            card.onclick = () => openDocument(doc.id);
            resultsGrid.appendChild(card);
        });
        msgDiv.appendChild(resultsGrid);
    }

    assistantChatHistory.appendChild(msgDiv);
    assistantChatHistory.scrollTop = assistantChatHistory.scrollHeight;

    const welcome = assistantChatHistory.querySelector('.assistant-welcome');
    if (welcome && role === 'user') welcome.style.display = 'none';
}

function renderTypingIndicator() {
    const assistantChatHistory = document.getElementById('assistantChatHistory');
    if (!assistantChatHistory) return;
    const id = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = id;
    typingDiv.className = 'chat-message message-assistant typing-indicator';
    typingDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    assistantChatHistory.appendChild(typingDiv);
    assistantChatHistory.scrollTop = assistantChatHistory.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}
