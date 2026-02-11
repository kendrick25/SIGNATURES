// Mode Management
function setMode(mode) {
    currentMode = mode;
    modeBtns.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
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
    drawSelectionHighlights();
}

// Selection Management
const selectedBounds = document.getElementById('selectedBounds');
let resizeType = ''; // 'width', 'height', or 'both'

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
        selectedBounds.style.opacity = '0'; // Invisible but present for click detection
    } else {
        selectedBounds.classList.remove('no-handles');
        selectedBounds.style.border = '1px dashed var(--primary)';
        selectedBounds.style.opacity = '1';
    }
}

function findStrokesInArea(x1, y1, x2, y2, shiftKey, ctrlKey) {
    const data = signaturePad.toData();
    const foundIndices = [];
    const isPointClick = Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5;

    data.forEach((stroke, index) => {
        let strokeMatch = false;
        stroke.points.forEach(point => {
            if (isPointClick) {
                const dist = Math.sqrt((point.x - x1) ** 2 + (point.y - y1) ** 2);
                if (dist < 20) strokeMatch = true;
            } else {
                if (point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2) {
                    strokeMatch = true;
                }
            }
        });
        if (strokeMatch) foundIndices.push(index);
    });

    if (ctrlKey && isPointClick) {
        // Toggle individual stroke
        if (foundIndices.length > 0) {
            const idx = foundIndices[0];
            const alreadySelected = selectedStrokeIndices.indexOf(idx);
            if (alreadySelected > -1) {
                selectedStrokeIndices.splice(alreadySelected, 1);
            } else {
                selectedStrokeIndices.push(idx);
            }
        }
        selectStrokes(selectedStrokeIndices);
    } else if (shiftKey) {
        // Add area to selection
        const newIndices = [...new Set([...selectedStrokeIndices, ...foundIndices])];
        selectStrokes(newIndices);
    } else {
        // Normal selection or click outside
        if (foundIndices.length > 0) {
            selectStrokes(foundIndices);
        } else if (isPointClick) {
            deselectStroke();
        }
    }
}

function selectStrokes(indices, saveHistory = true) {
    // Check if different to avoid redundant saves
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

function syncControlsWithSelection() {
    if (selectedStrokeIndices.length > 0) {
        // Sync controls with the first selected stroke
        const data = signaturePad.toData();
        const firstStroke = data[selectedStrokeIndices[0]];
        if (firstStroke) {
            currentThickness = (firstStroke.maxWidth + firstStroke.minWidth) / 2;
            thicknessVal.value = currentThickness.toFixed(1);
            thicknessSlider.value = currentThickness;

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

function deselectStroke(saveHistory = true) {
    if (selectedStrokeIndices.length === 0) return;

    if (saveHistory) saveState();

    selectedStrokeIndices = [];
    selectionInfo.style.display = 'none';
    updateSelectedBounds();
    drawSelectionHighlights();
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

        // Draw a highlight "glow"
        sctx.beginPath();
        sctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((p, i) => {
            if (i > 0) sctx.lineTo(p.x, p.y);
        });

        sctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        sctx.lineWidth = (stroke.maxWidth + stroke.minWidth) + 10;
        sctx.stroke();

        // Inner highlight border
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        sctx.lineWidth = 2;
        sctx.stroke();
    });
}

// Clipboard Logic
function copySelection() {
    if (selectedStrokeIndices.length === 0) return;

    const data = signaturePad.toData();
    clipboardStrokes = selectedStrokeIndices.map(index => {
        // Deep copy
        return JSON.parse(JSON.stringify(data[index]));
    });

    showToast("Trazos copiados", "#6366f1");
}

function pasteSelection() {
    if (clipboardStrokes.length === 0) return;

    // Save state BEFORE pasting
    saveState();

    const data = signaturePad.toData();
    const newIndices = [];

    // Calculate offset to prevent exact overlap
    const offset = 20 / workspaceScale;

    clipboardStrokes.forEach(stroke => {
        const newStroke = JSON.parse(JSON.stringify(stroke));
        newStroke.points.forEach(p => {
            p.x += offset;
            p.y += offset;
        });
        data.push(newStroke);
        newIndices.push(data.length - 1);
    });

    signaturePad.fromData(data);

    // Select pasted items, don't save again
    selectStrokes(newIndices, false);

    showToast("Trazos pegados", "#6366f1");
}

function deleteSelection() {
    if (selectedStrokeIndices.length === 0) return;

    // Save state BEFORE deleting
    saveState();

    const data = signaturePad.toData();
    // Filter out selected indices
    const newData = data.filter((_, index) => !selectedStrokeIndices.includes(index));

    signaturePad.fromData(newData);
    deselectStroke(false); // Don't save, we just saved

    if (newData.length === 0) hint.classList.remove('hidden');
}
