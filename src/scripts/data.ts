import { createIcons as lucideCreateIcons, icons } from 'lucide';
import { currentLang, UIConfig, I18nContent, setDynamicRefs } from '@/scripts/state';

// ... (skipping i18n and UI_CONFIG constant definitions which are huge)


export const i18n: I18nContent = {
    es: {
        drawMode: "Modo Dibujo (P)",
        selectMode: "Modo Selección (V)",
        transformMode: "Modo Transformar (T)",
        panMode: "Mover Espacio (H)",
        undo: "Deshacer",
        redo: "Rehacer",
        clear: "Limpiar",
        export: "EXPORTAR",
        copyPng: "Copiar PNG al Portapapeles",
        downloadPng: "Descargar como PNG",
        downloadSvg: "Descargar como SVG",
        panelTitle: "PANEL DE CONTROL",
        stroke: "TRAZO",
        natural: "Natural",
        marker: "Marcador",
        pen: "Pluma",
        brush: "Pincel",
        fine: "Fino",
        preview: "PREVISUALIZACIÓN",
        color: "COLOR",
        opacity: "OPACIDAD",
        thickness: "GROSOR",
        canvas: "LIENZO",
        normal: "Normal",
        medium: "Medio",
        large: "Grande",
        width: "ANCHO",
        height: "ALTO",
        zoom: "ZOOM",
        fullscreen: "PANTALLA COMPLETA",
        darkMode: "MODO OSCURO",
        language: "IDIOMA",
        recenter: "RECENTRAR",
        autoAdjust: "AJUSTAR AUTOMÁTICAMENTE",
        canvasHint: "Dibuja tu firma aquí",
        canvasHintSub: "(Compatible con tabletas digitales)",
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
        drawMode: "Drawing Mode (P)",
        selectMode: "Selection Mode (V)",
        transformMode: "Transform Mode (T)",
        panMode: "Pan Workspace (H)",
        undo: "Undo",
        redo: "Redo",
        clear: "Clear",
        export: "EXPORT",
        copyPng: "Copy PNG to Clipboard",
        downloadPng: "Download as PNG",
        downloadSvg: "Download as SVG",
        panelTitle: "CONTROL PANEL",
        stroke: "STROKE",
        natural: "Natural",
        marker: "Marker",
        pen: "Pen",
        brush: "Brush",
        fine: "Fine",
        preview: "PREVIEW",
        color: "COLOR",
        opacity: "OPACITY",
        thickness: "THICKNESS",
        canvas: "CANVAS",
        normal: "Normal",
        medium: "Medium",
        large: "Large",
        width: "WIDTH",
        height: "HEIGHT",
        zoom: "ZOOM",
        fullscreen: "FULL SCREEN",
        darkMode: "DARK MODE",
        language: "LANGUAGE",
        recenter: "RECENTER",
        autoAdjust: "AUTO ADJUST",
        canvasHint: "Draw your signature here",
        canvasHintSub: "(Tablet compatible)",
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

export const UI_CONFIG: UIConfig = {
    modes: [
        { id: 'draw', icon: 'Pencil', titleKey: 'drawMode', shortcut: 'P' },
        { id: 'select', icon: 'MousePointer2', titleKey: 'selectMode', shortcut: 'V' },
        { id: 'transform', icon: 'MoveDiagonal', titleKey: 'transformMode', shortcut: 'T' },
        { id: 'pan', icon: 'Hand', titleKey: 'panMode', shortcut: 'H' }
    ],
    tools: [
        { id: 'undoBtn', icon: 'Undo', i18nKey: 'undo', disabled: true },
        { id: 'redoBtn', icon: 'Redo', i18nKey: 'redo', disabled: true },
        { id: 'clearBtn', icon: 'Trash2', i18nKey: 'clear' }
    ],
    strokePresets: [
        { id: 'fine', preset: 'fine', key: 'fine' },
        { id: 'natural', preset: 'natural', key: 'natural' },
        { id: 'marker', preset: 'marker', key: 'marker' },
        { id: 'pen', preset: 'pen', key: 'pen' },
        { id: 'brush', preset: 'brush', key: 'brush' }
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
        { id: 'centerCanvasBtn', icon: 'Focus', i18nKey: 'recenter', titleKey: 'recenter' },
        { id: 'resetSizeBtn', icon: 'Maximize', i18nKey: 'autoAdjust' }
    ],
    exportOptions: [
        { id: 'copyPngBtn', icon: 'Copy', i18nKey: 'copyPng' },
        { id: 'downloadPngBtn', icon: 'Image', i18nKey: 'downloadPng' },
        { id: 'downloadSvgBtn', icon: 'FileCode', i18nKey: 'downloadSvg' }
    ],
    settings: [
        { id: 'fullscreenRow', i18nKey: 'fullscreen', type: 'button', btnId: 'fullscreenBtn', icon: 'Maximize' },
        { id: 'darkModeRow', i18nKey: 'darkMode', type: 'toggle', toggleId: 'darkModeToggle' },
        { id: 'languageRow', i18nKey: 'language', type: 'container', class: 'panel-lang-container' }
    ]
};

export function renderUIComponents() {
    renderModes();
    renderTools();
    renderExportOptions();
    renderStrokePresets();
    renderColorPicker();
    renderCanvasPresets();
    renderSettings();
    renderWorkspaceShortcuts();
    renderLanguageButtons();

    // Initial icon creation
    createIcons();
}

export function createIcons() {
    try {
        if (typeof lucideCreateIcons === 'function') {
            lucideCreateIcons({ icons });
        } else {
            console.warn("Lucide createIcons is not a function:", lucideCreateIcons);
        }
    } catch (e) {
        console.error("Failed to create icons:", e);
    }
}

function renderModes() {
    const container = document.getElementById('modeToggle');
    if (!container) return;
    const lang = currentLang as keyof I18nContent;

    container.innerHTML = UI_CONFIG.modes.map(mode => `
        <button class="preset-btn ${mode.id === 'draw' ? 'active' : ''}" 
                data-mode="${mode.id}" 
                title="${i18n[lang] ? i18n[lang][mode.titleKey] : mode.id}">
            <i data-lucide="${mode.icon}"></i>
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
            <i data-lucide="${tool.icon}"></i>
        </button>
    `).join('');
}

function renderExportOptions() {
    const container = document.querySelector('#exportDropdown .dropdown-menu');
    if (!container) return;
    const lang = currentLang as keyof I18nContent;

    container.innerHTML = UI_CONFIG.exportOptions.map(opt => `
        <button class="dropdown-item" id="${opt.id}">
            <i data-lucide="${opt.icon}"></i>
            <span data-i18n="${opt.i18nKey}">${i18n[lang] ? i18n[lang][opt.i18nKey] : opt.id}</span>
        </button>
    `).join('');
}

function renderStrokePresets() {
    const container = document.getElementById('strokeTypePresets');
    if (!container) return;
    const lang = currentLang as keyof I18nContent;

    container.innerHTML = UI_CONFIG.strokePresets.map(preset => `
        <button class="preset-btn ${preset.id === 'natural' ? 'active' : ''} preset-btn-flex" 
                data-preset="${preset.id}" 
                id="btn${preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}"
                data-i18n="${preset.key}">
            ${i18n[lang] ? i18n[lang][preset.key] : preset.id}
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
            <i data-lucide="Plus"></i>
        </div>
        <input type="color" id="hiddenColorInput" style="display: none;">
    `;
}

function renderCanvasPresets() {
    const container = document.getElementById('canvasSizePresets');
    if (!container) return;
    const lang = currentLang as keyof I18nContent;

    container.innerHTML = UI_CONFIG.canvasPresets.map(preset => `
        <button class="preset-btn ${preset.active ? 'active' : ''} preset-btn-flex" 
                data-size="${preset.size}" 
                data-i18n="${preset.key}">
            ${i18n[lang] ? i18n[lang][preset.key] : preset.id}
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
    const lang = currentLang as keyof I18nContent;
    const isDark = document.body.classList.contains('dark-mode') || !document.body.classList.contains('light-mode');

    container.innerHTML = UI_CONFIG.settings.map(s => {
        let control = '';
        if (s.type === 'button') {
            control = `<button class="panel-toggle-btn" id="${s.btnId}"><i data-lucide="${s.icon}"></i></button>`;
        } else if (s.type === 'toggle') {
            const checked = (s.id === 'darkModeRow' && isDark) ? 'checked' : '';
            control = `<label class="toggle-switch"><input type="checkbox" id="${s.toggleId}" ${checked}><span class="slider"></span></label>`;
        } else if (s.type === 'container') {
            control = `<div class="${s.class}"></div>`;
        }

        return `
            <div class="settings-row" id="${s.id}">
                <span class="settings-label" data-i18n="${s.i18nKey}">${(i18n[lang] && i18n[lang][s.i18nKey]) ? i18n[lang][s.i18nKey] : s.i18nKey}</span>
                ${control}
            </div>
        `;
    }).join('');
}

function renderWorkspaceShortcuts() {
    const container = document.querySelector('.workspace-controls-bottom');
    if (!container) return;
    const lang = currentLang as keyof I18nContent;

    container.innerHTML = UI_CONFIG.workspaceShortcuts.map(s => `
        <button class="btn-secondary" id="${s.id}" ${s.titleKey ? `title="${(i18n[lang] && i18n[lang][s.titleKey]) ? i18n[lang][s.titleKey] : s.titleKey}"` : ''} data-i18n="${s.i18nKey}">
            <i data-lucide="${s.icon}"></i>
            ${(i18n[lang] && i18n[lang][s.i18nKey]) ? i18n[lang][s.i18nKey] : s.i18nKey}
        </button>
    `).join('');
}

export function updateGlobalReferences() {
    setDynamicRefs({
        colorDots: document.querySelectorAll('.color-dot'),
        strokeTypeBtns: document.querySelectorAll('#strokeTypePresets .preset-btn'),
        modeBtns: document.querySelectorAll('#modeToggle .preset-btn')
    });
}

export function updateLanguage(lang: string) {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && i18n[lang] && i18n[lang][key]) {
            if (el.tagName === 'INPUT' && (el as HTMLInputElement).placeholder) {
                (el as HTMLInputElement).placeholder = i18n[lang][key];
            } else {
                el.textContent = i18n[lang][key];
            }
        }
    });
}
