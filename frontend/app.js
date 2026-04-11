/**
 * Arkivo AI — Frontend Application Logic
 * ==========================================
 */

const API_BASE = window.location.origin;

// ═══ Authentication Interceptor ════════════════════════════════════════════
const originalFetch = window.fetch;
window.fetch = async function (resource, config = {}) {
    // Only intercept our API requests
    const isApiRequest = typeof resource === 'string' && (resource.startsWith('/api') || resource.includes(API_BASE + '/api'));

    if (isApiRequest) {
        const token = localStorage.getItem('token');
        if (token) {
            if (!config.headers) config.headers = {};

            // Handle Headers object or plain object
            if (config.headers instanceof Headers) {
                if (!config.headers.has('Authorization')) config.headers.append('Authorization', 'Bearer ' + token);
            } else {
                if (!config.headers['Authorization']) config.headers['Authorization'] = 'Bearer ' + token;
            }
        }
    }

    const response = await originalFetch(resource, config);

    if (response.status === 401 && isApiRequest && (!resource.includes('/auth/login') && !resource.includes('/auth/register'))) {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }
    return response;
};

// ═══ Global User Context ═══════════════════════════════════════════════════
let currentUser = null;

async function checkUserContext() {
    try {
        const res = await fetch(`${API_BASE}/api/auth/me`);
        if (res.ok) {
            currentUser = await res.json();
            document.body.setAttribute('data-role', currentUser.role);

            const avatarBtn = document.getElementById('userDropdownBtn');
            const dropName = document.getElementById('dropdownUserName');
            const dropEmail = document.getElementById('dropdownUserEmail');
            const dropOrg = document.getElementById('dropdownUserOrg');

            if (avatarBtn) avatarBtn.textContent = currentUser.name.charAt(0).toUpperCase();
            if (dropName) dropName.textContent = currentUser.name;
            if (dropEmail) dropEmail.textContent = currentUser.email;
            if (dropOrg) dropOrg.textContent = currentUser.organization.name + (currentUser.role === 'admin' ? ' (Admin)' : '');

            const inviteContainer = document.getElementById('inviteCodeContainer');
            const dropInviteCode = document.getElementById('dropdownInviteCode');
            if (currentUser.role === 'admin' && currentUser.organization && currentUser.organization.invite_code) {
                if (inviteContainer) {
                    inviteContainer.style.display = 'flex';
                    if (dropInviteCode) dropInviteCode.textContent = currentUser.organization.invite_code;
                }
            } else {
                if (inviteContainer) inviteContainer.style.display = 'none';
            }

            if (avatarBtn) {
                avatarBtn.onclick = function (e) {
                    e.stopPropagation();
                    const menu = document.getElementById('userDropdownMenu');
                    if (menu) menu.style.display = menu.style.display === 'none' || !menu.style.display ? 'block' : 'none';
                };

                document.addEventListener('click', function () {
                    const menu = document.getElementById('userDropdownMenu');
                    if (menu && menu.style.display === 'block') {
                        menu.style.display = 'none';
                    }
                });
            }
        }
    } catch (err) {
        console.error("Failed to load user context", err);
    }
}

window.copyInviteCode = function () {
    const code = document.getElementById('dropdownInviteCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copyInviteBtn');
        if (btn) {
            const origText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.style.background = 'var(--success, #10B981)';
            setTimeout(() => {
                btn.textContent = origText;
                btn.style.background = '#4F46E5';
            }, 2000);
        }
    }).catch(console.error);
};

function handleLogout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// Call checkUserContext on load
document.addEventListener('DOMContentLoaded', checkUserContext);

// ═══ i18n Dictionary ════════════════════════════════════════════════════════
const dictionary = {
    "Dashboard": "Paneli",
    "All Documents": "Të Gjitha Dokumentet",
    "AI Assistant": "Asistenti AI",
    "Settings": "Cilësimet",
    "Documents": "Dokumentet",
    "Pages Processed": "Faqe të Procesuara",
    "Good day 👋": "Përshëndetje 👋",
    "Upload Document": "Ngarko Dokument",
    "Total Documents": "Dokumentet Totale",
    "Total Pages": "Faqet Totale",
    "Processed (OCR)": "Procesuar (OCR)",
    "AI Extracted": "AI Ekstraktuar",
    "Failed": "Dështuar",
    "PDF Folders": "Dosjet PDF",
    "Quick Actions": "Veprime të Shpejta",
    "Add new PDF, JPG or PNG": "Shto PDF, JPG ose PNG",
    "Browse & manage your files": "Shfleto & menaxho skedarët",
    "Ask questions about your docs": "Bëj pyetje për dokumentet e tua",
    "Export All Data": "Eksporto Të Gjitha",
    "Download CSV, Excel or TXT": "Shkarko CSV, Excel ose TXT",
    "Recent Documents": "Dokumentet e Fundit",
    "OCR Language:": "Gjuha OCR:",
    "Auto (Multi-Language)": "Auto (Shumë Gjuhë)",
    "English": "Anglisht",
    "Drop your document here": "Tërhiq dokumentin këtu",
    "or": "ose",
    "browse files": "shfleto skedarët",
    "Supports PDF, JPG, PNG — Max 20 MB (Multiple supported)": "Mbështet PDF, JPG, PNG — Max 20 MB",
    "Your Documents": "Dokumentet e Tua",
    "Export All": "Eksporto",
    "Export as CSV": "Eksporto si CSV",
    "Export as Excel": "Eksporto si Excel",
    "Export as Text": "Eksporto si Tekst",
    "Instant local search...": "Kërkim i shpejtë lokal...",
    "Advanced Filters": "Filtrat e Avancuar",
    "Clear All": "Pastro të Gjitha",
    "Document Type": "Lloji i Dokumentit",
    "All Types": "Të Gjitha Llojet",
    "Invoice": "Faturë",
    "Contract": "Kontratë",
    "Report": "Raport",
    "Other": "Tjetër",
    "Date From": "Nga Data",
    "Date To": "Deri Data",
    "Company": "Kompania",
    "e.g. Acme Corp": "p.sh. Acme Corp",
    "Client Name": "Emri Klientit",
    "e.g. John Doe": "p.sh. John Doe",
    "Apply Filters": "Apliko Filtrat",
    "Export Results (.xlsx)": "Eksporto Rezultatet (.xlsx)",
    "Export Results": "Eksporto Rezultatet",
    "No documents yet": "Nuk ka dokumente",
    "Upload your first document to get started": "Ngarko dokumentin e parë për të filluar",
    "AI Assistant — Ready": "Asistenti AI — Gati",
    "Clear": "Pastro",
    "Arkivo AI Assistant": "Asistenti Arkivo AI",
    "Ask anything about your documents. I can search, summarize, and find specific data across all your files.": "Pyet çfarëdo rreth dokumenteve të tua. Mund të kërkoj, përmbledh dhe gjej të dhëna specifike.",
    "Invoices from 2026": "Faturat e 2026",
    "Find Contracts": "Gjej Kontratat",
    "Document Summary": "Përmbledhje e Dokumenteve",
    "Last Month's Docs": "Dokumentet e muajit të kaluar",
    "Ask anything about your documents...": "Bëj pyetje rreth dokumenteve...",
    "Press Enter to send · AI may make mistakes — verify important info": "Shtyp Enter për të dërguar · AI mund të bëjë gabime — verifiko",
    "Configure your Arkivo AI workspace": "Konfiguro hapësirën tënde të Arkivo AI",
    "AI & API": "AI & API",
    "OpenRouter connection and model settings": "Lidhja e OpenRouter dhe cilësimet e modelit",
    "OpenRouter API Key": "Çelësi API i OpenRouter",
    "Get your key from": "Merrni çelësin tuaj nga",
    "AI Model": "Modeli AI",
    "Model used for all AI extraction and assistant queries": "Modeli i përdorur për nxjerrjen e AI dhe pyetjet e asistentit",
    "Response Temperature": "Temperatura e Përgjigjes",
    "Precise": "E saktë",
    "Creative": "Krijuese",
    "OCR Settings": "Cilësimet OCR",
    "Text extraction configuration": "Konfigurimi i nxjerrjes së tekstit",
    "Default OCR Language": "Gjuha e parazgjedhur OCR",
    "Auto-Extract on Upload": "Nxirr automatikisht pas ngarkimit",
    "Run AI extraction automatically after every upload": "Ekzekuto nxjerrjen automatikisht pas çdo ngarkimi",
    "May slow down uploads for large files": "Mund të ngadalësojë ngarkimet për skedarë të mëdhenj",
    "Max Upload File Size": "Madhësia maksimale e skedarit",
    "Export & Storage": "Eksporti dhe Hapësira Ruajtëse",
    "Default export format and storage info": "Formati i parazgjedhur i eksportit dhe infoja e hapësirës",
    "Default Export Format": "Formati i Parazgjedhur i Eksportit",
    "Excel": "Excel",
    "CSV": "CSV",
    "TXT": "TXT",
    "Storage Usage": "Përdorimi i Hapësirës Ruajtëse",
    "Danger Zone": "Zona e Rrezikut",
    "Delete All Documents": "Fshi Të Gjitha Dokumentet",
    "Appearance": "Pamja",
    "Theme and display preferences": "Tema dhe preferencat e ekranit",
    "Theme": "Tema",
    "Dark": "E Errët",
    "Light": "E Ndritshme",
    "About Arkivo AI": "Rreth Arkivo AI",
    "Version and system info": "Versioni dhe informacioni i sistemit",
    "Version": "Versioni",
    "API Status": "Statusi i API",
    "Save Settings": "Ruaj Cilësimet",
    "Document Name": "Emri i Dokumentit",
    "Preview": "Pamje Paraprake",
    "Text": "Tekst",
    "Extracted Text": "Teksti i Nxjerrë",
    "AI Data Extraction": "Nxjerrja e të Dhënave me AI",
    "Edit mode active. Click text to edit.": "Modaliteti i modifikimit është aktiv. Kliko në tekst për t'a modifikuar.",
    "Cancel": "Anulo",
    "Save": "Ruaj",
    "Edit": "Modifiko",
    "Copy": "Kopjo",
    "Original": "Kopja Origjinale",
    "Loading preview…": "Po ngarkon pamjen paraprake…",
    "Preview not available": "Pamja paraprake nuk disponohet",
    "Loading layout…": "Po ngarkon paraqitjen…",
    "No layout data. Upload a new document to generate.": "S'ka paraqitje. Ngarkoni dokument të ri për ta krijuar.",
    "Invoice Number": "Numri i Faturës",
    "Date": "Data",
    "Due Date": "Afati i Pagesës",
    "Expiry Date": "Data e Skadimit",
    "Total Amount": "Shuma Totale",
    "Currency": "Monedha",
    "N/A": "N/A",
    "AI Extraction Confidence": "Besueshmëria e Nxjerrjes AI",
    "Save Metadata": "Ruaj të Dhënat",
    "INVOICE": "FATURË",
    "Extract Data": "Nxirr të Dhënat",
    "Export Data": "Eksporto të Dhënat",
    "Export to CSV": "Eksporto në CSV",
    "Export to Excel": "Eksporto në Excel",
    "Export to Text": "Eksporto në Tekst",
    "Field": "Fusha",
    "Value": "Vlera"
};

let i18nNodes = new Map();

function initI18n() {
    function walkAndStore(node) {
        if (node.nodeType === 3) {
            let originalText = node.nodeValue;
            let trimmed = originalText.trim();
            if (trimmed && dictionary[trimmed]) {
                i18nNodes.set(node, { type: 'text', original: originalText, trimmed: trimmed });
            }
        } else if (node.nodeType === 1) {
            if (node.placeholder && dictionary[node.placeholder]) {
                i18nNodes.set(node, { type: 'placeholder', original: node.placeholder, trimmed: node.placeholder });
            }
            if (['SCRIPT', 'STYLE'].includes(node.nodeName)) return;
            for (let child of node.childNodes) {
                walkAndStore(child);
            }
        }
    }

    walkAndStore(document.body);

    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
        langBtn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            let currentLang = localStorage.getItem('arkivo_lang') || 'en';
            let newLang = currentLang === 'en' ? 'sq' : 'en';
            applyLanguage(newLang);
        };
    }

    let savedLang = localStorage.getItem('arkivo_lang') || 'en';
    if (savedLang === 'sq') {
        applyLanguage('sq');
    }
}

function applyLanguage(lang) {
    i18nNodes.forEach((val, node) => {
        let trans = (lang === 'sq' && dictionary[val.trimmed]) ? dictionary[val.trimmed] : val.trimmed;

        if (val.type === 'placeholder') {
            node.placeholder = trans;
        } else if (val.type === 'text') {
            node.nodeValue = val.original.replace(val.trimmed, trans);
        }
    });

    const btn = document.getElementById('langToggleBtn');
    if (btn) btn.textContent = lang === 'sq' ? 'AL' : 'EN';
    localStorage.setItem('arkivo_lang', lang);
}

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
    initI18n(); // Setup language dictionary first
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
});

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
            if (exportAllDropdownMenu) exportAllDropdownMenu.style.display = 'none';
            const folderMenu = document.getElementById('folderExportAllDropdownMenu');
            if (folderMenu) folderMenu.style.display = 'none';
            const langMenu = document.getElementById('langDropdownMenu');
            if (langMenu) langMenu.style.display = 'none';

            // Close AI export menus
            document.querySelectorAll('.ai-export-menu').forEach(m => m.classList.remove('show'));
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

    // Read settings
    const appSettings = getSettings();
    const autoExtract = appSettings.autoExtract || false;
    const maxSizeMB = parseInt(appSettings.maxSize || '20', 10);
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    uploadProgress.style.display = 'block';

    const uploadedDocIds = [];

    for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const ext = file.name.split('.').pop().toLowerCase();

        if (!allowedExts.includes(ext) || file.size > maxSizeBytes) {
            failCount++;
            continue;
        }

        uploadFileName.textContent = `[${i + 1}/${fileArray.length}] ${file.name}`;
        uploadStatus.textContent = 'Uploading & OCR...';
        uploadStatus.className = 'progress-status';
        progressBarFill.style.width = '0%';
        progressBarFill.style.background = 'var(--text-primary)';

        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 85) {
                progress += Math.random() * 15;
                progressBarFill.style.width = Math.min(progress, 85) + '%';
            }
        }, 200);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const lang = document.getElementById('ocrLang').value || appSettings.ocrLang || 'latin';
            const response = await fetch(`${API_BASE}/api/documents/upload?lang=${lang}`, {
                method: 'POST', body: formData,
            });

            clearInterval(progressInterval);
            progressBarFill.style.width = '90%';

            if (response.ok) {
                const doc = await response.json();
                if (doc.status === 'completed') {
                    successCount++;
                    // Collect IDs for auto-extract
                    if (doc.file_type === 'folder' && doc.children) {
                        doc.children.forEach(c => uploadedDocIds.push(c.id));
                    } else {
                        uploadedDocIds.push(doc.id);
                    }
                } else {
                    failCount++;
                }
            } else {
                failCount++;
            }
        } catch (err) {
            clearInterval(progressInterval);
            failCount++;
        }
    }

    // ── Auto-Extract if enabled ───────────────────────────────────────────────
    if (autoExtract && uploadedDocIds.length > 0) {
        uploadStatus.textContent = `🤖 AI Extracting (${uploadedDocIds.length} docs)...`;
        progressBarFill.style.width = '90%';

        // Also fetch children of folder docs that were just uploaded
        const allExtractIds = [];
        for (const id of uploadedDocIds) {
            try {
                const childRes = await fetch(`${API_BASE}/api/documents/${id}/children`);
                if (childRes.ok) {
                    const children = await childRes.json();
                    if (children.length > 0) {
                        children.forEach(c => allExtractIds.push(c.id));
                    } else {
                        allExtractIds.push(id);
                    }
                } else {
                    allExtractIds.push(id);
                }
            } catch {
                allExtractIds.push(id);
            }
        }

        let extracted = 0;
        for (let i = 0; i < allExtractIds.length; i++) {
            const docId = allExtractIds[i];
            uploadStatus.textContent = `🤖 AI Extracting ${i + 1}/${allExtractIds.length}...`;
            progressBarFill.style.width = (90 + (10 * (i + 1) / allExtractIds.length)) + '%';
            try {
                const extractRes = await fetch(`${API_BASE}/api/documents/${docId}/extract`, { method: 'POST' });
                if (extractRes.ok) extracted++;
            } catch { /* skip */ }
        }
        uploadStatus.textContent = `✓ Done — OCR + AI extracted ${extracted} doc(s)`;
    } else {
        uploadStatus.textContent = '✓ Upload Completed';
    }

    progressBarFill.style.width = '100%';
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
                <img src="${API_BASE}/api/documents/${doc.id}/preview?page=1&token=${localStorage.getItem('token')}&t=${doc.created_at ? new Date(doc.created_at).getTime() : Date.now()}" alt="Thumbnail" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);\\'>Preview Error</div>';">
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
    img.src = `${API_BASE}/api/documents/${docId}/preview?page=${page}&token=${localStorage.getItem('token')}&t=${cacheBuster}`;
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
const exportFilteredMenuBtn = document.getElementById('exportFilteredMenuBtn');
const exportFilteredDropdownMenu = document.getElementById('exportFilteredDropdownMenu');

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

    // --- Custom Document Type Dropdown Logic ---
    const filterDocTypeMenuBtn = document.getElementById('filterDocTypeMenuBtn');
    const filterDocTypeDropdownMenu = document.getElementById('filterDocTypeDropdownMenu');
    const docTypeOptions = document.querySelectorAll('.doc-type-option');
    const filterDocTypeHidden = document.getElementById('filterDocType');
    const filterDocTypeSelectedText = document.getElementById('filterDocTypeSelectedText');

    if (filterDocTypeMenuBtn && filterDocTypeDropdownMenu) {
        filterDocTypeMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = filterDocTypeDropdownMenu.style.display === 'flex';
            filterDocTypeDropdownMenu.style.display = isOpen ? 'none' : 'flex';
        });

        docTypeOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.getAttribute('data-value');
                const text = opt.textContent.trim();
                if (filterDocTypeHidden) filterDocTypeHidden.value = val;
                if (filterDocTypeSelectedText) filterDocTypeSelectedText.textContent = text;
                filterDocTypeDropdownMenu.style.display = 'none';
            });
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => performAdvancedSearch(false));
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            document.getElementById('filterDocType').value = '';
            document.getElementById('filterDocTypeSelectedText').textContent = 'All Types';
            document.getElementById('filterDateFrom').value = '';
            document.getElementById('filterDateTo').value = '';
            document.getElementById('filterCompany').value = '';
            document.getElementById('filterClient').value = '';
            searchInput.value = '';
            currentActiveFilters = {};
            loadDocuments();
        });
    }

    if (exportFilteredMenuBtn && exportFilteredDropdownMenu) {
        exportFilteredMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (Object.keys(currentActiveFilters).length === 0 && !searchInput.value) {
                showToast('Please apply filters or search before exporting.', 'warning');
                return;
            }
            exportFilteredDropdownMenu.style.display = exportFilteredDropdownMenu.style.display === 'flex' ? 'none' : 'flex';
        });

        document.addEventListener('click', () => {
            exportFilteredDropdownMenu.style.display = 'none';
        });

        document.querySelectorAll('.export-dropdown-item[data-export-filtered]').forEach(item => {
            item.addEventListener('click', (e) => {
                const format = e.target.closest('.export-dropdown-item').dataset.exportFiltered;
                exportCustomFiltered(format);
                exportFilteredDropdownMenu.style.display = 'none';
            });
        });
    }
}

async function performAdvancedSearch(useAIQuery = false, customQuery = null) {
    const query = customQuery !== null ? customQuery : searchInput.value.trim();
    let bodyData = {};

    if (useAIQuery && query) {
        bodyData = { query: query };

        try {
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            applyAIFiltersToUI(data.filters, data.results);
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

function applyAIFiltersToUI(filters, results) {
    // 1. Switch to Documents view (using click to trigger all sidebar logic)
    const navDocs = document.getElementById('navAllDocs');
    if (navDocs) {
        navDocs.click();
    } else {
        switchView('navAllDocs');
    }

    // 2. Populate inputs (small delay to ensure DOM is ready/visible)
    setTimeout(() => {
        const f = filters || {};
        const docTypeEl = document.getElementById('filterDocType');
        const companyEl = document.getElementById('filterCompany');
        const clientEl = document.getElementById('filterClient');
        const drFromEl = document.getElementById('filterDateFrom');
        const drToEl = document.getElementById('filterDateTo');

        if (docTypeEl) docTypeEl.value = f.document_type || '';
        if (companyEl) companyEl.value = f.company || '';
        if (clientEl) clientEl.value = f.client_name || '';
        if (f.date_range) {
            if (drFromEl) drFromEl.value = f.date_range.from || '';
            if (drToEl) drToEl.value = f.date_range.to || '';
        }

        // Update labels for dropdowns
        const dtText = document.getElementById('filterDocTypeSelectedText');
        if (dtText) {
            const val = f.document_type || '';
            dtText.textContent = (val && val !== 'other') ? val.charAt(0).toUpperCase() + val.slice(1) : 'All Types';
        }

        // 3. Open drawer
        const advDrawer = document.getElementById('advancedFilterDrawer');
        if (advDrawer) advDrawer.style.display = 'block';

        const togFiltersBtn = document.getElementById('toggleFiltersBtn');
        if (togFiltersBtn) {
            togFiltersBtn.style.background = 'var(--bg-secondary)';
            const svg = togFiltersBtn.querySelector('svg');
            if (svg) svg.style.transform = 'rotate(180deg)';
        }

        // 4. Update grid
        currentActiveFilters = f;
        if (results) {
            renderDocuments(results);
            showToast(`Applied ${results.length} filters from AI`, 'success');
        }
    }, 100);
}

async function exportCustomFiltered(fmt = 'excel') {
    const format = fmt;
    const btn = document.getElementById('exportFilteredMenuBtn');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="preview-spinner" style="width:14px;height:14px;borderWidth:2px;margin-right:6px"></div> Exporting...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/export/custom?format=${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: currentActiveFilters })
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
        btn.innerHTML = originalText;
        btn.disabled = false;
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

    const t = (key) => dictionary && dictionary[key] ? dictionary[key] : key;

    const docType = data.type || 'other';
    extractionTypeBadge.textContent = t(docType.toUpperCase()) || docType.toUpperCase();
    extractionTypeBadge.className = `extraction-type-badge type-${docType}`;

    const fields = [
        { label: t('Invoice Number'), key: 'invoice_number', data: data.invoice_number },
        { label: t('Date'), key: 'date', data: data.date },
        { label: t('Due Date'), key: 'due_date', data: data.due_date },
        { label: t('Expiry Date'), key: 'expiry_date', data: data.expiry_date },
        { label: t('Total Amount'), key: 'total_amount', data: data.total_amount },
        { label: t('Currency'), key: 'currency', data: data.currency },
        { label: t('Company'), key: 'company', data: data.company },
        { label: t('Client Name'), key: 'client_name', data: data.client_name }
    ];

    extractionTableBody.innerHTML = `
        <tr>
            <td>${t('Document Type')}</td>
            <td><strong>${escapeHtml(capitalize(docType))}</strong></td>
        </tr>
    ` + fields.map(f => {
        let val = f.data ? f.data.value : '';
        let conf = f.data ? f.data.confidence : 0;
        let badgeColor = conf >= 80 ? 'var(--success)' : conf >= 60 ? 'var(--warning)' : 'var(--danger)';
        let displayConf = conf > 0 ? `${conf}%` : t('N/A');
        return `
        <tr>
            <td style="vertical-align: middle;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${escapeHtml(f.label)}</span>
                    <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: ${badgeColor};" title="${t('AI Extraction Confidence')}">
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
    saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="save-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> ${t('Save Metadata')}`;
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

    const navItems = sidebar.querySelectorAll('.sidebar-nav-item');
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
    const settingsView = document.getElementById('settingsView');

    if (dashboardSection) dashboardSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'none';
    if (uploadSection) uploadSection.style.display = 'none';
    if (aiAssistantView) aiAssistantView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';

    // Update Sidebar Active State (for direct calls like switchView('navAllDocs'))
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
        if (item.id === viewId) item.classList.add('active');
        else item.classList.remove('active');
    });

    // Remove AI view body class on every switch
    document.body.classList.remove('ai-view-active');

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
        document.body.classList.add('ai-view-active');
        window.scrollTo(0, 0);
        if (aiAssistantView) aiAssistantView.style.display = 'block';
    } else if (viewId === 'navSettings') {
        document.body.classList.remove('ai-view-active');
        document.body.style.overflow = 'auto';
        if (settingsView) settingsView.style.display = 'block';
        loadSettingsPage();
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
            recentEl.innerHTML = `<div class="dash-empty-state" style="padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary); margin-bottom: 12px; filter: drop-shadow(0 0 10px rgba(79, 70, 229, 0.3));"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path></svg>
                <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">No documents yet</h3>
                <p style="font-size: 0.9rem; color: var(--text-secondary); max-width: 300px; margin: 0 auto 16px; line-height: 1.4;">Start by uploading your first document to unlock AI insights</p>
                <button class="btn btn-accent" style="font-size:.85rem; padding:8px 18px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);" onclick="document.getElementById('navAllDocs').click()">Upload Document</button>
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
    const sendBtn = document.getElementById('assistantSendBtn');
    const input = document.getElementById('assistantChatInput');
    const clearBtn = document.getElementById('clearChatBtn');

    if (!sendBtn || !input) return;

    sendBtn.addEventListener('click', () => sendAssistantMessage());
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) sendAssistantMessage();
    });

    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.dataset.query || btn.textContent.trim();
            sendAssistantMessage();
        });
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const history = document.getElementById('assistantChatHistory');
            // Remove all messages but keep welcome
            history.querySelectorAll('.chat-message, .chat-row').forEach(el => el.remove());
            const welcome = document.getElementById('assistantWelcome');
            if (welcome) welcome.style.display = 'flex';
        });
    }
}

async function sendAssistantMessage() {
    const input = document.getElementById('assistantChatInput');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.disabled = true;

    // Hide welcome
    const welcome = document.getElementById('assistantWelcome');
    if (welcome) welcome.style.display = 'none';

    appendChatRow('user', message);
    const typingId = appendTypingIndicator();

    try {
        const currentLangKey = localStorage.getItem('arkivo_lang') || 'en';
        const langMap = { 'en': 'English', 'sq': 'Albanian', 'ar': 'Arabic' };
        const aiLang = langMap[currentLangKey] || 'English';

        const response = await fetch(`${API_BASE}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: message, language: aiLang })
        });

        if (!response.ok) throw new Error('Assistant API failed');
        const data = await response.json();

        removeTypingIndicator(typingId);
        appendChatRow('assistant', data.message, data.results || []);

        // Apply filters to UI and navigate ONLY if detected as an action or explicit search
        if (data.filters && Object.keys(data.filters).length > 0 && (data.mode === 'action' || data.mode === 'search')) {
            // For advisor mode, we skip taking over the UI so the user can read the financial advice in the chat
            setTimeout(() => {
                applyAIFiltersToUI(data.filters, data.results);
            }, 800);
        }

    } catch (error) {
        removeTypingIndicator(typingId);
        appendChatRow('assistant', '⚠️ Sorry, I encountered an error. Please try again.', []);
        console.error(error);
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// ── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
    if (!text) return '';
    let html = text
        // Escape HTML
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // Bold + italic: ***text***
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        // Bold: **text**
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic: *text*
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Code: `text`
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Process line by line for lists and headings
    const lines = html.split('\n');
    const out = [];
    let inList = false;
    let inNumberedList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^### (.+)/.test(trimmed)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (inNumberedList) { out.push('</ol>'); inNumberedList = false; }
            out.push('<h4>' + trimmed.replace(/^### /, '') + '</h4>');
        } else if (/^## (.+)/.test(trimmed)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (inNumberedList) { out.push('</ol>'); inNumberedList = false; }
            out.push('<h3>' + trimmed.replace(/^## /, '') + '</h3>');
        } else if (/^# (.+)/.test(trimmed)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (inNumberedList) { out.push('</ol>'); inNumberedList = false; }
            out.push('<h2>' + trimmed.replace(/^# /, '') + '</h2>');
        } else if (/^[-*•] (.+)/.test(trimmed)) {
            if (!inList) { out.push('<ul>'); inList = true; }
            if (inNumberedList) { out.push('</ol>'); inNumberedList = false; }
            out.push('<li>' + trimmed.replace(/^[-*•] /, '') + '</li>');
        } else if (/^\d+\. (.+)/.test(trimmed)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (!inNumberedList) { out.push('<ol>'); inNumberedList = true; }
            out.push('<li>' + trimmed.replace(/^\d+\. /, '') + '</li>');
        } else if (trimmed === '') {
            if (inList) { out.push('</ul>'); inList = false; }
            if (inNumberedList) { out.push('</ol>'); inNumberedList = false; }
            if (out.length > 0 && out[out.length - 1] !== '<br>') out.push('<br>');
        } else {
            if (inList) { out.push('</ul>'); inList = false; }
            if (inNumberedList) { out.push('</ol>'); inNumberedList = false; }
            out.push('<p>' + line + '</p>');
        }
    }

    if (inList) out.push('</ul>');
    if (inNumberedList) out.push('</ol>');

    return out.join('');
}

// ── Chat Row Builder ─────────────────────────────────────────────────────────
function appendChatRow(role, content, results = []) {
    const history = document.getElementById('assistantChatHistory');
    if (!history) return;

    const row = document.createElement('div');
    row.className = `chat-row chat-row-${role}`;

    if (role === 'assistant') {
        row.innerHTML = `
            <div class="chat-avatar-ai">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
            </div>
            <div class="chat-bubble-ai">
                <div class="chat-markdown">${renderMarkdown(content)}</div>
                ${results.length > 0 ? buildDocCards(results) : ''}
            </div>`;
    } else {
        row.innerHTML = `
            <div class="chat-bubble-user">${escapeHtml(content)}</div>`;
    }

    history.appendChild(row);
    history.scrollTop = history.scrollHeight;
}

function buildDocCards(results) {
    if (!results || results.length === 0) return '';

    const cards = results.slice(0, 12).map(doc => {
        const meta = doc.extracted_metadata || {};
        const getVal = (k) => {
            const v = meta[k];
            if (!v) return '';
            return typeof v === 'object' ? (v.value || '') : v;
        };
        const type = (doc.doc_type || doc.file_type || 'doc').toUpperCase();
        const company = getVal('company') || getVal('vendor_company') || '';
        const amount = getVal('total_amount') ? `${getVal('total_amount')} ${getVal('currency') || ''}`.trim() : '';
        const date = getVal('issue_date') || getVal('date') || '';

        const typeColors = {
            'INVOICE': '#3b82f6', 'CONTRACT': '#8b5cf6', 'REPORT': '#10b981',
            'PDF': '#f59e0b', 'JPG': '#06b6d4', 'PNG': '#06b6d4'
        };
        const color = typeColors[type] || '#6b7280';

        return `<div class="result-doc-card" onclick="openDocument(${doc.id})" title="Open document">
            <div class="rdc-type" style="background:${color}22;color:${color}">${type}</div>
            <div class="rdc-name">${escapeHtml(doc.original_filename || 'Document')}</div>
            ${company ? `<div class="rdc-meta">${escapeHtml(company)}</div>` : ''}
            ${amount ? `<div class="rdc-amount">${escapeHtml(amount)}</div>` : ''}
            ${date ? `<div class="rdc-date">${escapeHtml(date)}</div>` : ''}
        </div>`;
    }).join('');

    const sectionId = 'ai-export-' + Date.now();
    const docIds = results.map(d => d.id).join(',');

    return `<div class="result-docs-section">
        <div class="result-docs-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="result-docs-label" style="margin-bottom: 0;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${results.length} Matched Document${results.length !== 1 ? 's' : ''}
            </div>
            
            <div class="ai-export-wrapper" style="position: relative;">
                <button class="btn-ai-export" onclick="toggleAiExportMenu('${sectionId}', event)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>Export Results</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div id="${sectionId}" class="ai-export-menu">
                    <button class="ai-export-item" onclick="exportAIViaId('${docIds}', 'csv')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="9" x2="9" y2="21"></line><line x1="15" y1="9" x2="15" y2="21"></line></svg>
                        Export as CSV
                    </button>
                    <button class="ai-export-item" onclick="exportAIViaId('${docIds}', 'excel')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9.5 11.5l5 5"></path><path d="M14.5 11.5l-5 5"></path></svg>
                        Export as Excel
                    </button>
                    <button class="ai-export-item" onclick="exportAIViaId('${docIds}', 'txt')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Export as Text
                    </button>
                </div>
            </div>
        </div>
        <div class="result-docs-grid">${cards}</div>
    </div>`;
}

function toggleAiExportMenu(id, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    else if (window.event) window.event.stopPropagation();
    const menu = document.getElementById(id);
    const allMenus = document.querySelectorAll('.ai-export-menu');
    allMenus.forEach(m => { if (m.id !== id) m.classList.remove('show'); });
    if (menu) menu.classList.toggle('show');
}

async function exportAIViaId(idsString, format) {
    const ids = idsString.split(',').map(id => parseInt(id));
    if (!ids.length) return;

    try {
        showToast(`Preparing ${format.toUpperCase()} export...`, 'info');
        const res = await fetch(`${API_BASE}/api/export/ids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_ids: ids,
                format: format
            })
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Arkivo_AI_Results.${format === 'excel' ? 'xlsx' : (format === 'csv' ? 'csv' : 'txt')}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Export successful!', 'success');
    } catch (e) {
        showToast('Export failed. Please try again.', 'error');
    }
}

// ── Typing Indicator ──────────────────────────────────────────────────────────
function appendTypingIndicator() {
    const history = document.getElementById('assistantChatHistory');
    if (!history) return null;
    const id = 'typing-' + Date.now();

    const row = document.createElement('div');
    row.id = id;
    row.className = 'chat-row chat-row-assistant';
    row.innerHTML = `
        <div class="chat-avatar-ai">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
        </div>
        <div class="chat-bubble-ai typing-bubble">
            <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>`;

    history.appendChild(row);
    history.scrollTop = history.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// Keep legacy wrappers for backward compat
function renderChatMessage(role, content, results) { appendChatRow(role, content, results); }
function renderTypingIndicator() { return appendTypingIndicator(); }

// ═══ Settings Page ═══════════════════════════════════════════════════════════
const SETTINGS_KEY = 'arkivo_settings';

function getSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch { return {}; }
}

function saveSettingsToStorage(data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

let _settingsInitialized = false;

function loadSettingsPage() {
    const s = getSettings();

    // API Key — load from SERVER (not localStorage)
    const apiInput = document.getElementById('settingApiKey');
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/api/settings`);
            if (res.ok) {
                const serverSettings = await res.json();
                // Show masked key as placeholder, keep input empty for new key entry
                if (apiInput) {
                    apiInput.value = '';
                    apiInput.placeholder = serverSettings.api_key_set ? serverSettings.api_key_masked : 'sk-or-v1-...';
                }
                // Update API status indicator
                const statusEl = document.getElementById('apiKeyStatus');
                if (statusEl && serverSettings.api_key_set) {
                    statusEl.textContent = '✅ API Key is configured on server';
                    statusEl.className = 'settings-api-status success';
                }
                // Update model if server has one
                if (serverSettings.model) {
                    const modelHidden = document.getElementById('settingModel');
                    const modelText = document.getElementById('settingModelSelectedText');
                    if (modelHidden) modelHidden.value = serverSettings.model;
                    if (modelText) {
                        const labels = {
                            'openai/gpt-4o-mini': 'GPT-4o Mini — Fast & Affordable ⭐',
                            'openai/gpt-4o': 'GPT-4o — Most Accurate',
                            'anthropic/claude-3-haiku': 'Claude 3 Haiku — Fast',
                            'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet — Smart',
                            'google/gemini-flash-1.5': 'Gemini Flash 1.5 — Cheap',
                            'meta-llama/llama-3.1-8b-instruct:free': 'Llama 3.1 8B — Free'
                        };
                        modelText.textContent = labels[serverSettings.model] || serverSettings.model;
                    }
                }
                // About card status
                const aboutApiStatus = document.getElementById('aboutApiStatus');
                if (aboutApiStatus) {
                    aboutApiStatus.innerHTML = serverSettings.api_key_set
                        ? '<span style="color:#22c55e">🟢 Set</span>'
                        : '<span style="color:#ef4444">🔴 Not Set</span>';
                }
            }
        } catch (e) {
            console.warn('Could not load server settings:', e);
        }
    })();

    // Model — update visual state
    const modelHidden = document.getElementById('settingModel');
    const modelText = document.getElementById('settingModelSelectedText');
    if (modelHidden && s.model) {
        modelHidden.value = s.model;
        if (modelText) {
            const labels = {
                'openai/gpt-4o-mini': 'GPT-4o Mini — Fast & Affordable ⭐',
                'openai/gpt-4o': 'GPT-4o — Most Accurate',
                'anthropic/claude-3-haiku': 'Claude 3 Haiku — Fast',
                'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet — Smart',
                'google/gemini-flash-1.5': 'Gemini Flash 1.5 — Cheap',
                'meta-llama/llama-3.1-8b-instruct:free': 'Llama 3.1 8B — Free'
            };
            modelText.textContent = labels[s.model] || s.model;
        }
    }

    // Temperature
    const tempRange = document.getElementById('settingTemp');
    const tempVal = document.getElementById('tempValue');
    if (tempRange) {
        tempRange.value = s.temperature ?? 0.3;
        if (tempVal) tempVal.textContent = tempRange.value;
        tempRange.oninput = () => { if (tempVal) tempVal.textContent = tempRange.value; };
    }

    // OCR Language — update visual state for custom dropdown
    const ocrLangHidden = document.getElementById('settingOcrLang');
    const ocrLangText = document.getElementById('settingOcrLangSelectedText');
    if (ocrLangHidden && s.ocrLang) {
        ocrLangHidden.value = s.ocrLang;
        const options = {
            'latin': 'Latin (English, French, Albanian...)',
            'arabic': 'Arabic',
            'cyrillic': 'Cyrillic (Serbian, Russian...)',
            'chinese_cht': 'Chinese Traditional',
            'japan': 'Japanese',
            'korean': 'Korean'
        };
        if (ocrLangText) ocrLangText.textContent = options[s.ocrLang] || s.ocrLang;
    }

    // Auto Extract — restore AND auto-save on every toggle change
    const autoEx = document.getElementById('settingAutoExtract');
    if (autoEx) {
        autoEx.checked = s.autoExtract === true;
        if (!autoEx._autoSaveAttached) {
            autoEx._autoSaveAttached = true;
            autoEx.addEventListener('change', () => {
                const cur = getSettings();
                cur.autoExtract = autoEx.checked;
                saveSettingsToStorage(cur);
                showToast(autoEx.checked
                    ? '🤖 Auto-Extract enabled & saved!'
                    : '✅ Auto-Extract disabled & saved', 'success');
            });
        }
    }

    // Max Size — update visual state
    const maxSizeHidden = document.getElementById('settingMaxSize');
    const maxSizeText = document.getElementById('settingMaxSizeSelectedText');
    if (maxSizeHidden && s.maxSize) {
        maxSizeHidden.value = s.maxSize;
        if (maxSizeText) {
            const labels = { '10': '10 MB', '20': '20 MB ⭐', '50': '50 MB', '100': '100 MB' };
            maxSizeText.textContent = labels[s.maxSize] || (s.maxSize + ' MB');
        }
    }

    // Export Format
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.format === (s.exportFormat || 'excel'));
    });

    // Theme buttons
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('.theme-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    });

    // Auto-save: None of the custom dropdowns need initial change listeners here, 
    // as they call saveSettings() inside their respective onclick handlers.

    // Custom Dropdown Logic: AI Model
    const modelMenuBtn = document.getElementById('settingModelMenuBtn');
    const modelMenu = document.getElementById('settingModelDropdownMenu');
    if (modelMenuBtn && modelMenu) {
        modelMenuBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = modelMenu.style.display === 'flex';
            // Close others
            if (ocrMenu) ocrMenu.style.display = 'none';
            if (msMenu) msMenu.style.display = 'none';
            modelMenu.style.display = isVisible ? 'none' : 'flex';
        };

        const modelOptions = modelMenu.querySelectorAll('.model-option');
        modelOptions.forEach(opt => {
            opt.onclick = () => {
                const val = opt.dataset.value;
                const text = opt.textContent;
                const hiddenInput = document.getElementById('settingModel');
                const selectedText = document.getElementById('settingModelSelectedText');
                if (hiddenInput) hiddenInput.value = val;
                if (selectedText) selectedText.textContent = text;
                modelMenu.style.display = 'none';
                saveSettings(); // Auto-save on change
            };
        });
    }

    // Custom Dropdown Logic: OCR Language
    const ocrMenuBtn = document.getElementById('settingOcrLangMenuBtn');
    const ocrMenu = document.getElementById('settingOcrLangDropdownMenu');
    if (ocrMenuBtn && ocrMenu) {
        ocrMenuBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = ocrMenu.style.display === 'flex';
            ocrMenu.style.display = isVisible ? 'none' : 'flex';
        };

        const ocrOptions = ocrMenu.querySelectorAll('.ocr-lang-option');
        ocrOptions.forEach(opt => {
            opt.onclick = () => {
                const val = opt.dataset.value;
                const text = opt.textContent;
                const hiddenInput = document.getElementById('settingOcrLang');
                const selectedText = document.getElementById('settingOcrLangSelectedText');
                if (hiddenInput) hiddenInput.value = val;
                if (selectedText) selectedText.textContent = text;
                ocrMenu.style.display = 'none';
                saveSettings(); // Auto-save on change
            };
        });
    }

    // Custom Dropdown Logic: Max Size
    const msMenuBtn = document.getElementById('settingMaxSizeMenuBtn');
    const msMenu = document.getElementById('settingMaxSizeDropdownMenu');
    if (msMenuBtn && msMenu) {
        msMenuBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = msMenu.style.display === 'flex';
            // Close others
            if (ocrMenu) ocrMenu.style.display = 'none';
            msMenu.style.display = isVisible ? 'none' : 'flex';
        };

        const msOptions = msMenu.querySelectorAll('.max-size-option');
        msOptions.forEach(opt => {
            opt.onclick = () => {
                const val = opt.dataset.value;
                const text = opt.textContent;
                const hiddenInput = document.getElementById('settingMaxSize');
                const selectedText = document.getElementById('settingMaxSizeSelectedText');
                if (hiddenInput) hiddenInput.value = val;
                if (selectedText) selectedText.textContent = text;
                msMenu.style.display = 'none';
                saveSettings(); // Auto-save on change
            };
        });
    }

    // Close all when clicking outside
    window.addEventListener('click', () => {
        if (modelMenu) modelMenu.style.display = 'none';
        if (ocrMenu) ocrMenu.style.display = 'none';
        if (msMenu) msMenu.style.display = 'none';
    });

    // Wire up interactive elements only ONCE
    if (!_settingsInitialized) {
        _settingsInitialized = true;

        // Format buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Theme buttons
        document.querySelectorAll('.theme-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.theme-option-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const t = btn.dataset.theme;
                document.documentElement.setAttribute('data-theme', t);
                localStorage.setItem('arkivo_theme', t);
            });
        });

        // Toggle API Key visibility
        const toggleBtn = document.getElementById('toggleApiKeyBtn');
        if (toggleBtn && apiInput) {
            toggleBtn.onclick = () => {
                apiInput.type = apiInput.type === 'password' ? 'text' : 'password';
            };
        }

        // Test API Key
        const testBtn = document.getElementById('testApiKeyBtn');
        if (testBtn) {
            testBtn.onclick = async () => {
                const key = document.getElementById('settingApiKey')?.value?.trim();
                const statusEl = document.getElementById('apiKeyStatus');
                if (!key) {
                    if (statusEl) { statusEl.textContent = '⚠️ Enter an API key first'; statusEl.className = 'settings-api-status warn'; }
                    return;
                }
                testBtn.textContent = 'Testing...';
                testBtn.disabled = true;
                try {
                    const res = await fetch('https://openrouter.ai/api/v1/models', {
                        headers: { 'Authorization': 'Bearer ' + key }
                    });
                    if (statusEl) {
                        if (res.ok) { statusEl.textContent = '✅ API Key is valid'; statusEl.className = 'settings-api-status success'; }
                        else { statusEl.textContent = '❌ Invalid API Key'; statusEl.className = 'settings-api-status error'; }
                    }
                } catch {
                    if (statusEl) { statusEl.textContent = '❌ Connection failed'; statusEl.className = 'settings-api-status error'; }
                } finally {
                    testBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Test';
                    testBtn.disabled = false;
                }
            };
        }

        // Delete All Docs
        const delBtn = document.getElementById('clearAllDocsBtn');
        if (delBtn) {
            delBtn.onclick = async () => {
                if (!confirm('Delete ALL documents? This cannot be undone!')) return;
                try {
                    const res = await fetch(`${API_BASE}/api/documents/all`, { method: 'DELETE' });
                    if (res.ok) { showToast('All documents deleted', 'info'); await loadDocuments(); loadStorageInfo(); }
                    else showToast('Failed to delete documents', 'error');
                } catch { showToast('Error deleting documents', 'error'); }
            };
        }

        // Save button
        const saveBtn = document.getElementById('settingsSaveBtn');
        if (saveBtn) saveBtn.onclick = saveSettings;
    }

    // Storage & about always refresh
    loadStorageInfo();

    // Refresh about card with real numbers
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/api/documents`);
            if (res.ok) {
                const docs = await res.json();
                const totalDocs = docs.length;
                const totalPages = docs.reduce((sum, d) => sum + (parseInt(d.page_count) || 0), 0);

                const aboutDocs = document.getElementById('aboutTotalDocs');
                const aboutPages = document.getElementById('aboutTotalPages');
                if (aboutDocs) aboutDocs.textContent = totalDocs;
                if (aboutPages) aboutPages.textContent = totalPages;
            }
        } catch (e) {
            console.error("Fail to load about stats", e);
        }
    })();

    // aboutApiStatus is now updated by the server fetch above
}

async function loadStorageInfo() {
    const bar = document.getElementById('storageBarFill');
    const info = document.getElementById('storageInfo');
    try {
        const res = await fetch(`${API_BASE}/api/documents`);
        if (!res.ok) throw new Error();
        const docs = await res.json();
        const totalBytes = docs.reduce((s, d) => s + (d.file_size || 0), 0);
        const maxBytes = 500 * 1024 * 1024; // 500 MB limit
        const pct = Math.min((totalBytes / maxBytes) * 100, 100).toFixed(1);
        if (bar) bar.style.width = pct + '%';
        if (info) info.textContent = `${formatFileSize(totalBytes)} used of 500 MB (${pct}%)`;
    } catch {
        if (info) info.textContent = 'Unable to load storage info';
    }
}

async function saveSettings() {
    const apiKeyInput = document.getElementById('settingApiKey');
    const apiKey = apiKeyInput?.value?.trim() || '';
    const model = document.getElementById('settingModel')?.value || 'openai/gpt-4o-mini';
    const temperature = parseFloat(document.getElementById('settingTemp')?.value || '0.3');
    const ocrLang = document.getElementById('settingOcrLang')?.value || 'latin';
    const autoExtractEl = document.getElementById('settingAutoExtract');
    const autoExtract = autoExtractEl ? autoExtractEl.checked : false; // strict boolean
    const maxSize = document.getElementById('settingMaxSize')?.value || '20';
    const activeFormat = document.querySelector('.format-btn.active')?.dataset.format || 'excel';

    // Save local settings to localStorage (non-sensitive)
    const data = { model, temperature, ocrLang, autoExtract, maxSize, exportFormat: activeFormat };
    saveSettingsToStorage(data);

    // Apply OCR lang to the hidden ocrLang input used by uploader
    const ocrLangInput = document.getElementById('ocrLang');
    if (ocrLangInput) ocrLangInput.value = ocrLang;

    // Save API key & model to SERVER (.env file)
    const serverPayload = {};
    if (apiKey) serverPayload.api_key = apiKey; // Only send if user typed a new key
    serverPayload.model = model;

    const feedback = document.getElementById('settingsSaveFeedback');

    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serverPayload)
        });

        if (res.ok) {
            const result = await res.json();
            // Clear the input and show masked key as placeholder
            if (apiKeyInput && result.api_key_masked) {
                apiKeyInput.value = '';
                apiKeyInput.placeholder = result.api_key_masked;
            }
            // Update status
            const statusEl = document.getElementById('apiKeyStatus');
            if (statusEl && apiKey) {
                statusEl.textContent = '✅ API Key saved to server';
                statusEl.className = 'settings-api-status success';
            }
            if (feedback) {
                feedback.textContent = '✅ Settings saved to server!';
                feedback.style.opacity = '1';
                setTimeout(() => { feedback.style.opacity = '0'; }, 2500);
            }
            const label = autoExtract ? '🤖 Auto-Extract ON' : '';
            showToast('Settings saved! ' + (apiKey ? '🔑 API Key updated. ' : '') + label, 'success');
        } else if (res.status === 403) {
            showToast('⚠️ Only admins can change server settings', 'error');
            if (feedback) {
                feedback.textContent = '⚠️ Admin access required';
                feedback.style.opacity = '1';
                setTimeout(() => { feedback.style.opacity = '0'; }, 2500);
            }
        } else {
            throw new Error('Server returned ' + res.status);
        }
    } catch (e) {
        console.error('Failed to save to server:', e);
        if (feedback) {
            feedback.textContent = '✅ Local settings saved (server sync failed)';
            feedback.style.opacity = '1';
            setTimeout(() => { feedback.style.opacity = '0'; }, 2500);
        }
        showToast('Local settings saved', 'success');
    }
}