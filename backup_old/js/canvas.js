// canvas.js
// Handles SignaturePad setup, history (saveState, undo, redo), and stroke properties.

function saveState() {
    // High-fidelity deep clone to prevent accidental mutations by reference
    const data = JSON.parse(JSON.stringify(signaturePad.toData()));
    const selection = [...selectedStrokeIndices];
    history.push({ data, selection });
    redoStack = [];
    if (history.length > 50) history.shift();
    updateHistoryButtons();
}

function undo() {
    if (history.length > 0) {
        // Current state to redo
        const currentData = JSON.parse(JSON.stringify(signaturePad.toData()));
        const currentSelection = [...selectedStrokeIndices];
        redoStack.push({ data: currentData, selection: currentSelection });

        // Restore last state
        const lastState = history.pop();
        signaturePad.fromData(lastState.data);
        selectedStrokeIndices = lastState.selection || [];

        if (lastState.data.length === 0) hint.classList.remove('hidden');
        else hint.classList.add('hidden');

        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateHistoryButtons();
        updateStrokePreview();
    }
}

function redo() {
    if (redoStack.length > 0) {
        // Current state to history
        const currentData = JSON.parse(JSON.stringify(signaturePad.toData()));
        const currentSelection = [...selectedStrokeIndices];
        history.push({ data: currentData, selection: currentSelection });

        // Restore next state
        const nextState = redoStack.pop();
        signaturePad.fromData(nextState.data);
        selectedStrokeIndices = nextState.selection || [];

        hint.classList.add('hidden');
        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateHistoryButtons();
        updateStrokePreview();
    }
}

function updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = history.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function updateThickness(newVal) {
    currentThickness = Math.max(1, Math.min(20, parseFloat(parseFloat(newVal).toFixed(1))));

    const thicknessVal = document.getElementById('thicknessVal');
    const thicknessSlider = document.getElementById('thicknessSlider');
    if (thicknessVal) thicknessVal.value = currentThickness;
    if (thicknessSlider) thicknessSlider.value = currentThickness;

    if ((currentMode === 'select' || currentMode === 'transform') && selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                let min, max;
                if (currentStrokeType === 'marker') { min = currentThickness; max = currentThickness; }
                else if (currentStrokeType === 'pen') { min = currentThickness * 0.15; max = currentThickness * 3.0; }
                else if (currentStrokeType === 'brush') { min = currentThickness * 0.1; max = currentThickness * 4.0; }
                else if (currentStrokeType === 'fine') { min = currentThickness * 0.9; max = currentThickness * 1.1; }
                else { min = currentThickness * 0.45; max = currentThickness * 2.0; }
                data[index].minWidth = min;
                data[index].maxWidth = max;
            }
        });
        signaturePad.fromData(data);
        drawSelectionHighlights();
    } else {
        updateStrokeStyles();
    }
    updateStrokePreview();
}

function updateStrokeStyles() {
    const preset = currentStrokeType;
    switch (preset) {
        case 'marker':
            signaturePad.minWidth = currentThickness;
            signaturePad.maxWidth = currentThickness;
            signaturePad.velocityFilterWeight = 1;
            break;
        case 'pen':
            signaturePad.minWidth = currentThickness * 0.15;
            signaturePad.maxWidth = currentThickness * 3.0;
            signaturePad.velocityFilterWeight = 0.45;
            break;
        case 'brush':
            signaturePad.minWidth = currentThickness * 0.1;
            signaturePad.maxWidth = currentThickness * 4.0;
            signaturePad.velocityFilterWeight = 0.5;
            break;
        case 'fine':
            signaturePad.minWidth = currentThickness * 0.9;
            signaturePad.maxWidth = currentThickness * 1.1;
            signaturePad.velocityFilterWeight = 0.8;
            break;
        case 'natural':
        default:
            signaturePad.minWidth = currentThickness * 0.45;
            signaturePad.maxWidth = currentThickness * 2.0;
            signaturePad.velocityFilterWeight = 0.65;
            break;
    }
    updateStrokePreview();
}

function applyStrokeType(type) {
    currentStrokeType = type;
    if ((currentMode === 'select' || currentMode === 'transform') && selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                let min, max;
                if (currentStrokeType === 'marker') { min = currentThickness; max = currentThickness; }
                else if (currentStrokeType === 'pen') { min = currentThickness * 0.15; max = currentThickness * 3.0; }
                else if (currentStrokeType === 'brush') { min = currentThickness * 0.1; max = currentThickness * 4.0; }
                else if (currentStrokeType === 'fine') { min = currentThickness * 0.9; max = currentThickness * 1.1; }
                else { min = currentThickness * 0.45; max = currentThickness * 2.0; }
                data[index].minWidth = min;
                data[index].maxWidth = max;
            }
        });
        signaturePad.fromData(data);
        drawSelectionHighlights();
    } else {
        updateStrokeStyles();
    }
    updateStrokePreview();
}

function hexToRgba(hex, alpha) {
    if (alpha >= 1) return hex;
    let r, g, b;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyColor(colorHex) {
    if (!colorHex) return;
    lastBaseColor = colorHex;
    const finalColor = hexToRgba(colorHex, currentAlpha);

    signaturePad.penColor = finalColor;

    if (selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                data[index].penColor = finalColor;
            }
        });
        signaturePad.fromData(data);
    }

    updateSelectedBounds();
    if (typeof drawSelectionHighlights === 'function') drawSelectionHighlights();
    updateStrokePreview();
}

function updateStrokePreview() {
    const previewCanvas = document.getElementById('strokePreviewCanvas');
    if (!previewCanvas) return;
    const pctx = previewCanvas.getContext('2d');
    const w = previewCanvas.clientWidth;
    const h = previewCanvas.clientHeight;
    previewCanvas.width = w;
    previewCanvas.height = h;

    pctx.clearRect(0, 0, w, h);
    pctx.strokeStyle = hexToRgba(lastBaseColor, currentAlpha);
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';

    const centerY = h / 2;
    const startX = w * 0.15;
    const endX = w * 0.85;

    let minW, maxW;
    if (currentStrokeType === 'marker') { minW = currentThickness; maxW = currentThickness; }
    else if (currentStrokeType === 'pen') { minW = currentThickness * 0.3; maxW = currentThickness * 2.5; }
    else if (currentStrokeType === 'brush') { minW = currentThickness * 0.1; maxW = currentThickness * 4.0; }
    else if (currentStrokeType === 'fine') { minW = currentThickness * 0.9; maxW = currentThickness * 1.1; }
    else { minW = currentThickness * 0.6; maxW = currentThickness * 1.8; }

    const points = 40;
    for (let i = 0; i <= points; i++) {
        const t = i / points;
        const x = startX + (endX - startX) * t;
        const angle = t * Math.PI;
        const swing = Math.sin(angle * 2) * (h * 0.2);
        const y = centerY + swing;

        const pressure = 0.3 + Math.sin(t * Math.PI) * 0.7;
        const currentW = minW + (maxW - minW) * pressure;

        if (i === 0) pctx.moveTo(x, y);
        else {
            pctx.beginPath();
            const prevT = (i - 1) / points;
            const prevX = startX + (endX - startX) * prevT;
            const prevSwing = Math.sin(prevT * Math.PI * 2) * (h * 0.2);
            const prevY = centerY + prevSwing;
            pctx.moveTo(prevX, prevY);
            pctx.lineTo(x, y);
            pctx.lineWidth = currentW;
            pctx.stroke();
        }
    }
}
