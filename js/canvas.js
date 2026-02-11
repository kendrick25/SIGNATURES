// ===========================
// CANVAS.JS - Canvas Setup & Drawing Logic
// ===========================

// DOM Elements - Canvas
const canvas = document.getElementById('signatureCanvas');
const container = document.getElementById('canvasContainer');
const hint = document.getElementById('canvasHint');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const ctx = canvas.getContext('2d');

// Selection Canvas
const selectionCanvas = document.getElementById('selectionCanvas');
const sctx = selectionCanvas.getContext('2d');
const selectedBounds = document.getElementById('selectedBounds');
const selectionInfo = document.getElementById('selectionInfo');

// Drawing State
let currentThickness = 2.5;
let currentStrokeType = 'natural';
let currentAlpha = 1.0;
let lastBaseColor = "#ffffff";

// History System
let history = [];
let redoStack = [];

// Selection State
let selectedStrokeIndices = [];
let isSelecting = false;
let isMoving = false;
let isResizing = false;
let selectStart = { x: 0, y: 0 };
let moveStart = { x: 0, y: 0 };
let resizeStart = { x: 0, y: 0 };
let resizeType = '';

// Mode State
let currentMode = 'draw';
let modeBeforeMiddleClick = null;

// ===========================
// SIGNATURE PAD SETUP
// ===========================
const signaturePad = new SignaturePad(canvas, {
    backgroundColor: 'rgba(0,0,0,0)',
    penColor: '#ffffff',
    minWidth: 1.5,
    maxWidth: 4.5,
    velocityFilterWeight: 0.7
});

// ===========================
// CANVAS RESIZE LOGIC
// ===========================
const observer = new ResizeObserver(() => {
    syncSizeValues();
    resizeCanvas();
});
observer.observe(container);

function syncSizeValues() {
    const canvasWidthVal = document.getElementById('canvasWidthVal');
    const canvasHeightVal = document.getElementById('canvasHeightVal');
    if (document.activeElement !== canvasWidthVal) canvasWidthVal.value = Math.round(container.offsetWidth);
    if (document.activeElement !== canvasHeightVal) canvasHeightVal.value = Math.round(container.offsetHeight);
}

function resizeCanvas() {
    const data = signaturePad.toData();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    const newWidth = container.offsetWidth * ratio;
    const newHeight = container.offsetHeight * ratio;

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);

        selectionCanvas.width = newWidth;
        selectionCanvas.height = newHeight;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.scale(ratio, ratio);

        signaturePad.clear();
        if (data.length > 0) {
            signaturePad.fromData(data);
            hint.classList.add('hidden');
        } else {
            hint.classList.remove('hidden');
        }
        drawSelectionHighlights();
    }
}

// ===========================
// HISTORY SYSTEM
// ===========================
function saveState() {
    const data = signaturePad.toData();
    const selection = [...selectedStrokeIndices];
    history.push({ data, selection });
    redoStack = [];
    if (history.length > 50) history.shift();
    updateHistoryButtons();
}

function undo() {
    if (history.length > 0) {
        const currentData = signaturePad.toData();
        const currentSelection = [...selectedStrokeIndices];
        redoStack.push({ data: currentData, selection: currentSelection });

        const lastState = history.pop();
        signaturePad.fromData(lastState.data);
        selectedStrokeIndices = lastState.selection || [];

        if (lastState.data.length === 0) hint.classList.remove('hidden');
        else hint.classList.add('hidden');

        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateHistoryButtons();
    }
}

function redo() {
    if (redoStack.length > 0) {
        const currentData = signaturePad.toData();
        const currentSelection = [...selectedStrokeIndices];
        history.push({ data: currentData, selection: currentSelection });

        const nextState = redoStack.pop();
        signaturePad.fromData(nextState.data);
        selectedStrokeIndices = nextState.selection || [];

        hint.classList.add('hidden');
        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateHistoryButtons();
    }
}

function updateHistoryButtons() {
    undoBtn.disabled = history.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

// ===========================
// STROKE STYLES
// ===========================
function updateStrokeStyles() {
    const preset = currentStrokeType;
    switch (preset) {
        case 'marker':
            signaturePad.minWidth = currentThickness;
            signaturePad.maxWidth = currentThickness;
            signaturePad.velocityFilterWeight = 1;
            break;
        case 'pen':
            signaturePad.minWidth = currentThickness * 0.3;
            signaturePad.maxWidth = currentThickness * 2.5;
            signaturePad.velocityFilterWeight = 0.4;
            break;
        case 'natural':
        default:
            signaturePad.minWidth = currentThickness * 0.6;
            signaturePad.maxWidth = currentThickness * 1.8;
            signaturePad.velocityFilterWeight = 0.7;
            break;
    }
    if (window.updateStrokePreview) window.updateStrokePreview();
}

// ===========================
// COLOR AND ALPHA
// ===========================
function applyColor(colorHex) {
    lastBaseColor = colorHex;
    const finalColor = window.hexToRgba(colorHex, currentAlpha);
    signaturePad.penColor = finalColor;

    if ((currentMode === 'select' || currentMode === 'transform') && selectedStrokeIndices.length > 0) {
        saveState();

        const data = signaturePad.toData();
        let modified = false;
        selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                data[index].color = finalColor;
                modified = true;
            }
        });
        if (modified) {
            signaturePad.fromData(data);
            updateSelectedBounds();
        }
    }
    if (window.updateStrokePreview) window.updateStrokePreview();
}

// ===========================
// SELECTION LOGIC
// ===========================
function updateSelectedBounds() {
    if (selectedStrokeIndices.length === 0 || (currentMode !== 'transform' && currentMode !== 'select')) {
        selectedBounds.style.display = 'none';
        return;
    }

    const data = signaturePad.toData();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    let hasStroke = false;
    selectedStrokeIndices.forEach(idx => {
        if (data[idx]) {
            hasStroke = true;
            data[idx].points.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        }
    });

    if (!hasStroke) {
        selectedBounds.style.display = 'none';
        return;
    }

    const ratio = 1.0;
    const padding = 5;
    selectedBounds.style.left = (minX * ratio - padding) + 'px';
    selectedBounds.style.top = (minY * ratio - padding) + 'px';
    selectedBounds.style.width = ((maxX - minX) * ratio + padding * 2) + 'px';
    selectedBounds.style.height = ((maxY - minY) * ratio + padding * 2) + 'px';
    selectedBounds.style.display = 'block';

    if (currentMode === 'select') {
        selectedBounds.classList.add('no-handles');
        selectedBounds.style.border = 'none';
        selectedBounds.style.opacity = '0';
    } else {
        selectedBounds.classList.remove('no-handles');
        selectedBounds.style.border = '1px dashed var(--primary)';
        selectedBounds.style.opacity = '1';
    }
}

function drawSelectionHighlights() {
    sctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    if (selectedStrokeIndices.length === 0 || currentMode !== 'select') return;

    const data = signaturePad.toData();
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';

    selectedStrokeIndices.forEach(idx => {
        const stroke = data[idx];
        if (!stroke || stroke.points.length < 2) return;

        sctx.beginPath();
        sctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((p, i) => {
            if (i > 0) sctx.lineTo(p.x, p.y);
        });

        sctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        sctx.lineWidth = (stroke.maxWidth + stroke.minWidth) + 10;
        sctx.stroke();

        sctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        sctx.lineWidth = 2;
        sctx.stroke();
    });
}

function selectStrokes(indices, saveHistory = true) {
    const isSame = indices.length === selectedStrokeIndices.length &&
        indices.every((val, index) => val === selectedStrokeIndices[index]);
    if (isSame) return;

    if (saveHistory) saveState();

    selectedStrokeIndices = indices;
    selectionInfo.innerText = `Trazos Seleccionados: ${indices.length}`;
    selectionInfo.style.display = indices.length > 0 ? 'block' : 'none';
    updateSelectedBounds();
    drawSelectionHighlights();
    syncControlsWithSelection();
}

function deselectStroke(saveHistory = true) {
    if (selectedStrokeIndices.length === 0) return;

    if (saveHistory) saveState();

    selectedStrokeIndices = [];
    selectionInfo.style.display = 'none';
    updateSelectedBounds();
    drawSelectionHighlights();
}

function syncControlsWithSelection() {
    if (selectedStrokeIndices.length > 0) {
        const data = signaturePad.toData();
        const firstStroke = data[selectedStrokeIndices[0]];
        if (firstStroke) {
            currentThickness = (firstStroke.maxWidth + firstStroke.minWidth) / 2;
            const thicknessVal = document.getElementById('thicknessVal');
            const thicknessSlider = document.getElementById('thicknessSlider');
            thicknessVal.value = currentThickness.toFixed(1);
            thicknessSlider.value = currentThickness;

            const colorDots = document.querySelectorAll('.color-dot');
            colorDots.forEach(dot => {
                if (dot.getAttribute('data-color') === firstStroke.color) {
                    colorDots.forEach(d => d.classList.remove('active'));
                    dot.classList.add('active');
                    lastBaseColor = dot.getAttribute('data-color');
                }
            });
        }
    }
}

// ===========================
// EVENT LISTENERS
// ===========================
signaturePad.addEventListener("beginStroke", () => {
    if (currentMode === 'select' || currentMode === 'move' || currentMode === 'resize') return;
    saveState();
    hint.classList.add('hidden');
});

clearBtn.addEventListener('click', () => {
    signaturePad.clear();
    hint.classList.remove('hidden');
});

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Initialize
updateHistoryButtons();

// Export for use in other modules
window.signaturePad = signaturePad;
window.history = history;
window.currentMode = currentMode;
window.currentThickness = currentThickness;
window.currentStrokeType = currentStrokeType;
window.currentAlpha = currentAlpha;
window.lastBaseColor = lastBaseColor;
window.selectedStrokeIndices = selectedStrokeIndices;
window.saveState = saveState;
window.undo = undo;
window.redo = redo;
window.updateStrokeStyles = updateStrokeStyles;
window.applyColor = applyColor;
window.selectStrokes = selectStrokes;
window.deselectStroke = deselectStroke;
window.updateSelectedBounds = updateSelectedBounds;
window.drawSelectionHighlights = drawSelectionHighlights;

// ===========================
// WARN BEFORE LEAVING
// ===========================
window.addEventListener('beforeunload', (e) => {
    if (!signaturePad.isEmpty() || history.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});
