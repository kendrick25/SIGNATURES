// Thickness Logic
function updateThickness(newVal) {
    currentThickness = Math.max(1, Math.min(20, parseFloat(parseFloat(newVal).toFixed(1))));
    thicknessVal.value = currentThickness;
    thicknessSlider.value = currentThickness;

    if ((currentMode === 'select' || currentMode === 'transform') && selectedStrokeIndices.length > 0) {
        saveState(); // Save BEFORE modification

        const data = signaturePad.toData();
        selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                let min, max;
                if (currentStrokeType === 'marker') { min = currentThickness; max = currentThickness; }
                else if (currentStrokeType === 'pen') { min = currentThickness * 0.3; max = currentThickness * 2.5; }
                else { min = currentThickness * 0.6; max = currentThickness * 1.8; }
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
    updateStrokePreview();
}

// Color and Alpha Logic
const alphaSlider = document.getElementById('alphaSlider');
const alphaVal = document.getElementById('alphaVal');
const customColorBtn = document.getElementById('customColorBtn');
const hiddenColorInput = document.getElementById('hiddenColorInput');

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyColor(colorHex) {
    lastBaseColor = colorHex;
    const finalColor = hexToRgba(colorHex, currentAlpha);
    signaturePad.penColor = finalColor;

    if ((currentMode === 'select' || currentMode === 'transform') && selectedStrokeIndices.length > 0) {
        saveState(); // Save BEFORE modification

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
    updateStrokePreview();
}

// Stroke Preview Logic
const previewCanvas = document.getElementById('strokePreviewCanvas');
const pctx = previewCanvas.getContext('2d');

function updateStrokePreview() {
    const w = previewCanvas.clientWidth;
    const h = previewCanvas.clientHeight;
    previewCanvas.width = w;
    previewCanvas.height = h;

    pctx.clearRect(0, 0, w, h);
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    pctx.strokeStyle = signaturePad.penColor;
    pctx.lineWidth = currentThickness;

    // Draw a sample stroke (a smooth wave)
    pctx.beginPath();
    const startX = 20;
    const endX = w - 20;
    const midY = h / 2;

    pctx.moveTo(startX, midY);

    // Different visual styles for the preview depending on stroke type
    if (currentStrokeType === 'marker') {
        pctx.globalAlpha = 0.6;
    } else {
        pctx.globalAlpha = 1.0;
    }

    // Bezier curve for a "human" look
    pctx.bezierCurveTo(
        startX + (endX - startX) * 0.25, midY - 10,
        startX + (endX - startX) * 0.75, midY + 10,
        endX, midY
    );
    pctx.stroke();
    pctx.globalAlpha = 1.0;
}
