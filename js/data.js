// data.js
// i18n content ordered by its appearance in FIRMAS.html

const i18n = {
    es: {
        // --- MODOS ---
        drawMode: "Modo Dibujo (P)",
        selectMode: "Modo Selección (V)",
        transformMode: "Modo Transformar (T)",
        panMode: "Mover Espacio (H)",

        // --- UNDO/CLEAR ---
        undo: "Deshacer",
        redo: "Rehacer",
        clear: "Limpiar",

        // --- EXPORT ACTIONS ---
        export: "EXPORTAR",
        copyPng: "Copiar PNG al Portapapeles",
        downloadPng: "Descargar como PNG",
        downloadSvg: "Descargar como SVG",

        // --- PANEL DE CONTROL ---
        panelTitle: "PANEL DE CONTROL",

        // --- TRAZO ---
        stroke: "TRAZO",
        natural: "Natural",
        marker: "Marcador",
        pen: "Pluma",
        preview: "PREVISUALIZACIÓN",
        color: "COLOR",
        opacity: "OPACIDAD",
        thickness: "GROSOR",

        // --- LIENZO ---
        canvas: "LIENZO",
        normal: "Normal",
        medium: "Medio",
        large: "Grande",
        width: "ANCHO",
        height: "ALTO",
        zoom: "ZOOM",

        // --- CONFIGURACIÓN ---
        fullscreen: "PANTALLA COMPLETA",
        darkMode: "MODO OSCURO",
        language: "IDIOMA",

        // --- WORKSPACE ---
        recenter: "RECENTRAR",
        autoAdjust: "AJUSTAR AUTOMÁTICAMENTE",
        canvasHint: "Dibuja tu firma aquí",
        canvasHintSub: "(Compatible con tabletas digitales)",

        // --- OTROS ---
        toastSuccess: "Firma copiada al portapapeles",
        toastError: "Error al copiar PNG",
        toastSignFirst: "Por favor, firma primero",
        toastStrokesCopied: "Trazos copiados",
        toastStrokesPasted: "Trazos pegados",
        toastPngDownloaded: "PNG descargado",
        toastSvgDownloaded: "SVG descargado",
        toastPngCopied: "Firma copiada como PNG"
    },
    en: {
        // --- MODOS ---
        drawMode: "Drawing Mode (P)",
        selectMode: "Selection Mode (V)",
        transformMode: "Transform Mode (T)",
        panMode: "Pan Workspace (H)",

        // --- UNDO/CLEAR ---
        undo: "Undo",
        redo: "Redo",
        clear: "Clear",

        // --- EXPORT ACTIONS ---
        export: "EXPORT",
        copyPng: "Copy PNG to Clipboard",
        downloadPng: "Download as PNG",
        downloadSvg: "Download as SVG",

        // --- PANEL DE CONTROL ---
        panelTitle: "CONTROL PANEL",

        // --- TRAZO ---
        stroke: "STROKE",
        natural: "Natural",
        marker: "Marker",
        pen: "Pen",
        preview: "PREVIEW",
        color: "COLOR",
        opacity: "OPACITY",
        thickness: "THICKNESS",

        // --- LIENZO ---
        canvas: "CANVAS",
        normal: "Normal",
        medium: "Medium",
        large: "Large",
        width: "WIDTH",
        height: "HEIGHT",
        zoom: "ZOOM",

        // --- CONFIGURACIÓN ---
        fullscreen: "FULL SCREEN",
        darkMode: "DARK MODE",
        language: "LANGUAGE",

        // --- WORKSPACE ---
        recenter: "RECENTER",
        autoAdjust: "AUTO ADJUST",
        canvasHint: "Draw your signature here",
        canvasHintSub: "(Tablet compatible)",

        // --- OTROS ---
        toastSuccess: "Signature copied to clipboard",
        toastError: "Error copying PNG",
        toastSignFirst: "Please sign first",
        toastStrokesCopied: "Strokes copied",
        toastStrokesPasted: "Strokes pasted",
        toastPngDownloaded: "PNG downloaded",
        toastSvgDownloaded: "SVG downloaded",
        toastPngCopied: "Signature copied as PNG"
    }
};

const UI_CONFIG = {
    modes: [
        { id: 'draw', icon: 'pencil', titleKey: 'drawMode', shortcut: 'P' },
        { id: 'select', icon: 'mouse-pointer-2', titleKey: 'selectMode', shortcut: 'V' },
        { id: 'transform', icon: 'move-diagonal', titleKey: 'transformMode', shortcut: 'T' },
        { id: 'pan', icon: 'hand', titleKey: 'panMode', shortcut: 'H' }
    ],
    tools: [
        { id: 'undoBtn', icon: 'undo', i18nKey: 'undo', disabled: true },
        { id: 'redoBtn', icon: 'redo', i18nKey: 'redo', disabled: true },
        { id: 'clearBtn', icon: 'trash-2', i18nKey: 'clear' }
    ],
    strokePresets: [
        { id: 'natural', preset: 'natural', key: 'natural' },
        { id: 'marker', preset: 'marker', key: 'marker' },
        { id: 'pen', preset: 'pen', key: 'pen' }
    ],
    colors: [
        { color: '#ffffff', active: true },
        { color: '#6366f1' },
        { color: '#06b6d4' },
        { color: '#000000', border: true }
    ],
    canvasPresets: [
        { id: 'normal', size: 'normal', key: 'normal', active: true },
        { id: 'medium', size: 'medium', key: 'medium' },
        { id: 'large', size: 'large', key: 'large' }
    ],
    languages: [
        { id: 'es', label: 'ES', active: true },
        { id: 'en', label: 'EN' }
    ],
    workspaceShortcuts: [
        { id: 'centerCanvasBtn', icon: 'focus', i18nKey: 'recenter', titleKey: 'recenter' },
        { id: 'resetSizeBtn', icon: 'maximize', i18nKey: 'autoAdjust' }
    ],
    exportOptions: [
        { id: 'copyPngBtn', icon: 'copy', i18nKey: 'copyPng' },
        { id: 'downloadPngBtn', icon: 'image', i18nKey: 'downloadPng' },
        { id: 'downloadSvgBtn', icon: 'file-code', i18nKey: 'downloadSvg' }
    ],
    settings: [
        { id: 'fullscreenRow', i18nKey: 'fullscreen', type: 'button', btnId: 'fullscreenBtn', icon: 'maximize' },
        { id: 'darkModeRow', i18nKey: 'darkMode', type: 'toggle', toggleId: 'darkModeToggle' },
        { id: 'languageRow', i18nKey: 'language', type: 'container', class: 'panel-lang-container' }
    ]
};

// --- RENDER ENGINE ---

function renderUIComponents() {
    renderModes();
    renderTools();
    renderExportOptions();
    renderStrokePresets();
    renderColorPicker();
    renderCanvasPresets();
    renderSettings();
    renderWorkspaceShortcuts();
    renderLanguageButtons();
}

function renderModes() {
    const container = document.getElementById('modeToggle');
    if (!container) return;

    container.innerHTML = UI_CONFIG.modes.map(mode => `
        <button class="preset-btn ${mode.id === 'draw' ? 'active' : ''}" 
                data-mode="${mode.id}" 
                title="${i18n[currentLang][mode.titleKey]}">
            <i data-lucide="${mode.icon}" size="18"></i>
        </button>
    `).join('');
}

function renderTools() {
    const container = document.getElementById('historyTools');
    if (!container) return;

    container.innerHTML = UI_CONFIG.tools.map(tool => `
        <button class="btn-secondary btn-tool-square" 
                id="${tool.id}" 
                data-i18n="${tool.i18nKey}" 
                ${tool.disabled ? 'disabled' : ''}>
            <i data-lucide="${tool.icon}" size="18"></i>
        </button>
    `).join('');
}

function renderExportOptions() {
    const container = document.querySelector('#exportDropdown .dropdown-menu');
    if (!container) return;

    container.innerHTML = UI_CONFIG.exportOptions.map(opt => `
        <button class="dropdown-item" id="${opt.id}">
            <i data-lucide="${opt.icon}" size="16"></i>
            <span data-i18n="${opt.i18nKey}">${i18n[currentLang][opt.i18nKey]}</span>
        </button>
    `).join('');
}

function renderStrokePresets() {
    const container = document.getElementById('strokeTypePresets');
    if (!container) return;

    container.innerHTML = UI_CONFIG.strokePresets.map(preset => `
        <button class="preset-btn ${preset.id === 'natural' ? 'active' : ''} preset-btn-flex" 
                data-preset="${preset.id}" 
                id="btn${preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}"
                data-i18n="${preset.key}">
            ${i18n[currentLang][preset.key]}
        </button>
    `).join('');
}

function renderColorPicker() {
    const container = document.getElementById('colorPicker');
    if (!container) return;

    const dots = UI_CONFIG.colors.map(c => `
        <div class="color-dot ${c.active ? 'active' : ''}" 
             style="background: ${c.color}; ${c.border ? 'border: 1px solid var(--glass-border);' : ''}" 
             data-color="${c.color}"></div>
    `).join('');

    container.innerHTML = `
        ${dots}
        <div class="custom-color-btn" id="customColorBtn" title="Color personalizado">
            <i data-lucide="plus" size="12"></i>
        </div>
        <input type="color" id="hiddenColorInput" style="display: none;">
    `;
}

function renderCanvasPresets() {
    const container = document.getElementById('canvasSizePresets');
    if (!container) return;

    container.innerHTML = UI_CONFIG.canvasPresets.map(preset => `
        <button class="preset-btn ${preset.active ? 'active' : ''} preset-btn-flex" 
                data-size="${preset.size}" 
                data-i18n="${preset.key}">
            ${i18n[currentLang][preset.key]}
        </button>
    `).join('');
}

function renderLanguageButtons() {
    const containers = document.querySelectorAll('.panel-lang-container');
    const html = UI_CONFIG.languages.map(lang => `
        <button class="lang-btn ${lang.id === currentLang ? 'active' : ''}" 
                data-lang="${lang.id}">
            ${lang.label}
        </button>
    `).join('');

    containers.forEach(c => c.innerHTML = html);
}

function renderSettings() {
    const container = document.querySelector('.panel-config-group');
    if (!container) return;

    container.innerHTML = UI_CONFIG.settings.map(s => {
        let control = '';
        if (s.type === 'button') {
            control = `<button class="panel-toggle-btn" id="${s.btnId}"><i data-lucide="${s.icon}" size="16"></i></button>`;
        } else if (s.type === 'toggle') {
            control = `<label class="toggle-switch"><input type="checkbox" id="${s.toggleId}" checked><span class="slider"></span></label>`;
        } else if (s.type === 'container') {
            control = `<div class="${s.class}"></div>`;
        }

        return `
            <div class="settings-row" id="${s.id}">
                <span class="settings-label" data-i18n="${s.i18nKey}">${i18n[currentLang][s.i18nKey]}</span>
                ${control}
            </div>
        `;
    }).join('');
}

function renderWorkspaceShortcuts() {
    const container = document.querySelector('.workspace-controls-bottom');
    if (!container) return;

    container.innerHTML = UI_CONFIG.workspaceShortcuts.map(s => `
        <button class="btn-secondary" id="${s.id}" ${s.titleKey ? `title="${i18n[currentLang][s.titleKey]}"` : ''} data-i18n="${s.i18nKey}">
            <i data-lucide="${s.icon}" size="14"></i>
            ${i18n[currentLang][s.i18nKey]}
        </button>
    `).join('');
}

function updateGlobalReferences() {
    colorDots = document.querySelectorAll('.color-dot');
    strokeTypeBtns = document.querySelectorAll('#strokeTypePresets .preset-btn');
    modeBtns = document.querySelectorAll('#modeToggle .preset-btn');
}
