// panel.js
// Handles side panel interactions, modes, tool selection, and localization.

let currentLang = 'es';

function setMode(mode) {
    currentMode = mode;
    const modeBtns = document.querySelectorAll('#modeToggle .preset-btn');
    modeBtns.forEach(btn => {
        if (btn.dataset.mode === mode) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    if (currentMode === 'transform') {
        canvas.style.cursor = 'move';
        signaturePad.off(); // Disable drawing
    } else if (currentMode === 'select') {
        canvas.style.cursor = 'default';
        signaturePad.off();
    } else if (currentMode === 'pan') {
        canvas.style.cursor = 'grab';
        signaturePad.off();
    } else {
        canvas.style.cursor = 'crosshair';
        signaturePad.on(); // Enable drawing
        deselectStroke();
    }
    updateSelectedBounds();
    if (typeof drawSelectionHighlights === 'function') drawSelectionHighlights();
}

function updateLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang] && i18n[lang][key]) {
            el.innerText = i18n[lang][key];
        }
    });

    // Update titles and tooltips specifically
    const modeTooltips = {
        'draw': 'drawMode',
        'select': 'selectMode',
        'transform': 'transformMode',
        'pan': 'panMode'
    };

    Object.entries(modeTooltips).forEach(([mode, key]) => {
        const btn = document.querySelector(`[data-mode="${mode}"]`);
        if (btn) btn.title = i18n[lang][key];
    });

    const tooltips = {
        'undoBtn': 'undo',
        'redoBtn': 'redo',
        'clearBtn': 'clear'
    };

    Object.entries(tooltips).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.title = i18n[lang][key];
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showToast(message, color = "#10b981") {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.style.background = color;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- Export & Dropdown Logic ---

function setupExportHandlers() {
    const exportDropdown = document.getElementById('exportDropdown');
    const exportMainBtn = document.getElementById('exportMainBtn');
    if (!exportDropdown || !exportMainBtn) return;

    exportMainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        exportDropdown.classList.remove('active');
    });

    const copyPngBtn = document.getElementById('copyPngBtn');
    if (copyPngBtn) {
        copyPngBtn.addEventListener('click', async () => {
            if (signaturePad.isEmpty()) {
                showToast(i18n[currentLang].toastSignFirst, "#ef4444");
                return;
            }
            try {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                showToast(i18n[currentLang].toastPngCopied);
            } catch (err) {
                console.error(err);
                showToast(i18n[currentLang].toastError, "#ef4444");
            }
        });
    }

    const downloadPngBtn = document.getElementById('downloadPngBtn');
    if (downloadPngBtn) {
        downloadPngBtn.addEventListener('click', () => {
            if (signaturePad.isEmpty()) {
                showToast(i18n[currentLang].toastSignFirst, "#ef4444");
                return;
            }
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = 'firma.png';
            link.click();
            showToast(i18n[currentLang].toastPngDownloaded);
        });
    }

    const downloadSvgBtn = document.getElementById('downloadSvgBtn');
    if (downloadSvgBtn) {
        downloadSvgBtn.addEventListener('click', () => {
            if (signaturePad.isEmpty()) {
                showToast(i18n[currentLang].toastSignFirst, "#ef4444");
                return;
            }
            const svgData = signaturePad.toSVG();
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'firma.svg';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast(i18n[currentLang].toastSvgDownloaded);
        });
    }
}
