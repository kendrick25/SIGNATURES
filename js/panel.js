// ===========================
// PANEL.JS - Control Panel & UI Interactions
// ===========================

// DOM Elements - Panel
const sidePanel = document.getElementById('sidePanel');
const sidePanelContent = document.getElementById('sidePanelContent');
const minimizeBtn = document.getElementById('minimizeBtn');
const dockBtn = document.getElementById('dockBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const langBtns = document.querySelectorAll('.lang-btn');

// Thickness Controls
const thicknessVal = document.getElementById('thicknessVal');
const thicknessSlider = document.getElementById('thicknessSlider');
const decWidth = document.getElementById('decWidth');
const incWidth = document.getElementById('incWidth');
const thicknessScrubArea = document.getElementById('thicknessScrubArea');

// Color Controls
const colorDots = document.querySelectorAll('.color-dot');
const alphaSlider = document.getElementById('alphaSlider');
const alphaVal = document.getElementById('alphaVal');
const customColorBtn = document.getElementById('customColorBtn');
const hiddenColorInput = document.getElementById('hiddenColorInput');

// Canvas Size Controls
const canvasWidthVal = document.getElementById('canvasWidthVal');
const widthScrubArea = document.getElementById('widthScrubArea');
const canvasHeightVal = document.getElementById('canvasHeightVal');
const heightScrubArea = document.getElementById('heightScrubArea');
const widthSlider = document.getElementById('widthSlider');
const heightSlider = document.getElementById('heightSlider');
const canvasSizeBtns = document.querySelectorAll('#canvasSizePresets .preset-btn');
const resetSizeBtn = document.getElementById('resetSizeBtn');

// Mode Controls
const modeBtns = document.querySelectorAll('#modeToggle .preset-btn');

// Export Controls
const copyPngBtn = document.getElementById('copyPngBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');

// Stroke Preview
const previewCanvas = document.getElementById('strokePreviewCanvas');
const pctx = previewCanvas.getContext('2d');

// ===========================
// TRANSLATIONS
// ===========================
const i18n = {
    es: {
        panelTitle: "PANEL DE CONTROL",
        fullscreen: "PANTALLA COMPLETA",
        darkMode: "MODO OSCURO",
        language: "IDIOMA",
        stroke: "TRAZO",
        color: "COLOR",
        natural: "Natural",
        marker: "Marcador",
        pen: "Pluma",
        opacity: "OPACIDAD",
        thickness: "GROSOR",
        canvas: "LIENZO",
        width: "ANCHO",
        height: "ALTO",
        export: "EXPORTAR",
        copyPng: "Copiar PNG al Portapapeles",
        downloadPng: "Descargar como PNG",
        downloadSvg: "Descargar como SVG",
        drawMode: "Modo Dibujo (P)",
        selectMode: "Modo Selección (V)",
        transformMode: "Modo Transformar (T)",
        panMode: "Mover Espacio (H)",
        undo: "Deshacer",
        clear: "Limpiar",
        recenter: "RECENTRAR",
        autoAdjust: "AJUSTAR AUTOMÁTICAMENTE",
        preview: "PREVISUALIZACIÓN",
        zoom: "ZOOM",
        normal: "Normal",
        medium: "Medio",
        large: "Grande"
    },
    en: {
        panelTitle: "CONTROL PANEL",
        fullscreen: "FULL SCREEN",
        darkMode: "DARK MODE",
        language: "LANGUAGE",
        stroke: "STROKE",
        color: "COLOR",
        natural: "Natural",
        marker: "Marker",
        pen: "Pen",
        opacity: "OPACITY",
        thickness: "THICKNESS",
        canvas: "CANVAS",
        width: "WIDTH",
        height: "HEIGHT",
        zoom: "ZOOM",
        normal: "Normal",
        medium: "Medium",
        large: "Large",
        export: "EXPORT",
        copyPng: "Copy PNG to Clipboard",
        downloadPng: "Download as PNG",
        downloadSvg: "Download as SVG",
        drawMode: "Drawing Mode (P)",
        selectMode: "Selection Mode (V)",
        transformMode: "Transform Mode (T)",
        panMode: "Pan Workspace (H)",
        undo: "Undo",
        clear: "Clear",
        recenter: "RECENTER",
        autoAdjust: "AUTO ADJUST",
        preview: "PREVIEW"
    }
};

let currentLang = 'es';

// ===========================
// LANGUAGE SYSTEM
// ===========================
function updateLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) {
            el.innerText = i18n[lang][key];
        }
    });

    document.getElementById('panelTitle').innerText = i18n[lang].panelTitle;
    document.getElementById('exportMainBtn').innerHTML = `<i data-lucide="download" size="18"></i> ${i18n[lang].export} <i data-lucide="chevron-down" size="14" style="margin-left: 4px; opacity: 0.7;"></i>`;
    copyPngBtn.innerHTML = `<i data-lucide="copy" size="16"></i> ${i18n[lang].copyPng}`;
    downloadPngBtn.innerHTML = `<i data-lucide="image" size="16"></i> ${i18n[lang].downloadPng}`;
    downloadSvgBtn.innerHTML = `<i data-lucide="file-code" size="16"></i> ${i18n[lang].downloadSvg}`;

    document.querySelector('[data-mode="draw"]').title = i18n[lang].drawMode;
    document.querySelector('[data-mode="select"]').title = i18n[lang].selectMode;
    document.querySelector('[data-mode="transform"]').title = i18n[lang].transformMode;
    document.querySelector('[data-mode="pan"]').title = i18n[lang].panMode;
    document.getElementById('undoBtn').title = i18n[lang].undo;
    document.getElementById('clearBtn').title = i18n[lang].clear;
    document.getElementById('centerCanvasBtn').innerText = i18n[lang].recenter;
    resetSizeBtn.innerText = i18n[lang].autoAdjust;
    if (document.querySelector('[data-i18n="preview"]')) {
        document.querySelector('[data-i18n="preview"]').innerText = lang === 'es' ? "PREVISUALIZACIÓN" : "PREVIEW";
    }

    lucide.createIcons();
}

langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        langBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateLanguage(btn.dataset.lang);
    });
});

// ===========================
// THICKNESS CONTROLS
// ===========================
function updateThickness(newVal) {
    window.currentThickness = Math.max(1, Math.min(20, parseFloat(parseFloat(newVal).toFixed(1))));
    thicknessVal.value = window.currentThickness;
    thicknessSlider.value = window.currentThickness;

    if ((window.currentMode === 'select' || window.currentMode === 'transform') && window.selectedStrokeIndices.length > 0) {
        window.saveState();

        const data = window.signaturePad.toData();
        window.selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                let min, max;
                if (window.currentStrokeType === 'marker') { min = window.currentThickness; max = window.currentThickness; }
                else if (window.currentStrokeType === 'pen') { min = window.currentThickness * 0.3; max = window.currentThickness * 2.5; }
                else { min = window.currentThickness * 0.6; max = window.currentThickness * 1.8; }
                data[index].minWidth = min;
                data[index].maxWidth = max;
            }
        });
        window.signaturePad.fromData(data);
        window.drawSelectionHighlights();
    } else {
        window.updateStrokeStyles();
    }
    updateStrokePreview();
}

thicknessSlider.addEventListener('input', (e) => updateThickness(e.target.value));
thicknessVal.addEventListener('change', (e) => updateThickness(e.target.value));

window.setupScrubber(thicknessScrubArea, updateThickness, () => window.currentThickness, 0.1);

window.setupLongPress(decWidth, () => updateThickness(window.currentThickness - 1));
window.setupLongPress(incWidth, () => updateThickness(window.currentThickness + 1));

// ===========================
// COLOR CONTROLS
// ===========================
colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        if (document.getElementById('tempCustomDot')) document.getElementById('tempCustomDot').classList.remove('active');
        window.applyColor(dot.getAttribute('data-color'));
    });
});

alphaSlider.addEventListener('input', (e) => {
    window.currentAlpha = e.target.value;
    alphaVal.innerText = Math.round(window.currentAlpha * 100) + '%';
    window.applyColor(window.lastBaseColor);
});

customColorBtn.addEventListener('click', () => hiddenColorInput.click());
hiddenColorInput.addEventListener('input', (e) => {
    const color = e.target.value;
    let customDot = document.getElementById('tempCustomDot');
    if (!customDot) {
        customDot = document.createElement('div');
        customDot.id = 'tempCustomDot';
        customDot.className = 'color-dot';
        document.getElementById('colorPicker').insertBefore(customDot, customColorBtn);
        customDot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('active'));
            customDot.classList.add('active');
            window.applyColor(color);
        });
    }
    customDot.style.background = color;
    customDot.setAttribute('data-color', color);
    colorDots.forEach(d => d.classList.remove('active'));
    customDot.classList.add('active');
    window.applyColor(color);
});

// ===========================
// CANVAS SIZE CONTROLS
// ===========================
const container = document.getElementById('canvasContainer');

canvasWidthVal.addEventListener('change', (e) => {
    const val = Math.max(200, parseInt(e.target.value));
    container.style.width = val + 'px';
    widthSlider.value = val;
});
canvasHeightVal.addEventListener('change', (e) => {
    const val = Math.max(100, parseInt(e.target.value));
    container.style.height = val + 'px';
    heightSlider.value = val;
});

widthSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    container.style.width = val + 'px';
    canvasWidthVal.value = val;
});
heightSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    container.style.height = val + 'px';
    canvasHeightVal.value = val;
});

window.setupScrubber(widthScrubArea, (val) => {
    const w = Math.max(200, Math.round(val));
    container.style.width = w + 'px';
    canvasWidthVal.value = w;
    widthSlider.value = w;
}, () => container.offsetWidth, 1);

window.setupScrubber(heightScrubArea, (val) => {
    const h = Math.max(100, Math.round(val));
    container.style.height = h + 'px';
    canvasHeightVal.value = h;
    heightSlider.value = h;
}, () => container.offsetHeight, 1);

window.setupLongPress(document.getElementById('decCanvasWidth'), () => {
    const w = Math.max(200, container.offsetWidth - 1);
    container.style.width = w + 'px';
    canvasWidthVal.value = w;
    widthSlider.value = w;
});
window.setupLongPress(document.getElementById('incCanvasWidth'), () => {
    const w = container.offsetWidth + 1;
    container.style.width = w + 'px';
    canvasWidthVal.value = w;
    widthSlider.value = w;
});
window.setupLongPress(document.getElementById('decCanvasHeight'), () => {
    const h = Math.max(100, container.offsetHeight - 1);
    container.style.height = h + 'px';
    canvasHeightVal.value = h;
    heightSlider.value = h;
});
window.setupLongPress(document.getElementById('incCanvasHeight'), () => {
    const h = container.offsetHeight + 1;
    container.style.height = h + 'px';
    canvasHeightVal.value = h;
    heightSlider.value = h;
});

canvasSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        let w, h;
        if (size === 'normal') { w = 800; h = 250; }
        else if (size === 'medium') { w = 1200; h = 375; }
        else if (size === 'large') { w = 1600; h = 500; }

        canvasSizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        container.style.width = w + 'px';
        container.style.height = h + 'px';
        canvasWidthVal.value = w;
        canvasHeightVal.value = h;
        widthSlider.value = w;
        heightSlider.value = h;
    });
});

resetSizeBtn.addEventListener('click', () => {
    container.style.width = '100vw';
    container.style.height = '400px';
    window.centerCanvas();
});

// ===========================
// STROKE TYPE PRESETS
// ===========================
document.querySelectorAll('#strokeTypePresets .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#strokeTypePresets .preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.currentStrokeType = btn.dataset.preset;
        window.updateStrokeStyles();
        if (window.selectedStrokeIndices.length > 0) {
            updateThickness(window.currentThickness);
        }
    });
});

// ===========================
// STROKE PREVIEW
// ===========================
function updateStrokePreview() {
    const w = previewCanvas.clientWidth;
    const h = previewCanvas.clientHeight;
    previewCanvas.width = w;
    previewCanvas.height = h;

    pctx.clearRect(0, 0, w, h);
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    pctx.strokeStyle = window.signaturePad.penColor;
    pctx.lineWidth = window.currentThickness;

    pctx.beginPath();
    const startX = 20;
    const endX = w - 20;
    const midY = h / 2;

    pctx.moveTo(startX, midY);

    if (window.currentStrokeType === 'marker') {
        pctx.globalAlpha = 0.6;
    } else {
        pctx.globalAlpha = 1.0;
    }

    pctx.bezierCurveTo(
        startX + (endX - startX) * 0.25, midY - 10,
        startX + (endX - startX) * 0.75, midY + 10,
        endX, midY
    );
    pctx.stroke();
    pctx.globalAlpha = 1.0;
}

setTimeout(updateStrokePreview, 100);
window.addEventListener('resize', updateStrokePreview);

// ===========================
// PANEL CONTROLS
// ===========================
minimizeBtn.addEventListener('click', () => {
    sidePanel.classList.toggle('minimized');
    document.body.classList.toggle('panel-minimized', sidePanel.classList.contains('minimized'));
});

dockBtn.addEventListener('click', () => {
    sidePanel.classList.toggle('docked');
    document.body.classList.toggle('panel-docked', sidePanel.classList.contains('docked'));
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenBtn.innerHTML = '<i data-lucide="minimize" size="16"></i>';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            fullscreenBtn.innerHTML = '<i data-lucide="maximize" size="16"></i>';
        }
    }
    lucide.createIcons();
});

darkModeToggle.addEventListener('change', () => {
    if (darkModeToggle.checked) {
        document.body.classList.remove('light-mode');
    } else {
        document.body.classList.add('light-mode');
    }
});

// ===========================
// EXPORT CONTROLS
// ===========================
copyPngBtn.addEventListener('click', async () => {
    if (window.signaturePad.isEmpty()) {
        window.showToast("Por favor, firma primero", "#ef4444");
        return;
    }
    try {
        const canvas = document.getElementById('signatureCanvas');
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        window.showToast("Firma copiada como PNG");
    } catch (err) {
        console.error(err);
        window.showToast("Error al copiar PNG", "#ef4444");
    }
});

downloadPngBtn.addEventListener('click', () => {
    if (window.signaturePad.isEmpty()) {
        window.showToast("Por favor, firma primero", "#ef4444");
        return;
    }
    const canvas = document.getElementById('signatureCanvas');
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'firma.png';
    link.click();
    window.showToast("PNG descargado");
});

downloadSvgBtn.addEventListener('click', () => {
    if (window.signaturePad.isEmpty()) {
        window.showToast("Por favor, firma primero", "#ef4444");
        return;
    }
    const svgData = window.signaturePad.toSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firma.svg';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    window.showToast("SVG descargado");
});

// Export for use in other modules
window.updateStrokePreview = updateStrokePreview;
