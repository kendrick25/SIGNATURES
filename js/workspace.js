// ===========================
// WORKSPACE.JS - Workspace Transformations & Interactions
// ===========================

// DOM Elements
const workspace = document.getElementById('workspace');
const centerCanvasBtn = document.getElementById('centerCanvasBtn');
const cropBtn = document.getElementById('cropBtn');

// Workspace State
let workspacePan = { x: 0, y: 0 };
let workspaceScale = 1.0;
let isPanning = false;
let panStart = { x: 0, y: 0 };

// ===========================
// MODE MANAGEMENT
// ===========================
function setMode(mode) {
    window.currentMode = mode;
    const modeBtns = document.querySelectorAll('#modeToggle .preset-btn');
    const canvas = document.getElementById('signatureCanvas');

    modeBtns.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (window.currentMode === 'transform') {
        canvas.style.cursor = 'move';
        window.signaturePad.off();
    } else if (window.currentMode === 'select') {
        canvas.style.cursor = 'default';
        window.signaturePad.off();
    } else if (window.currentMode === 'pan') {
        canvas.style.cursor = 'grab';
        window.signaturePad.off();
    } else {
        canvas.style.cursor = 'crosshair';
        window.signaturePad.on();
        window.deselectStroke();
    }
    window.updateSelectedBounds();
    window.drawSelectionHighlights();
}

// Mode Switch Logic
document.querySelectorAll('#modeToggle .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
    });
});

// ===========================
// WORKSPACE TRANSFORM
// ===========================
function updateWorkspaceTransform() {
    const container = document.getElementById('canvasContainer');
    container.style.transform = `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceScale})`;

    const zoomPercent = Math.round(workspaceScale * 100);
    document.getElementById('zoomVal').value = zoomPercent;
    document.getElementById('zoomSlider').value = zoomPercent;
}

function centerCanvas() {
    workspacePan = { x: 0, y: 0 };
    workspaceScale = 1.0;
    updateWorkspaceTransform();
}

centerCanvasBtn.addEventListener('click', centerCanvas);

// ===========================
// ZOOM CONTROLS
// ===========================
window.setupScrubber(document.getElementById('zoomScrubArea'), (val) => {
    workspaceScale = Math.max(0.1, Math.min(5, val / 100));
    updateWorkspaceTransform();
}, () => workspaceScale * 100, 1);

document.getElementById('zoomVal').addEventListener('change', (e) => {
    workspaceScale = Math.max(0.1, Math.min(5, parseInt(e.target.value) / 100));
    updateWorkspaceTransform();
});

document.getElementById('zoomSlider').addEventListener('input', (e) => {
    workspaceScale = parseInt(e.target.value) / 100;
    updateWorkspaceTransform();
});

window.setupLongPress(document.getElementById('decZoom'), () => {
    workspaceScale = Math.max(0.1, workspaceScale - 0.05);
    updateWorkspaceTransform();
});

window.setupLongPress(document.getElementById('incZoom'), () => {
    workspaceScale = Math.min(5, workspaceScale + 0.05);
    updateWorkspaceTransform();
});

// Wheel for Zoom
workspace.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;

    workspaceScale *= (1 + delta * zoomSpeed);
    workspaceScale = Math.max(0.1, Math.min(5, workspaceScale));

    updateWorkspaceTransform();
}, { passive: false });

// ===========================
// SELECTION & INTERACTION
// ===========================
const selectionBox = document.createElement('div');
selectionBox.id = 'selectionBox';
selectionBox.style.position = 'absolute';
selectionBox.style.border = '2px dashed var(--primary)';
selectionBox.style.background = 'rgba(99, 102, 241, 0.1)';
selectionBox.style.pointerEvents = 'none';
selectionBox.style.display = 'none';
selectionBox.style.zIndex = '999';
document.getElementById('canvasContainer').appendChild(selectionBox);

let selectStart = { x: 0, y: 0 };
let isSelecting = false;
let isMoving = false;
let isResizing = false;
let moveStart = { x: 0, y: 0 };
let resizeStart = { x: 0, y: 0 };
let resizeType = '';
let modeBeforeMiddleClick = null;

// ===========================
// MOUSE INTERACTIONS
// ===========================
window.addEventListener('mousedown', (e) => {
    const canvas = document.getElementById('signatureCanvas');
    const rect = canvas.getBoundingClientRect();

    // Middle click (button 1) always pans
    if (e.button === 1) {
        if (window.currentMode !== 'pan') {
            modeBeforeMiddleClick = window.currentMode;
            setMode('pan');
        }
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }

    if (window.currentMode === 'pan') {
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }

    const isInsideCanvas = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
    );

    const isHandle = e.target.classList.contains('resize-handle');

    if (!isInsideCanvas && !isHandle) return;

    const canvasX = (e.clientX - rect.left) / workspaceScale;
    const canvasY = (e.clientY - rect.top) / workspaceScale;

    if (window.currentMode === 'select' && isInsideCanvas) {
        let clickedInsideSelection = false;
        if (window.selectedStrokeIndices.length > 0) {
            const selectedBounds = document.getElementById('selectedBounds');
            const bRect = selectedBounds.getBoundingClientRect();
            if (e.clientX >= bRect.left && e.clientX <= bRect.right &&
                e.clientY >= bRect.top && e.clientY <= bRect.bottom) {
                clickedInsideSelection = true;
            }
        }

        if (clickedInsideSelection) {
            window.saveState();
            moveStart.x = e.clientX - rect.left;
            moveStart.y = e.clientY - rect.top;
            isMoving = true;
        } else {
            selectStart.x = e.clientX - rect.left;
            selectStart.y = e.clientY - rect.top;
            isSelecting = true;

            selectionBox.style.left = selectStart.x + 'px';
            selectionBox.style.top = selectStart.y + 'px';
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            selectionBox.style.display = 'block';
        }
    } else if (window.currentMode === 'transform') {
        if (window.selectedStrokeIndices.length === 0) {
            if (isInsideCanvas) {
                findStrokesInArea(canvasX, canvasY, canvasX, canvasY, e.shiftKey, e.ctrlKey);
                if (window.selectedStrokeIndices.length > 0) {
                    window.saveState();
                    moveStart.x = canvasX;
                    moveStart.y = canvasY;
                    isMoving = true;
                } else {
                    window.showToast("Primero selecciona trazos", "#6366f1");
                }
            }
            return;
        }

        if (isHandle) {
            resizeType = e.target.dataset.type;
            isResizing = true;
            resizeStart.x = canvasX;
            resizeStart.y = canvasY;
            window.saveState();
        } else if (isInsideCanvas) {
            const selectedBounds = document.getElementById('selectedBounds');
            const bRect = selectedBounds.getBoundingClientRect();
            const isInsideSelection = (
                e.clientX >= bRect.left && e.clientX <= bRect.right &&
                e.clientY >= bRect.top && e.clientY <= bRect.bottom
            );

            if (isInsideSelection) {
                window.saveState();
                moveStart.x = e.clientX - rect.left;
                moveStart.y = e.clientY - rect.top;
                isMoving = true;
            } else {
                findStrokesInArea(canvasX, canvasY, canvasX, canvasY, e.shiftKey, e.ctrlKey);
                window.updateSelectedBounds();
            }
        }
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        workspacePan.x += dx;
        workspacePan.y += dy;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        updateWorkspaceTransform();
        return;
    }

    const canvas = document.getElementById('signatureCanvas');
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (isSelecting && window.currentMode === 'select') {
        const x = Math.min(currentX, selectStart.x);
        const y = Math.min(currentY, selectStart.y);
        const w = Math.abs(currentX - selectStart.x);
        const h = Math.abs(currentY - selectStart.y);

        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = w + 'px';
        selectionBox.style.height = h + 'px';
    } else if (isMoving && (window.currentMode === 'transform' || window.currentMode === 'select')) {
        const dx = (currentX - moveStart.x) / workspaceScale;
        const dy = (currentY - moveStart.y) / workspaceScale;

        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
            const data = window.signaturePad.toData();
            window.selectedStrokeIndices.forEach(index => {
                if (data[index]) {
                    data[index].points.forEach(point => {
                        point.x += dx;
                        point.y += dy;
                    });
                }
            });
            window.signaturePad.fromData(data);
            window.updateSelectedBounds();
            window.drawSelectionHighlights();
            moveStart.x = currentX;
            moveStart.y = currentY;
        }
    } else if (isResizing && window.currentMode === 'transform') {
        const dx = (currentX - resizeStart.x) / workspaceScale;
        const dy = (currentY - resizeStart.y) / workspaceScale;

        const data = window.signaturePad.toData();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        window.selectedStrokeIndices.forEach(idx => {
            data[idx].points.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        });

        const width = maxX - minX;
        const height = maxY - minY;

        let scaleX = 1;
        let scaleY = 1;

        if (resizeType === 'width' || resizeType === 'both') {
            scaleX = (width + dx) / width;
        }
        if (resizeType === 'height' || resizeType === 'both') {
            scaleY = (height + dy) / height;
        }

        if (scaleX < 0.05) scaleX = 0.05;
        if (scaleY < 0.05) scaleY = 0.05;

        window.selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                data[index].points.forEach(point => {
                    point.x = minX + (point.x - minX) * scaleX;
                    point.y = minY + (point.y - minY) * scaleY;
                    point.pressure *= (scaleX + scaleY) / 2;
                });
                data[index].minWidth *= (scaleX + scaleY) / 2;
                data[index].maxWidth *= (scaleX + scaleY) / 2;
            }
        });

        window.signaturePad.fromData(data);
        window.updateSelectedBounds();
        window.drawSelectionHighlights();
        resizeStart.x = currentX;
        resizeStart.y = currentY;
    }
});

window.addEventListener('mouseup', (e) => {
    const canvas = document.getElementById('signatureCanvas');

    if (isPanning) {
        isPanning = false;
        if (modeBeforeMiddleClick) {
            setMode(modeBeforeMiddleClick);
            modeBeforeMiddleClick = null;
        } else if (window.currentMode === 'pan') {
            canvas.style.cursor = 'grab';
        }
    }
    if (isSelecting && window.currentMode === 'select') {
        isSelecting = false;
        selectionBox.style.display = 'none';

        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const x1 = Math.min(selectStart.x, endX) / workspaceScale;
        const y1 = Math.min(selectStart.y, endY) / workspaceScale;
        const x2 = Math.max(selectStart.x, endX) / workspaceScale;
        const y2 = Math.max(selectStart.y, endY) / workspaceScale;

        findStrokesInArea(x1, y1, x2, y2, e.shiftKey, e.ctrlKey);
    } else if (isMoving) {
        isMoving = false;
    } else if (isResizing) {
        isResizing = false;
    }
});

// ===========================
// STROKE SELECTION
// ===========================
function findStrokesInArea(x1, y1, x2, y2, shiftKey, ctrlKey) {
    const data = window.signaturePad.toData();
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
        if (foundIndices.length > 0) {
            const idx = foundIndices[0];
            const alreadySelected = window.selectedStrokeIndices.indexOf(idx);
            if (alreadySelected > -1) {
                window.selectedStrokeIndices.splice(alreadySelected, 1);
            } else {
                window.selectedStrokeIndices.push(idx);
            }
        }
        window.selectStrokes(window.selectedStrokeIndices);
    } else if (shiftKey) {
        const newIndices = [...new Set([...window.selectedStrokeIndices, ...foundIndices])];
        window.selectStrokes(newIndices);
    } else {
        if (foundIndices.length > 0) {
            window.selectStrokes(foundIndices);
        } else if (isPointClick) {
            window.deselectStroke();
        }
    }
}

// ===========================
// CLIPBOARD OPERATIONS
// ===========================
let clipboardStrokes = [];

function copySelection() {
    if (window.selectedStrokeIndices.length === 0) return;

    const data = window.signaturePad.toData();
    clipboardStrokes = window.selectedStrokeIndices.map(index => {
        return JSON.parse(JSON.stringify(data[index]));
    });

    window.showToast("Trazos copiados", "#6366f1");
}

function pasteSelection() {
    if (clipboardStrokes.length === 0) return;

    window.saveState();

    const data = window.signaturePad.toData();
    const newIndices = [];

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

    window.signaturePad.fromData(data);
    window.selectStrokes(newIndices, false);

    window.showToast("Trazos pegados", "#6366f1");
}

function deleteSelection() {
    if (window.selectedStrokeIndices.length === 0) return;

    window.saveState();

    const data = window.signaturePad.toData();
    const newData = data.filter((_, index) => !window.selectedStrokeIndices.includes(index));

    window.signaturePad.fromData(newData);
    window.deselectStroke(false);

    const hint = document.getElementById('canvasHint');
    if (newData.length === 0) hint.classList.remove('hidden');
}

// ===========================
// KEYBOARD SHORTCUTS
// ===========================
window.addEventListener('keydown', (e) => {
    const isInput = ['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase());
    if (isInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection();
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteSelection();
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (window.selectedStrokeIndices.length > 0) {
            e.preventDefault();
            deleteSelection();
        }
        return;
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) window.redo();
            else window.undo();
        }
        if (e.key.toLowerCase() === 'y') {
            e.preventDefault();
            window.redo();
        }
        return;
    }

    const key = e.key.toLowerCase();
    if (key === 'p') setMode('draw');
    if (key === 'v') setMode('select');
    if (key === 't') setMode('transform');
    if (key === 'h') setMode('pan');

    if (key === 'm') {
        const sidePanel = document.getElementById('sidePanel');
        sidePanel.classList.toggle('minimized');
        document.body.classList.toggle('panel-minimized', sidePanel.classList.contains('minimized'));
    }
});

// Export for use in other modules
window.centerCanvas = centerCanvas;
window.setMode = setMode;
