import {
    signaturePad, currentMode, setMode as setStateMode, workspaceScale, workspacePan,
    isPanning, setPanning, isMoving, setMoving,
    isSelecting, setSelecting, isResizing, setResizing,
    isRotating, setRotating, selectedStrokeIndices,
    setSelectedIndices, history, redoStack, currentLang,
    workspace, hint, selectionInfo, selectionBox,
    sidePanel, lastBaseColor, setAlpha,
    currentThickness, container, canvas, setWorkspaceScale
} from '@/scripts/state';
import {
    saveState, undo, redo, updateThickness, applyStrokeType,
    applyColor, drawSelectionHighlights, updateStrokeStyles,
    updateStrokePreview, downloadPng, downloadSvg, copyPngToClipboard,
    copySelection, pasteSelection, deleteSelection
} from '@/scripts/canvas';
import {
    updateWorkspaceTransform, syncSizeValues,
    recenterCanvas, resizeCanvas, autoAdjustCanvas
} from '@/scripts/workspace';
import { renderUIComponents, updateGlobalReferences, createIcons, updateLanguage } from '@/scripts/data';
import { updateSelectedBounds, getSelectedDataBounds, syncControlsWithSelection } from '@/scripts/ui_updates';

// --- Initialization ---

export function initAppLogic() {
    updateLanguage(currentLang);
    updateWorkspaceTransform();
    syncSizeValues();
    updateStrokeStyles();
    updateStrokePreview();
    updateHistoryButtons();

    // Initialize window.currentMode for cross-module access
    (window as any).currentMode = 'draw';
    setMode('draw');
    recenterCanvas();

    attachEventListeners();
    attachDynamicListeners();
}

function updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
    const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = history.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function setMode(mode: string) {
    if (mode === currentMode && mode !== 'draw') return;
    setStateMode(mode);

    // Sync to window for other modules that check it
    (window as any).currentMode = mode;

    // Visual updates
    document.querySelectorAll('#modeToggle .preset-btn').forEach(btn => {
        (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });

    // Cursor and Pad state
    if (mode === 'draw') {
        canvas.style.cursor = 'crosshair';
        signaturePad.on();
        if (hint && signaturePad.isEmpty()) hint.classList.remove('hidden');
        deselectStroke(false);
    } else {
        signaturePad.off();
        if (hint) hint.classList.add('hidden');

        if (mode === 'transform') canvas.style.cursor = 'move';
        else if (mode === 'select') canvas.style.cursor = 'default';
        else if (mode === 'pan') canvas.style.cursor = 'grab';
    }
    updateSelectedBounds();
    drawSelectionHighlights();
}

// --- Helpers from original main.js ---

function setupContinuousClick(btnId: string, action: () => void) {
    let interval: any = null;
    let timeout: any = null;
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const start = (e: any) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        e.preventDefault();
        action();
        timeout = setTimeout(() => {
            interval = setInterval(action, 60);
        }, 400);
    };

    const stop = () => {
        clearTimeout(timeout);
        clearInterval(interval);
    };

    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start as any, { passive: false });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    btn.addEventListener('mouseleave', stop);
}

function setupScrubbing(areaId: string, getValue: () => number, setValue: (v: number) => void, step = 1) {
    const area = document.getElementById(areaId);
    if (!area) return;

    let startX = 0;
    let startVal = 0;

    const onMove = (e: any) => {
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const delta = (clientX - startX) * step;
        setValue(startVal + delta);
    };

    const onEnd = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchend', onEnd);
        document.body.style.cursor = 'default';
    };

    const onStart = (e: any) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        if (e.target.classList.contains('thickness-input')) return;

        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        startVal = getValue();

        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
        document.body.style.cursor = 'ew-resize';
    };

    area.addEventListener('mousedown', onStart);
    area.addEventListener('touchstart', onStart as any, { passive: false });
}

function getCanvasCoordinates(e: any) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
        x: (clientX - rect.left) / workspaceScale,
        y: (clientY - rect.top) / workspaceScale
    };
}

// --- Event Handlers ---

function attachEventListeners() {
    workspace?.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    signaturePad.addEventListener("beginStroke", () => {
        if (currentMode === 'select' || isMoving || isResizing || isRotating) return;
        saveState();
        if (hint) hint.classList.add('hidden');
    });

    // Static UI
    document.getElementById('minimizeBtn')?.addEventListener('click', () => {
        sidePanel.classList.toggle('minimized');
        document.body.classList.toggle('panel-minimized', sidePanel.classList.contains('minimized'));
    });

    document.getElementById('dockBtn')?.addEventListener('click', () => {
        sidePanel.classList.toggle('docked');
        document.body.classList.toggle('panel-docked', sidePanel.classList.contains('docked'));
    });

    // Control listeners (Moved to separate function for re-attachment)
    attachControlListeners();

    // Warn before leaving
    window.addEventListener('beforeunload', (e) => {
        if (!signaturePad.isEmpty() || history.length > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

function attachDynamicListeners() {
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const modeBtn = target.closest('[data-mode]') as HTMLElement;
        if (modeBtn) setMode(modeBtn.dataset.mode!);

        const presetBtn = target.closest('[data-preset]') as HTMLElement;
        if (presetBtn && target.closest('#strokeTypePresets')) {
            document.querySelectorAll('#strokeTypePresets .preset-btn').forEach(b => b.classList.remove('active'));
            presetBtn.classList.add('active');
            applyStrokeType(presetBtn.dataset.preset!);
        }

        const colorDot = target.closest('.color-dot') as HTMLElement;
        if (colorDot) {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            colorDot.classList.add('active');
            applyColor(colorDot.getAttribute('data-color')!);
        }

        const langBtn = target.closest('.lang-btn') as HTMLElement;
        if (langBtn) {
            updateLanguage(langBtn.dataset.lang!);
            renderUIComponents();
            updateGlobalReferences();
            createIcons();
            attachControlListeners();
        }

        const sizePresetBtn = target.closest('#canvasSizePresets .preset-btn') as HTMLElement;
        if (sizePresetBtn) {
            const size = sizePresetBtn.dataset.size;
            const updateCanvasW = (val: number) => {
                if (container) container.style.width = val + 'px';
                syncSizeValues(); resizeCanvas();
            };
            const updateCanvasH = (val: number) => {
                if (container) container.style.height = val + 'px';
                syncSizeValues(); resizeCanvas();
            };
            if (size === 'normal') { updateCanvasW(836); updateCanvasH(400); }
            else if (size === 'medium') { updateCanvasW(1200); updateCanvasH(600); }
            else if (size === 'large') { updateCanvasW(1600); updateCanvasH(800); }
        }

        if (target.closest('#copyPngBtn')) copyPngToClipboard();
        if (target.closest('#downloadPngBtn')) downloadPng();
        if (target.closest('#downloadSvgBtn')) downloadSvg();

        // Export Dropdown Toggle
        const exportMainBtn = target.closest('#exportMainBtn');
        if (exportMainBtn) {
            const dropdown = document.getElementById('exportDropdown');
            if (dropdown) dropdown.classList.toggle('active');
            // Prevent close immediately
            // But we have a document listener... wait, this IS the document listener.
            // So we need to stop bubbling? No, this is delegation.
        } else if (!target.closest('#exportDropdown')) {
            const dropdown = document.getElementById('exportDropdown');
            if (dropdown) dropdown.classList.remove('active');
        }

        if (target.closest('#undoBtn')) undo();
        if (target.closest('#redoBtn')) redo();
        if (target.closest('#clearBtn')) {
            if (!signaturePad.isEmpty()) {
                saveState();
                signaturePad.clear();
                if (hint) hint.classList.remove('hidden');
                deselectStroke(false);
            }
        }

        if (target.closest('#centerCanvasBtn')) recenterCanvas();
        if (target.closest('#resetSizeBtn')) autoAdjustCanvas();

        const fullscreenBtn = target.closest('#fullscreenBtn');
        if (fullscreenBtn) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                fullscreenBtn.innerHTML = '<i data-lucide="minimize" size="16"></i>';
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                fullscreenBtn.innerHTML = '<i data-lucide="maximize" size="16"></i>';
            }
            createIcons();
        }
    });

}

function attachControlListeners() {
    // Thickness
    const thicknessVal = document.getElementById('thicknessVal') as HTMLInputElement;
    if (thicknessVal) {
        thicknessVal.onchange = (e: any) => updateThickness(e.target.value);
    }

    setupContinuousClick('incWidth', () => updateThickness(currentThickness + 0.1));
    setupContinuousClick('decWidth', () => updateThickness(currentThickness - 0.1));
    setupScrubbing('thicknessScrubArea', () => currentThickness, (v) => updateThickness(v), 0.1);

    document.getElementById('thicknessSlider')?.addEventListener('input', (e: any) => updateThickness(e.target.value));

    // Alpha
    document.getElementById('alphaSlider')?.addEventListener('input', (e: any) => {
        const val = parseFloat(e.target.value);
        setAlpha(val);
        const valEl = document.getElementById('alphaVal');
        if (valEl) valEl.innerText = Math.round(val * 100) + '%';
        applyColor(lastBaseColor);
    });

    // Canvas Size
    const updateCanvasW = (w: any) => {
        const val = Math.max(200, Math.min(2000, parseInt(w)));
        if (container) container.style.width = val + 'px';
        const wVal = document.getElementById('canvasWidthVal') as HTMLInputElement;
        const wSlider = document.getElementById('widthSlider') as HTMLInputElement;
        if (wVal) wVal.value = val.toString();
        if (wSlider) wSlider.value = val.toString();
        syncSizeValues();
        resizeCanvas();
    };
    const updateCanvasH = (h: any) => {
        const val = Math.max(100, Math.min(1000, parseInt(h)));
        if (container) container.style.height = val + 'px';
        const hVal = document.getElementById('canvasHeightVal') as HTMLInputElement;
        const hSlider = document.getElementById('heightSlider') as HTMLInputElement;
        if (hVal) hVal.value = val.toString();
        if (hSlider) hSlider.value = val.toString();
        syncSizeValues();
        resizeCanvas();
    };

    document.getElementById('widthSlider')?.addEventListener('input', (e: any) => updateCanvasW(e.target.value));
    const cvW = document.getElementById('canvasWidthVal');
    if (cvW) cvW.onchange = (e: any) => updateCanvasW(e.target.value);

    setupContinuousClick('incCanvasWidth', () => updateCanvasW(container.offsetWidth + 10));
    setupContinuousClick('decCanvasWidth', () => updateCanvasW(container.offsetWidth - 10));
    setupScrubbing('widthScrubArea', () => container.offsetWidth, (v) => updateCanvasW(v), 2);

    document.getElementById('heightSlider')?.addEventListener('input', (e: any) => updateCanvasH(e.target.value));
    const cvH = document.getElementById('canvasHeightVal');
    if (cvH) cvH.onchange = (e: any) => updateCanvasH(e.target.value);

    setupContinuousClick('incCanvasHeight', () => updateCanvasH(container.offsetHeight + 10));
    setupContinuousClick('decCanvasHeight', () => updateCanvasH(container.offsetHeight - 10));
    setupScrubbing('heightScrubArea', () => container.offsetHeight, (v) => updateCanvasH(v), 2);

    // Zoom
    const updateZoom = (z: any) => {
        const val = Math.max(10, Math.min(500, parseInt(z)));
        setWorkspaceScale(val / 100);
        const zInput = document.getElementById('zoomVal') as HTMLInputElement;
        const zSlider = document.getElementById('zoomSlider') as HTMLInputElement;
        if (zInput) zInput.value = val.toString();
        if (zSlider) zSlider.value = val.toString();
        updateWorkspaceTransform();
    };
    document.getElementById('zoomSlider')?.addEventListener('input', (e: any) => updateZoom(e.target.value));
    const zVal = document.getElementById('zoomVal');
    if (zVal) zVal.onchange = (e: any) => updateZoom(e.target.value);

    setupContinuousClick('incZoom', () => updateZoom((workspaceScale * 100) + 1));
    setupContinuousClick('decZoom', () => updateZoom((workspaceScale * 100) - 1));
    setupScrubbing('zoomScrubArea', () => workspaceScale * 100, (v) => updateZoom(v), 1);

    // Dark Mode
    document.getElementById('darkModeToggle')?.addEventListener('change', (e: any) => {
        document.body.classList.toggle('dark-mode', e.target.checked);
        document.body.classList.toggle('light-mode', !e.target.checked);
    });
}

function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = 1 + delta * 0.001;
    const newScale = Math.max(0.1, Math.min(5, workspaceScale * factor));
    if (newScale !== workspaceScale) {
        const rect = workspace.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const dx = (mouseX - workspacePan.x) / workspaceScale;
        const dy = (mouseY - workspacePan.y) / workspaceScale;

        setWorkspaceScale(newScale);
        workspacePan.x = mouseX - dx * newScale;
        workspacePan.y = mouseY - dy * newScale;
        updateWorkspaceTransform();

        const zInput = document.getElementById('zoomVal') as HTMLInputElement;
        const zSlider = document.getElementById('zoomSlider') as HTMLInputElement;
        if (zInput) zInput.value = Math.round(newScale * 100).toString();
        if (zSlider) zSlider.value = Math.round(newScale * 100).toString();
    }
}

let panStart = { x: 0, y: 0 };
let moveStart = { x: 0, y: 0 };
let selectStart = { x: 0, y: 0 };
let resizeStart = { x: 0, y: 0 };
let resizeType = '';
let rotateStart = { angle: 0 };
let initialTransformData: any = null;
let transformPivot = { x: 0, y: 0, minX: 0, minY: 0, width: 0, height: 0 };
let modeBeforeMiddleClick: string | null = null;

function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.side-panel') || (e.target as HTMLElement).closest('.top-bar') || (e.target as HTMLElement).closest('.workspace-controls-bottom')) return;

    if (e.button === 1) { // Middle click
        modeBeforeMiddleClick = currentMode;
        setMode('pan');
        setPanning(true);
        panStart = { x: e.clientX, y: e.clientY };
        return;
    }

    const { x: cx, y: cy } = getCanvasCoordinates(e);
    const rect = canvas.getBoundingClientRect();
    const isInsideCanvas = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
    );
    const isHandle = (e.target as HTMLElement).classList.contains('resize-handle');
    if (!isInsideCanvas && !isHandle) return;

    if ((currentMode === 'select' || currentMode === 'transform') && (isInsideCanvas || isHandle)) {
        const bounds = getSelectedDataBounds();
        const clickedOnStroke = isPointNearStrokes(cx, cy, selectedStrokeIndices);
        const clickedInsideSelection = (cx >= bounds.minX && cx <= bounds.maxX && cy >= bounds.minY && cy <= bounds.maxY);

        if (isHandle) {
            resizeType = (e.target as HTMLElement).dataset.type!;
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
                setRotating(true);
                rotateStart.angle = Math.atan2(cy - transformPivot.y, cx - transformPivot.x);
            } else {
                setResizing(true);
                resizeStart.x = cx;
                resizeStart.y = cy;
            }
        } else if (clickedOnStroke || (currentMode === 'transform' && clickedInsideSelection)) {
            saveState();
            setMoving(true);
            moveStart.x = cx;
            moveStart.y = cy;
            initialTransformData = JSON.parse(JSON.stringify(signaturePad.toData()));
        } else if (isInsideCanvas && currentMode === 'select') {
            setSelecting(true);
            selectStart.x = cx;
            selectStart.y = cy;
            if (selectionBox) {
                selectionBox.style.display = 'block';
                selectionBox.style.width = '0';
                selectionBox.style.height = '0';
            }
        } else if (isInsideCanvas && currentMode === 'transform' && !clickedInsideSelection) {
            findStrokesInArea(cx, cy, cx, cy, e.shiftKey, e.ctrlKey);
        }
    } else if (currentMode === 'pan') {
        setPanning(true);
        panStart = { x: e.clientX, y: e.clientY };
    }
}

function handlePointerMove(e: PointerEvent) {
    if (isPanning) {
        workspacePan.x += (e.clientX - panStart.x);
        workspacePan.y += (e.clientY - panStart.y);
        panStart = { x: e.clientX, y: e.clientY };
        updateWorkspaceTransform();
        return;
    }

    const { x: cx, y: cy } = getCanvasCoordinates(e);

    if (isSelecting && selectionBox) {
        const x = Math.min(cx, selectStart.x);
        const y = Math.min(cy, selectStart.y);
        const w = Math.abs(cx - selectStart.x);
        const h = Math.abs(cy - selectStart.y);

        if (selectionBox) {
            selectionBox.style.left = x + 'px';
            selectionBox.style.top = y + 'px';
            selectionBox.style.width = w + 'px';
            selectionBox.style.height = h + 'px';
        }
    } else if (isMoving) {
        const dx = cx - moveStart.x;
        const dy = cy - moveStart.y;
        if (dx !== 0 || dy !== 0) {
            const data = JSON.parse(JSON.stringify(initialTransformData));
            selectedStrokeIndices.forEach(idx => {
                if (data[idx]) {
                    data[idx].points.forEach((p: any) => { p.x += dx; p.y += dy; });
                }
            });
            signaturePad.fromData(data);
            updateSelectedBounds();
            drawSelectionHighlights();
            syncControlsWithSelection();
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
                data[idx].points.forEach((p: any) => {
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
        syncControlsWithSelection();
    } else if (isRotating) {
        const currentAngle = Math.atan2(cy - transformPivot.y, cx - transformPivot.x);
        const diff = currentAngle - rotateStart.angle;

        const data = JSON.parse(JSON.stringify(initialTransformData));
        const cos = Math.cos(diff), sin = Math.sin(diff);

        selectedStrokeIndices.forEach(idx => {
            if (data[idx]) {
                data[idx].points.forEach((p: any) => {
                    const rx = p.x - transformPivot.x, ry = p.y - transformPivot.y;
                    p.x = transformPivot.x + rx * cos - ry * sin;
                    p.y = transformPivot.y + rx * sin + ry * cos;
                });
            }
        });
        signaturePad.fromData(data);
        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
    }
}

function handlePointerUp(e: PointerEvent) {
    if (isPanning && modeBeforeMiddleClick) {
        setMode(modeBeforeMiddleClick);
        modeBeforeMiddleClick = null;
    }
    if (isSelecting) {
        setSelecting(false);
        if (selectionBox) selectionBox.style.display = 'none';
        const { x: cx, y: cy } = getCanvasCoordinates(e);
        findStrokesInArea(selectStart.x, selectStart.y, cx, cy, e.shiftKey, e.ctrlKey);
    }
    setPanning(false);
    setMoving(false);
    setResizing(false);
    setRotating(false);
}

function handleKeyDown(e: KeyboardEvent) {
    if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase() || '')) return;
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (ctrl && key === 'y') { e.preventDefault(); redo(); }
    else if (ctrl && key === 'c') { e.preventDefault(); copySelection(); }
    else if (ctrl && key === 'v') { e.preventDefault(); pasteSelection(); }
    else if (key === 'delete' || key === 'backspace') {
        if (selectedStrokeIndices.length > 0) { e.preventDefault(); deleteSelection(); }
    }
    else if (key === 'p') setMode('draw');
    else if (key === 'v') setMode('select');
    else if (key === 't') setMode('transform');
    else if (key === 'h') setMode('pan');
    else if (key === 'm') {
        sidePanel?.classList.toggle('minimized');
        document.body.classList.toggle('panel-minimized', sidePanel?.classList.contains('minimized'));
    }
}

// --- Logic from original Selection Logic ---

function isPointNearStrokes(cx: number, cy: number, indices: number[]) {
    const data = signaturePad.toData();
    const hitSlop = 10 / workspaceScale;
    return indices.some(idx => {
        const stroke = data[idx];
        if (!stroke) return false;
        const radius = (stroke.maxWidth + stroke.minWidth) / 2 + hitSlop;
        return stroke.points.some((p: any) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) < radius);
    });
}

function findStrokesInArea(x1: number, y1: number, x2: number, y2: number, shift: boolean, ctrl: boolean) {
    const data = signaturePad.toData();
    const found: number[] = [];
    const isClick = (Math.abs(x2 - x1) * workspaceScale) < 5 && (Math.abs(y2 - y1) * workspaceScale) < 5;
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;

    data.forEach((stroke, idx) => {
        let match = false;
        const hitSlop = 5 / workspaceScale;
        const radius = (stroke.maxWidth + stroke.minWidth) / 2 + hitSlop;
        stroke.points.forEach((p: any) => {
            if (isClick) {
                if (Math.sqrt((p.x - midX) ** 2 + (p.y - midY) ** 2) < radius + (10 / workspaceScale)) match = true;
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

function selectStrokes(indices: number[], save = true) {
    const isSame = indices.length === selectedStrokeIndices.length && indices.every((v, i) => v === selectedStrokeIndices[i]);
    if (isSame) return;
    if (save) saveState();
    setSelectedIndices(indices);
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
    setSelectedIndices([]);
    if (selectionInfo) selectionInfo.style.display = 'none';
    updateSelectedBounds();
    drawSelectionHighlights();
}
