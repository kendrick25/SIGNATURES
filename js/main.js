// main.js
// Main entry point: Event listeners, coordinate mapping, and initialization.

document.addEventListener('DOMContentLoaded', () => {
    // Render dynamic UI components
    if (typeof renderUIComponents === 'function') {
        renderUIComponents();
        if (typeof updateGlobalReferences === 'function') updateGlobalReferences();
    }

    // Initial UI setup
    if (typeof lucide !== 'undefined') lucide.createIcons();
    updateLanguage(currentLang);
    updateWorkspaceTransform();
    syncSizeValues();
    updateStrokeStyles();
    updateStrokePreview();
    updateHistoryButtons();
    resizeCanvas();
    setupExportHandlers();

    // Set initial mode
    setMode('draw');
    recenterCanvas();

    // --- Control Listeners ---

    // Thickness
    const thicknessSlider = document.getElementById('thicknessSlider');
    const thicknessVal = document.getElementById('thicknessVal');
    if (thicknessSlider) thicknessSlider.addEventListener('input', (e) => updateThickness(e.target.value));
    if (thicknessVal) thicknessVal.addEventListener('change', (e) => updateThickness(e.target.value));

    document.getElementById('incWidth')?.addEventListener('click', () => updateThickness(currentThickness + 0.5));
    document.getElementById('decWidth')?.addEventListener('click', () => updateThickness(currentThickness - 0.5));

    // Alpha
    const alphaSlider = document.getElementById('alphaSlider');
    const alphaVal = document.getElementById('alphaVal');
    if (alphaSlider) {
        alphaSlider.addEventListener('input', (e) => {
            currentAlpha = parseFloat(e.target.value);
            if (alphaVal) alphaVal.innerText = Math.round(currentAlpha * 100) + '%';
            applyColor(lastBaseColor);
        });
    }

    // Canvas Size
    const widthSlider = document.getElementById('widthSlider');
    const heightSlider = document.getElementById('heightSlider');
    const widthVal = document.getElementById('canvasWidthVal');
    const heightVal = document.getElementById('canvasHeightVal');

    const updateCanvasW = (w) => {
        container.style.width = w + 'px';
        syncSizeValues();
        resizeCanvas();
    }
    const updateCanvasH = (h) => {
        container.style.height = h + 'px';
        syncSizeValues();
        resizeCanvas();
    }

    widthSlider?.addEventListener('input', (e) => updateCanvasW(e.target.value));
    widthVal?.addEventListener('change', (e) => updateCanvasW(e.target.value));
    document.getElementById('incCanvasWidth')?.addEventListener('click', () => updateCanvasW(container.offsetWidth + 50));
    document.getElementById('decCanvasWidth')?.addEventListener('click', () => updateCanvasW(container.offsetWidth - 50));

    heightSlider?.addEventListener('input', (e) => updateCanvasH(e.target.value));
    heightVal?.addEventListener('change', (e) => updateCanvasH(e.target.value));
    document.getElementById('incCanvasHeight')?.addEventListener('click', () => updateCanvasH(container.offsetHeight + 50));
    document.getElementById('decCanvasHeight')?.addEventListener('click', () => updateCanvasH(container.offsetHeight - 50));

    // Zoom
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValInput = document.getElementById('zoomVal');

    const updateZoom = (z) => {
        workspaceScale = z / 100;
        updateWorkspaceTransform();
    }

    zoomSlider?.addEventListener('input', (e) => updateZoom(e.target.value));
    zoomValInput?.addEventListener('change', (e) => updateZoom(e.target.value));
    document.getElementById('incZoom')?.addEventListener('click', () => updateZoom((workspaceScale * 100) + 10));
    document.getElementById('decZoom')?.addEventListener('click', () => updateZoom((workspaceScale * 100) - 10));

    function attachDynamicListeners() {
        // Modes
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        // Stroke Presets
        strokeTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                strokeTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyStrokeType(btn.dataset.preset);
            });
        });

        // Color Picker
        colorDots.forEach(dot => {
            dot.addEventListener('click', () => {
                colorDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                applyColor(dot.getAttribute('data-color'));
            });
        });

        const customColorBtn = document.getElementById('customColorBtn');
        const hiddenColorInput = document.getElementById('hiddenColorInput');
        if (customColorBtn && hiddenColorInput) {
            customColorBtn.onclick = () => hiddenColorInput.click();
            hiddenColorInput.oninput = (e) => {
                colorDots.forEach(d => d.classList.remove('active'));
                applyColor(e.target.value);
            };
        }

        // Language
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                updateLanguage(btn.dataset.lang);
                renderUIComponents();
                updateGlobalReferences();
                attachDynamicListeners();
            });
        });

        // Size Presets
        document.querySelectorAll('#canvasSizePresets .preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#canvasSizePresets .preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const size = btn.dataset.size;
                if (size === 'normal') { updateCanvasW(836); updateCanvasH(400); }
                else if (size === 'medium') { updateCanvasW(1200); updateCanvasH(600); }
                else if (size === 'large') { updateCanvasW(1600); updateCanvasH(800); }
            });
        });

        // Tools (Undo, Redo, Clear)
        document.getElementById('undoBtn')?.addEventListener('click', undo);
        document.getElementById('redoBtn')?.addEventListener('click', redo);
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            if (!signaturePad.isEmpty()) {
                saveState();
                signaturePad.clear();
                if (hint) hint.classList.remove('hidden');
                deselectStroke(false);
            }
        });

        // Workspace Bottom Buttons
        document.getElementById('resetSizeBtn')?.addEventListener('click', autoAdjustCanvas);
        document.getElementById('centerCanvasBtn')?.addEventListener('click', recenterCanvas);

        // Dark Mode
        document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
            document.body.classList.toggle('light-mode', !e.target.checked);
        });

        // Fullscreen
        document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                document.getElementById('fullscreenBtn').innerHTML = '<i data-lucide="minimize" size="16"></i>';
            } else {
                document.exitFullscreen();
                document.getElementById('fullscreenBtn').innerHTML = '<i data-lucide="maximize" size="16"></i>';
            }
            lucide.createIcons();
        });

        // Export Handlers
        if (typeof setupExportHandlers === 'function') setupExportHandlers();
    }

    // Initial attachment
    attachDynamicListeners();

    // Panel Toggles - These are static in the HTML
    document.getElementById('minimizeBtn')?.addEventListener('click', () => {
        sidePanel.classList.toggle('minimized');
        document.body.classList.toggle('panel-minimized', sidePanel.classList.contains('minimized'));
    });

    document.getElementById('dockBtn')?.addEventListener('click', () => {
        sidePanel.classList.toggle('docked');
        document.body.classList.toggle('panel-docked', sidePanel.classList.contains('docked'));
    });

    // Finalize initialization
    if (typeof lucide !== 'undefined') lucide.createIcons();


    // Undo/Redo - Handled in attachDynamicListeners


    // Warn before leaving if there are changes
    window.addEventListener('beforeunload', (e) => {
        if (!signaturePad.isEmpty() || history.length > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// Coordinate Mapping Helper
// Maps screen coordinates (clientX/Y) to logical layout coordinates (untouched by ratio)
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();

    // Scale factor between screen pixels and canvas 'layout' pixels
    // rect.width is the scaled screen width, (canvas.width / ratio) is the layout width
    const scaleX = rect.width / (canvas.width / ratio);
    const scaleY = rect.height / (canvas.height / ratio);

    return {
        x: (e.clientX - rect.left) / scaleX,
        y: (e.clientY - rect.top) / scaleY
    };
}

// Logic to Client conversion (for DOM positioning of selection box)
function logicToClient(val) {
    return val; // Since internal coordinates are now layout coordinates
}


// --- Interaction Handlers ---

window.addEventListener('mousedown', (e) => {
    // Middle click always pans
    if (e.button === 1) {
        modeBeforeMiddleClick = currentMode;
        setMode('pan');
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        return;
    }

    const { x: cx, y: cy } = getCanvasCoordinates(e);
    canvasX = cx;
    canvasY = cy;

    const rect = canvas.getBoundingClientRect();
    const isInsideCanvas = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
    );
    const isHandle = e.target.classList.contains('resize-handle');
    if (!isInsideCanvas && !isHandle) return;

    if ((currentMode === 'select' || currentMode === 'transform') && (isInsideCanvas || isHandle)) {
        const bounds = getSelectedDataBounds();
        const clickedOnStroke = isPointNearStrokes(canvasX, canvasY, selectedStrokeIndices);
        const clickedInsideSelection = (canvasX >= bounds.minX && canvasX <= bounds.maxX && canvasY >= bounds.minY && canvasY <= bounds.maxY);

        if (isHandle) {
            resizeType = e.target.dataset.type;
            saveState();
            initialTransformData = JSON.parse(JSON.stringify(signaturePad.toData()));
            transformPivot = {
                x: (bounds.minX + bounds.maxX) / 2,
                y: (bounds.minY + bounds.maxY) / 2,
                minX: bounds.minX,
                minY: bounds.minY,
                width: bounds.maxX - bounds.minX,
                height: bounds.maxY - bounds.minY
            };

            if (resizeType === 'rotate') {
                isRotating = true;
                rotateStart.angle = Math.atan2(canvasY - transformPivot.y, canvasX - transformPivot.x);
            } else {
                isResizing = true;
                resizeStart.x = canvasX;
                resizeStart.y = canvasY;
            }
        } else if (clickedOnStroke || (currentMode === 'transform' && clickedInsideSelection)) {
            saveState();
            isMoving = true;
            moveStart.x = canvasX;
            moveStart.y = canvasY;
            initialTransformData = JSON.parse(JSON.stringify(signaturePad.toData()));
        } else if (isInsideCanvas && currentMode === 'select') {
            isSelecting = true;
            selectStart.x = canvasX;
            selectStart.y = canvasY;
            selectionBox.style.display = 'block';
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
        } else if (isInsideCanvas && currentMode === 'transform' && !clickedInsideSelection) {
            findStrokesInArea(canvasX, canvasY, canvasX, canvasY, e.shiftKey, e.ctrlKey);
        }
    } else if (currentMode === 'pan') {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        workspacePan.x += (e.clientX - panStart.x);
        workspacePan.y += (e.clientY - panStart.y);
        panStart = { x: e.clientX, y: e.clientY };
        updateWorkspaceTransform();
        return;
    }

    const { x: cx, y: cy } = getCanvasCoordinates(e);

    if (isSelecting) {
        const x = Math.min(cx, selectStart.x);
        const y = Math.min(cy, selectStart.y);
        const w = Math.abs(cx - selectStart.x);
        const h = Math.abs(cy - selectStart.y);

        selectionBox.style.left = logicToClient(x) + 'px';
        selectionBox.style.top = logicToClient(y) + 'px';
        selectionBox.style.width = logicToClient(w) + 'px';
        selectionBox.style.height = logicToClient(h) + 'px';
    } else if (isMoving) {
        const dx = cx - moveStart.x;
        const dy = cy - moveStart.y;
        if (dx !== 0 || dy !== 0) {
            const data = JSON.parse(JSON.stringify(initialTransformData));
            selectedStrokeIndices.forEach(idx => {
                if (data[idx]) {
                    data[idx].points.forEach(p => { p.x += dx; p.y += dy; });
                }
            });
            signaturePad.fromData(data);
            updateSelectedBounds();
            drawSelectionHighlights();
        }
    } else if (isResizing) {
        const dx = cx - resizeStart.x;
        const dy = cy - resizeStart.y;
        const data = JSON.parse(JSON.stringify(initialTransformData));
        const b = transformPivot;

        let sx = 1, sy = 1;
        if (resizeType === 'width' || resizeType === 'both') sx = (b.width + dx) / b.width;
        if (resizeType === 'height' || resizeType === 'both') sy = (b.height + dy) / b.height;
        sx = Math.max(0.05, sx); sy = Math.max(0.05, sy);

        selectedStrokeIndices.forEach(idx => {
            if (data[idx]) {
                data[idx].points.forEach(p => {
                    p.x = b.minX + (p.x - b.minX) * sx;
                    p.y = b.minY + (p.y - b.minY) * sy;
                    p.pressure *= (sx + sy) / 2;
                });
                data[idx].minWidth *= (sx + sy) / 2;
                data[idx].maxWidth *= (sx + sy) / 2;
            }
        });
        signaturePad.fromData(data);
        updateSelectedBounds();
        drawSelectionHighlights();
    } else if (isRotating) {
        const currentAngle = Math.atan2(cy - transformPivot.y, cx - transformPivot.x);
        const diff = currentAngle - rotateStart.angle;

        const data = JSON.parse(JSON.stringify(initialTransformData));
        const cos = Math.cos(diff), sin = Math.sin(diff);

        selectedStrokeIndices.forEach(idx => {
            if (data[idx]) {
                data[idx].points.forEach(p => {
                    const rx = p.x - transformPivot.x, ry = p.y - transformPivot.y;
                    p.x = transformPivot.x + rx * cos - ry * sin;
                    p.y = transformPivot.y + rx * sin + ry * cos;
                });
            }
        });
        signaturePad.fromData(data);
        updateSelectedBounds();
        drawSelectionHighlights();
    }
});

window.addEventListener('mouseup', (e) => {
    if (isPanning) {
        isPanning = false;
        if (modeBeforeMiddleClick) {
            setMode(modeBeforeMiddleClick);
            modeBeforeMiddleClick = null;
        }
    }
    if (isSelecting) {
        isSelecting = false;
        selectionBox.style.display = 'none';
        const { x: cx, y: cy } = getCanvasCoordinates(e);
        findStrokesInArea(selectStart.x, selectStart.y, cx, cy, e.shiftKey, e.ctrlKey);
    }
    isMoving = false;
    isResizing = false;
    isRotating = false;
});

// --- Selection Logic ---

function getSelectedDataBounds() {
    const data = signaturePad.toData();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedStrokeIndices.forEach(idx => {
        if (data[idx]) {
            data[idx].points.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        }
    });
    return { minX, minY, maxX, maxY };
}

function isPointNearStrokes(cx, cy, indices) {
    const data = signaturePad.toData();
    return indices.some(idx => {
        const stroke = data[idx];
        if (!stroke) return false;
        const radius = (stroke.maxWidth + stroke.minWidth) / 2 + 10;
        return stroke.points.some(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) < radius);
    });
}

function findStrokesInArea(x1, y1, x2, y2, shift, ctrl) {
    const data = signaturePad.toData();
    const found = [];
    const isClick = Math.abs(x2 - x1) < 10 && Math.abs(y2 - y1) < 10;
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;

    data.forEach((stroke, idx) => {
        let match = false;
        const radius = (stroke.maxWidth + stroke.minWidth) / 2 + 5;
        stroke.points.forEach(p => {
            if (isClick) {
                if (Math.sqrt((p.x - midX) ** 2 + (p.y - midY) ** 2) < radius + 10) match = true;
            } else {
                const left = Math.min(x1, x2), right = Math.max(x1, x2);
                const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
                if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) match = true;
            }
        });
        if (match) found.push(idx);
    });

    if (ctrl && isClick) {
        if (found.length > 0) {
            const idx = found[0];
            const i = selectedStrokeIndices.indexOf(idx);
            let next = [...selectedStrokeIndices];
            if (i > -1) next.splice(i, 1); else next.push(idx);
            selectStrokes(next);
        }
    } else if (shift) {
        selectStrokes([...new Set([...selectedStrokeIndices, ...found])]);
    } else {
        if (found.length > 0) selectStrokes(found);
        else if (isClick) deselectStroke();
    }
}

function selectStrokes(indices, save = true) {
    const isSame = indices.length === selectedStrokeIndices.length && indices.every((v, i) => v === selectedStrokeIndices[i]);
    if (isSame) return;
    if (save) saveState();
    selectedStrokeIndices = indices;
    if (selectionInfo) {
        selectionInfo.innerText = `Trazos Seleccionados: ${indices.length}`;
        selectionInfo.style.display = indices.length > 0 ? 'block' : 'none';
    }
    updateSelectedBounds();
    drawSelectionHighlights();
    syncControlsWithSelection();
}

function deselectStroke(save = true) {
    if (selectedStrokeIndices.length === 0) return;
    if (save) saveState();
    selectedStrokeIndices = [];
    if (selectionInfo) selectionInfo.style.display = 'none';
    updateSelectedBounds();
    drawSelectionHighlights();
}

function updateSelectedBounds() {
    const el = document.getElementById('selectedBounds');
    if (!el) return;
    if (selectedStrokeIndices.length === 0 || (currentMode !== 'transform' && currentMode !== 'select')) {
        el.style.display = 'none'; return;
    }
    const b = getSelectedDataBounds();
    if (b.minX === Infinity) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    el.style.left = logicToClient(b.minX) + 'px';
    el.style.top = logicToClient(b.minY) + 'px';
    el.style.width = logicToClient(b.maxX - b.minX) + 'px';
    el.style.height = logicToClient(b.maxY - b.minY) + 'px';

    if (currentMode === 'select') {
        el.classList.add('no-handles');
        el.style.border = 'none'; el.style.opacity = '0';
    } else {
        el.classList.remove('no-handles');
        el.style.border = '1px dashed var(--primary)'; el.style.opacity = '1';
    }
}

function drawSelectionHighlights() {
    if (!selectionCanvas || !sctx) return;
    sctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    if (selectedStrokeIndices.length === 0 || currentMode !== 'select') return;
    const data = signaturePad.toData();
    sctx.lineCap = 'round'; sctx.lineJoin = 'round';
    selectedStrokeIndices.forEach(idx => {
        const stroke = data[idx];
        if (!stroke || stroke.points.length < 2) return;
        sctx.beginPath();
        sctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((p, i) => { if (i > 0) sctx.lineTo(p.x, p.y); });
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        sctx.lineWidth = (stroke.maxWidth + stroke.minWidth) + 10;
        sctx.stroke();
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        sctx.lineWidth = 2;
        sctx.stroke();
    });
}

function syncControlsWithSelection() {
    if (selectedStrokeIndices.length === 0) return;
    const data = signaturePad.toData();
    const first = data[selectedStrokeIndices[0]];
    if (!first) return;

    currentThickness = (first.maxWidth + first.minWidth) / 2;
    const strokeColor = first.penColor || '#ffffff';
    let base = '#ffffff', alpha = 1.0;

    if (strokeColor.startsWith('rgba')) {
        const m = strokeColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (m) {
            base = `#${[m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('')}`;
            alpha = parseFloat(m[4]);
        }
    } else if (strokeColor.startsWith('#')) base = strokeColor;

    lastBaseColor = base; currentAlpha = alpha;

    // Update UI
    const alphaSlider = document.getElementById('alphaSlider');
    const alphaVal = document.getElementById('alphaVal');
    if (alphaSlider) alphaSlider.value = alpha;
    if (alphaVal) alphaVal.innerText = Math.round(alpha * 100) + '%';

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-color')?.toLowerCase() === base.toLowerCase());
    });

    const variety = first.maxWidth / first.minWidth;
    if (variety > 4) currentStrokeType = 'pen';
    else if (variety < 1.1) currentStrokeType = 'marker';
    else currentStrokeType = 'natural';

    document.querySelectorAll('#strokeTypePresets .preset-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === currentStrokeType));

    const thicknessVal = document.getElementById('thicknessVal');
    const thicknessSlider = document.getElementById('thicknessSlider');
    if (thicknessVal) thicknessVal.value = currentThickness.toFixed(1);
    if (thicknessSlider) thicknessSlider.value = currentThickness;
}

// --- Clipboard & Tools ---

function copySelection() {
    if (selectedStrokeIndices.length === 0) return;
    const data = signaturePad.toData();
    clipboardStrokes = selectedStrokeIndices.map(idx => JSON.parse(JSON.stringify(data[idx])));
    showToast(i18n[currentLang].toastStrokesCopied, "#6366f1");
}

function pasteSelection() {
    if (clipboardStrokes.length === 0) return;
    saveState();
    const data = signaturePad.toData();
    const offset = 20;
    const newStrokes = clipboardStrokes.map(s => {
        const clone = JSON.parse(JSON.stringify(s));
        clone.points.forEach(p => { p.x += offset; p.y += offset; });
        return clone;
    });
    const nextData = [...data, ...newStrokes];
    const newIndices = newStrokes.map((_, i) => data.length + i);
    signaturePad.fromData(nextData);
    selectStrokes(newIndices, false);
    showToast(i18n[currentLang].toastStrokesPasted, "#6366f1");
}

function deleteSelection() {
    if (selectedStrokeIndices.length === 0) return;
    saveState();
    const data = signaturePad.toData();
    const next = data.filter((_, i) => !selectedStrokeIndices.includes(i));
    signaturePad.fromData(next);
    deselectStroke(false);
    if (next.length === 0 && hint) hint.classList.remove('hidden');
}

// --- Global Event Listeners ---

window.addEventListener('keydown', (e) => {
    if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) return;
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (ctrl && key === 'y') { e.preventDefault(); redo(); }
    else if (ctrl && key === 'c') { e.preventDefault(); copySelection(); }
    else if (ctrl && key === 'v') { e.preventDefault(); pasteSelection(); }
    else if (key === 'delete' || key === 'backspace') { if (selectedStrokeIndices.length > 0) { e.preventDefault(); deleteSelection(); } }
    else if (key === 'p') setMode('draw');
    else if (key === 'v') setMode('select');
    else if (key === 't') setMode('transform');
    else if (key === 'h') setMode('pan');
    else if (key === 'm') {
        sidePanel?.classList.toggle('minimized');
        document.body.classList.toggle('panel-minimized', sidePanel?.classList.contains('minimized'));
    }
});

signaturePad.addEventListener("beginStroke", () => {
    if (currentMode === 'select' || currentMode === 'move' || currentMode === 'resize') return;
    saveState();
    if (hint) hint.classList.add('hidden');
});

workspace?.addEventListener('wheel', (e) => {
    e.preventDefault();

    const delta = -e.deltaY;
    const factor = 1 + delta * 0.001;
    const newScale = Math.max(0.1, Math.min(5, workspaceScale * factor));

    if (newScale !== workspaceScale) {
        // Zoom towards mouse position
        const rect = workspace.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate the mouse position relative to the panned/scaled container
        const dx = (mouseX - workspacePan.x) / workspaceScale;
        const dy = (mouseY - workspacePan.y) / workspaceScale;

        // Update scale
        const oldScale = workspaceScale;
        workspaceScale = newScale;

        // Adjust pan to keep internal point under mouse
        workspacePan.x = mouseX - dx * workspaceScale;
        workspacePan.y = mouseY - dy * workspaceScale;

        updateWorkspaceTransform();

        // Sync zoom slider/val if they exist
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomVal = document.getElementById('zoomVal');
        if (zoomSlider) zoomSlider.value = Math.round(workspaceScale * 100);
        if (zoomVal) zoomVal.value = Math.round(workspaceScale * 100);
    }
}, { passive: false });
