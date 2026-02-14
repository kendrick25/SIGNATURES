import {
    signaturePad, State, setMode as setStateMode, workspacePan,
    setPanning, setMoving,
    setSelecting, setResizing,
    setRotating,
    setSelectedIndices, history, redoStack, currentLang,
    workspace, hint, selectionInfo, selectionBox,
    sidePanel, lastBaseColor, setAlpha,
    container, canvas, selectionCanvas, setWorkspaceScale
} from '@/scripts/state';
import {
    saveState, undo, redo, updateThickness, applyStrokeType,
    applyColor, drawSelectionHighlights, updateStrokeStyles,
    updateStrokePreview, downloadPng, downloadSvg, copyPngToClipboard,
    copySelection, pasteSelection, deleteSelection,
    rotateSelection90, flipSelection, scaleSelection
} from '@/scripts/canvas';
import {
    updateWorkspaceTransform, syncSizeValues,
    recenterCanvas, resizeCanvas, autoAdjustCanvas
} from '@/scripts/workspace';
import { renderUIComponents, updateGlobalReferences, createIcons, updateLanguage } from '@/scripts/data';
import { updateSelectedBounds, getSelectedDataBounds, syncControlsWithSelection, updateTransformPanelState } from '@/scripts/ui_updates';



// --- Initialization ---

export function initAppLogic() {
    updateLanguage(currentLang);
    updateWorkspaceTransform();
    syncSizeValues();
    updateStrokeStyles();
    updateStrokePreview();
    updateHistoryButtons();

    (window as any).currentMode = 'draw';
    setMode('draw');
    recenterCanvas();
    updateTransformPanelState();

    attachEventListeners();
    attachDynamicListeners();
    initSidebarResizing();
    updateWorkspaceLayout();

    // Initial state check for body classes
    if (sidePanel) {
        const isMinimized = sidePanel.classList.contains('minimized');
        document.body.classList.toggle('panel-minimized', isMinimized);
    }

    if (signaturePad) {
        // Fix for SignaturePad 5.x: The library expects _createPoint(clientX, clientY, pressure).
        // It internally subtracts getBoundingClientRect().left/top.
        // We wrap it to apply our workspace zoom factor (s).
        const originalCreatePoint = (signaturePad as any)._createPoint;
        if (typeof originalCreatePoint === 'function') {
            (signaturePad as any)._createPoint = function (x: number, y: number, pressure: number) {
                const rect = canvas.getBoundingClientRect();

                // Definitive scale factor: realized screen width / logical layout width
                // This handles workspace zoom (CSS transform: scale).
                // Browser zoom is transparent as clientX and rect are both in CSS pixels.
                const s = rect.width / (canvas.clientWidth || 1);

                // We want the resulting internal point to be: (clientX - rect.left) / s
                // Since the original method does (x_input - rect.left), we must pass it: 
                // x_input = rect.left + (clientX - rect.left) / s
                const x_patched = rect.left + (x - rect.left) / (s || 1);
                const y_patched = rect.top + (y - rect.top) / (s || 1);

                return originalCreatePoint.call(this, x_patched, y_patched, pressure);
            };
        }

        // Sync the older internal reference just in case
        (signaturePad as any)._getPointFromEvent = (signaturePad as any)._createPoint;
    }
    updateTransformPanelState();
}

function updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
    const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = history.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function setMode(mode: string) {
    if (mode === State.currentMode && mode !== 'draw') return;
    setStateMode(mode);
    (window as any).currentMode = mode;

    document.querySelectorAll('#modeToggle .preset-btn').forEach(btn => {
        (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });

    if (mode === 'draw') {
        canvas.style.cursor = 'crosshair';
        signaturePad.on();
        if (hint && signaturePad.isEmpty()) hint.classList.remove('hidden');
        if (selectionCanvas) selectionCanvas.classList.remove('active');
        deselectStroke(false);
    } else {
        signaturePad.off();
        if (hint) hint.classList.add('hidden');
        if (mode === 'transform' || mode === 'select') {
            canvas.style.cursor = 'default';
            if (selectionCanvas) selectionCanvas.classList.add('active');
        }
        if (mode === 'pan') {
            canvas.style.cursor = 'grab';
            if (selectionCanvas) selectionCanvas.classList.remove('active');
        }
    }
    updateSelectedBounds();
    drawSelectionHighlights();
}

// --- Helpers ---

function setupContinuousClick(btnId: string, action: () => void) {
    let interval: any = null;
    let timeout: any = null;
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const start = (e: any) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        e.preventDefault();
        action();
        timeout = setTimeout(() => { interval = setInterval(action, 60); }, 400);
    };
    const stop = () => { clearTimeout(timeout); clearInterval(interval); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start as any, { passive: false });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    btn.addEventListener('mouseleave', stop);
}

function setupScrubbing(areaId: string, getValue: () => number, setValue: (v: number) => void, step = 1) {
    const area = document.getElementById(areaId);
    if (!area) return;
    let startX = 0, startVal = 0;
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

// --- REFINED COORDINATE MAPPING (Excalidraw Style) ---
function getCanvasCoordinates(e: any) {
    if (!canvas || !workspace) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / (canvas.clientWidth || 1);
    const sy = rect.height / (canvas.clientHeight || 1);
    const s = (sx + sy) / 2;

    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
        x: (clientX - rect.left) / (s || 1),
        y: (clientY - rect.top) / (s || 1)
    };
}



// --- Event Handlers ---

function attachEventListeners() {
    workspace?.addEventListener('wheel', handleWheel as any, { passive: false });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    signaturePad.addEventListener("beginStroke", () => {
        if (State.currentMode === 'select' || State.isMoving || State.isResizing || State.isRotating) return;
        saveState();
        if (hint) hint.classList.add('hidden');
    });


    document.getElementById('workspaceToggle')?.addEventListener('click', () => {
        sidePanel.classList.toggle('minimized');
        const isMinimized = sidePanel.classList.contains('minimized');
        document.body.classList.toggle('panel-minimized', isMinimized);

        // Ensure visibility
        if (!isMinimized) {
            sidePanel.style.display = 'flex';
            requestAnimationFrame(() => {
                sidePanel.style.opacity = '1';
                sidePanel.style.transform = sidePanel.classList.contains('docked') ? 'none' : 'translateX(0)';
                updateWorkspaceLayout();
            });
        } else {
            updateWorkspaceLayout();
        }
    });



    attachControlListeners();

    window.addEventListener('beforeunload', (e) => {
        if (!signaturePad.isEmpty() || history.length > 0) { e.preventDefault(); e.returnValue = ''; }
    });





    document.getElementById('recenterBtnTop')?.addEventListener('click', () => {
        autoAdjustCanvas();
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
            const updateCanvasW = (val: number) => { if (container) container.style.width = val + 'px'; syncSizeValues(); resizeCanvas(); };
            const updateCanvasH = (val: number) => { if (container) container.style.height = val + 'px'; syncSizeValues(); resizeCanvas(); };
            if (size === 'normal') { updateCanvasW(836); updateCanvasH(400); }
            else if (size === 'medium') { updateCanvasW(1200); updateCanvasH(600); }
            else if (size === 'large') { updateCanvasW(1600); updateCanvasH(800); }
        }

        if (target.closest('#copyPngBtn')) copyPngToClipboard();
        if (target.closest('#downloadPngBtn')) downloadPng();
        if (target.closest('#downloadSvgBtn')) downloadSvg();

        const exportMainBtn = target.closest('#exportMainBtn');
        if (exportMainBtn) {
            const dropdown = document.getElementById('exportDropdown');
            if (dropdown) dropdown.classList.toggle('active');
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

        const settingsToggle = target.closest('#settingsToggle');
        if (settingsToggle) {
            const dropdown = document.getElementById('settingsMenu');
            if (dropdown) dropdown.classList.toggle('active');
        } else if (!target.closest('#settingsMenu') && !target.closest('.color-picker')) {
            // Close settings if clicking outside
            const dropdown = document.getElementById('settingsMenu');
            if (dropdown) dropdown.classList.remove('active');
        }
    });
}

function attachControlListeners() {
    const thicknessVal = document.getElementById('thicknessVal') as HTMLInputElement;
    if (thicknessVal) thicknessVal.onchange = (e: any) => updateThickness(e.target.value);
    setupContinuousClick('incWidth', () => updateThickness(State.currentThickness + 0.1));
    setupContinuousClick('decWidth', () => updateThickness(State.currentThickness - 0.1));
    setupScrubbing('thicknessScrubArea', () => State.currentThickness, (v) => updateThickness(v), 0.1);
    document.getElementById('thicknessSlider')?.addEventListener('input', (e: any) => updateThickness(e.target.value));

    document.getElementById('alphaSlider')?.addEventListener('input', (e: any) => {
        const val = parseFloat(e.target.value);
        setAlpha(val);
        const valEl = document.getElementById('alphaVal');
        if (valEl) valEl.innerText = Math.round(val * 100) + '%';
        applyColor(lastBaseColor);
    });

    const updateCanvasW = (w: any) => {
        const val = Math.max(200, Math.min(2000, parseInt(w)));
        if (container) container.style.width = val + 'px';
        const wVal = document.getElementById('canvasWidthVal') as HTMLInputElement;
        const wSlider = document.getElementById('widthSlider') as HTMLInputElement;
        if (wVal) wVal.value = val.toString();
        if (wSlider) wSlider.value = val.toString();
        syncSizeValues(); resizeCanvas();
    };
    const updateCanvasH = (h: any) => {
        const val = Math.max(100, Math.min(1000, parseInt(h)));
        if (container) container.style.height = val + 'px';
        const hVal = document.getElementById('canvasHeightVal') as HTMLInputElement;
        const hSlider = document.getElementById('heightSlider') as HTMLInputElement;
        if (hVal) hVal.value = val.toString();
        if (hSlider) hSlider.value = val.toString();
        syncSizeValues(); resizeCanvas();
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

    const updateZoom = (z: any) => {
        const val = Math.max(10, Math.min(500, parseInt(z)));
        const newScale = val / 100;

        if (newScale !== State.workspaceScale && workspace) {
            // Zoom towards viewport center for consistent user experience
            const rect = workspace.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const dx = (centerX - workspacePan.x) / State.workspaceScale;
            const dy = (centerY - workspacePan.y) / State.workspaceScale;

            setWorkspaceScale(newScale);
            workspacePan.x = centerX - dx * newScale;
            workspacePan.y = centerY - dy * newScale;

            const zInput = document.getElementById('zoomVal') as HTMLInputElement;
            const zSlider = document.getElementById('zoomSlider') as HTMLInputElement;
            if (zInput) zInput.value = val.toString();
            if (zSlider) zSlider.value = val.toString();
            updateWorkspaceTransform();
        }
    };
    document.getElementById('zoomSlider')?.addEventListener('input', (e: any) => updateZoom(e.target.value));
    const zVal = document.getElementById('zoomVal');
    if (zVal) zVal.onchange = (e: any) => updateZoom(e.target.value);
    setupContinuousClick('incZoom', () => updateZoom((State.workspaceScale * 100) + 1));
    setupContinuousClick('decZoom', () => updateZoom((State.workspaceScale * 100) - 1));
    setupScrubbing('zoomScrubArea', () => State.workspaceScale * 100, (v) => updateZoom(v), 1);

    document.getElementById('rotateLeftBtn')?.addEventListener('click', () => rotateSelection90('ccw'));
    document.getElementById('rotateRightBtn')?.addEventListener('click', () => rotateSelection90('cw'));
    document.getElementById('flipHBtn')?.addEventListener('click', () => flipSelection('h'));
    document.getElementById('flipVBtn')?.addEventListener('click', () => flipSelection('v'));

    const updateScale = (factor: number) => {
        const valEl = document.getElementById('scaleVal') as HTMLInputElement;
        if (valEl) valEl.value = Math.round(factor * 100).toString();
        scaleSelection(factor);
    };
    setupContinuousClick('incScale', () => {
        const input = document.getElementById('scaleVal') as HTMLInputElement;
        const current = parseInt(input.value) || 100;
        updateScale((current + 5) / current);
    });
    setupContinuousClick('decScale', () => {
        const input = document.getElementById('scaleVal') as HTMLInputElement;
        const current = parseInt(input.value) || 100;
        updateScale((current - 5) / current);
    });

    const scaleScrubArea = document.getElementById('scaleScrubArea');
    if (scaleScrubArea) {
        let startX = 0, initialValue = 100, scaleBaseData: any = null;
        const onScaleMove = (e: PointerEvent) => {
            const dx = e.clientX - startX;
            let newValue = Math.max(10, Math.min(500, initialValue + Math.round(dx / 2)));
            const valEl = document.getElementById('scaleVal') as HTMLInputElement;
            if (valEl) valEl.value = newValue.toString();
            scaleSelection(newValue / 100, false, scaleBaseData);
        };
        const onScaleUp = () => {
            window.removeEventListener('pointermove', onScaleMove);
            window.removeEventListener('pointerup', onScaleUp);
            const valEl = document.getElementById('scaleVal') as HTMLInputElement;
            scaleSelection(parseInt(valEl?.value || '100') / 100, true, scaleBaseData);
            scaleBaseData = null; if (valEl) valEl.value = '100';
        };
        scaleScrubArea.addEventListener('pointerdown', (e) => {
            if (State.selectedStrokeIndices.length === 0) return;
            startX = e.clientX; initialValue = 100;
            const valEl = document.getElementById('scaleVal') as HTMLInputElement;
            if (valEl) valEl.value = '100';
            saveState(); scaleBaseData = JSON.parse(JSON.stringify(signaturePad.toData()));
            window.addEventListener('pointermove', onScaleMove);
            window.addEventListener('pointerup', onScaleUp);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        });
    }

    document.getElementById('darkModeToggle')?.addEventListener('change', (e: any) => {
        document.body.classList.toggle('dark-mode', e.target.checked);
        document.body.classList.toggle('light-mode', !e.target.checked);
    });
}

function handleWheel(e: WheelEvent) {
    if (!workspace || !canvas) return;
    e.preventDefault();

    // 1. Get current physical position of drawing surface
    const canvasRect = canvas.getBoundingClientRect();

    // 2. Identify the logical "Scene" coordinate under the mouse
    // This is the invariant point we want to keep under the cursor.
    const sceneX = (e.clientX - canvasRect.left) / State.workspaceScale;
    const sceneY = (e.clientY - canvasRect.top) / State.workspaceScale;

    // 3. Calculate new scale
    const delta = -e.deltaY, factor = 1 + delta * 0.001;
    const newScale = Math.max(0.1, Math.min(5, State.workspaceScale * factor));

    if (newScale !== State.workspaceScale) {
        // 4. Stable "Initial" layout position (pan=0)
        // Since transform-origin is 0,0, the left edge visual position is: InitialLeft + PanX
        // So InitialLeft = current_left - current_pan
        const initialLayoutX = canvasRect.left - workspacePan.x;
        const initialLayoutY = canvasRect.top - workspacePan.y;

        setWorkspaceScale(newScale);

        // 5. Update Pan to keep the scene point at the same screen location
        // NewScreenPos = initialLayoutX + NewPan + (sceneX * newScale)
        // We want NewScreenPos to match e.clientX
        workspacePan.x = e.clientX - initialLayoutX - (sceneX * newScale);
        workspacePan.y = e.clientY - initialLayoutY - (sceneY * newScale);

        updateWorkspaceTransform();

        const zInput = document.getElementById('zoomVal') as HTMLInputElement;
        const zSlider = document.getElementById('zoomSlider') as HTMLInputElement;
        if (zInput) zInput.value = Math.round(newScale * 100).toString();
        if (zSlider) zSlider.value = Math.round(newScale * 100).toString();
    }
}

let panStart = { x: 0, y: 0 }, moveStart = { x: 0, y: 0 }, selectStart = { x: 0, y: 0 }, resizeStart = { x: 0, y: 0 };
let resizeType = '', rotateStart = { angle: 0 }, initialTransformData: any = null;
let transformPivot = { x: 0, y: 0, minX: 0, minY: 0, width: 0, height: 0 };
let modeBeforeMiddleClick: string | null = null;

function updateCursor(e: PointerEvent) {
    if (State.isPanning) { document.body.style.cursor = 'grabbing'; return; }
    const target = e.target as HTMLElement;
    if (target.closest('.side-panel, .app-header')) {
        document.body.style.cursor = 'default'; return;
    }

    if (State.currentMode === 'pan') { document.body.style.cursor = 'grab'; }
    else if (State.currentMode === 'draw') { document.body.style.cursor = 'crosshair'; }
    else if (State.currentMode === 'select' || State.currentMode === 'transform') {
        const handle = target.closest('.resize-handle') as HTMLElement;
        if (handle) {
            const type = handle.dataset.type;
            if (type === 'rotate') document.body.style.cursor = 'alias';
            else if (type === 'r') document.body.style.cursor = 'ew-resize';
            else if (type === 'b') document.body.style.cursor = 'ns-resize';
            else if (type === 'br') document.body.style.cursor = 'nwse-resize';
        } else {
            const { x: cx, y: cy } = getCanvasCoordinates(e);
            const bounds = getSelectedDataBounds();
            if (cx >= bounds.minX && cx <= bounds.maxX && cy >= bounds.minY && cy <= bounds.maxY) {
                document.body.style.cursor = 'move';
            } else { document.body.style.cursor = 'default'; }
        }
    } else document.body.style.cursor = 'default';
}

function handlePointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.side-panel') || target.closest('.app-header')) return;

    if (e.button === 1) {
        modeBeforeMiddleClick = State.currentMode; setMode('pan'); setPanning(true);
        panStart = { x: e.clientX, y: e.clientY }; return;
    }

    const { x: cx, y: cy } = getCanvasCoordinates(e);
    const rect = canvas.getBoundingClientRect();
    const isInsideCanvas = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
    const handleEl = (e.target as HTMLElement).closest('.resize-handle') as HTMLElement;

    if (handleEl && (State.currentMode === 'select' || State.currentMode === 'transform')) {
        const bounds = getSelectedDataBounds();
        resizeType = handleEl.dataset.type!; saveState();
        initialTransformData = JSON.parse(JSON.stringify(signaturePad.toData()));
        transformPivot = {
            x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2,
            minX: bounds.minX, minY: bounds.minY, width: Math.max(1, bounds.maxX - bounds.minX), height: Math.max(1, bounds.maxY - bounds.minY)
        };
        if (resizeType === 'rotate') { setRotating(true); rotateStart.angle = Math.atan2(cy - transformPivot.y, cx - transformPivot.x); }
        else { setResizing(true); resizeStart.x = cx; resizeStart.y = cy; }
        (e.target as HTMLElement).setPointerCapture(e.pointerId); return;
    }

    if (!isInsideCanvas) return;

    if (State.currentMode === 'select' || State.currentMode === 'transform') {
        const bounds = getSelectedDataBounds();
        const clickedInsideSelection = (cx >= bounds.minX && cx <= bounds.maxX && cy >= bounds.minY && cy <= bounds.maxY);
        const data = signaturePad.toData();
        let clickedStrokeIdx = -1;
        const rect = canvas.getBoundingClientRect();
        const actualScaleX = rect.width / canvas.offsetWidth || 1;
        const hitSlop = 10 / actualScaleX;

        for (let i = data.length - 1; i >= 0; i--) {
            const stroke = data[i];
            const radius = ((stroke.maxWidth + stroke.minWidth) / 2) + hitSlop;

            // Optimization: Bounding Box Check first
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of stroke.points) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }

            // Expand by radius
            minX -= radius; maxX += radius; minY -= radius; maxY += radius;

            if (cx < minX || cx > maxX || cy < minY || cy > maxY) continue;

            // Detailed Check
            if (stroke.points.some((p: any) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) < radius)) {
                clickedStrokeIdx = i;
                break;
            }
        }

        if (clickedStrokeIdx !== -1) {
            if (!State.selectedStrokeIndices.includes(clickedStrokeIdx)) {
                if (!e.shiftKey && !e.ctrlKey) selectStrokes([clickedStrokeIdx]);
                else selectStrokes([...State.selectedStrokeIndices, clickedStrokeIdx]);
            } else if (e.ctrlKey) { selectStrokes(State.selectedStrokeIndices.filter(i => i !== clickedStrokeIdx)); return; }

            if (State.selectedStrokeIndices.includes(clickedStrokeIdx)) {
                saveState(); setMoving(true); moveStart.x = cx; moveStart.y = cy;
                initialTransformData = JSON.parse(JSON.stringify(signaturePad.toData()));
            }
        } else {
            if (State.currentMode === 'select') {
                setSelecting(true); selectStart.x = cx; selectStart.y = cy;
                if (selectionBox) { selectionBox.style.display = 'block'; selectionBox.style.width = '0'; selectionBox.style.height = '0'; }
            } else if (State.currentMode === 'transform' && !clickedInsideSelection) deselectStroke();
        }
    } else if (State.currentMode === 'pan') { setPanning(true); panStart = { x: e.clientX, y: e.clientY }; }
}

function handlePointerMove(e: PointerEvent) {
    updateCursor(e);
    if (State.isPanning) {
        workspacePan.x += (e.clientX - panStart.x); workspacePan.y += (e.clientY - panStart.y);
        panStart = { x: e.clientX, y: e.clientY }; updateWorkspaceTransform(); return;
    }
    const { x: cx, y: cy } = getCanvasCoordinates(e);
    if (State.isSelecting && selectionBox) {
        const x = Math.min(cx, selectStart.x), y = Math.min(cy, selectStart.y), w = Math.abs(cx - selectStart.x), h = Math.abs(cy - selectStart.y);
        selectionBox.style.left = x + 'px'; selectionBox.style.top = y + 'px'; selectionBox.style.width = w + 'px'; selectionBox.style.height = h + 'px';
    } else if (State.isMoving) {
        const dx = cx - moveStart.x, dy = cy - moveStart.y;
        if (dx !== 0 || dy !== 0) {
            const data = JSON.parse(JSON.stringify(initialTransformData));
            State.selectedStrokeIndices.forEach(idx => { if (data[idx]) data[idx].points.forEach((p: any) => { p.x += dx; p.y += dy; }); });
            // Only update visualization for performance
            updateSelectedBounds(data);
            drawSelectionHighlights(data);
        }
    } else if (State.isResizing) {
        const dx = cx - resizeStart.x, dy = cy - resizeStart.y, data = JSON.parse(JSON.stringify(initialTransformData)), b = transformPivot;
        let sx = 1, sy = 1;
        // Mapping handles: r -> width, b -> height, br -> both
        if (resizeType === 'r' || resizeType === 'br') sx = (b.width + dx) / b.width;
        if (resizeType === 'b' || resizeType === 'br') sy = (b.height + dy) / b.height;
        sx = Math.max(0.05, sx); sy = Math.max(0.05, sy);
        State.selectedStrokeIndices.forEach(idx => {
            if (data[idx]) {
                data[idx].points.forEach((p: any) => { p.x = b.minX + (p.x - b.minX) * sx; p.y = b.minY + (p.y - b.minY) * sy; });
                data[idx].minWidth *= (sx + sy) / 2; data[idx].maxWidth *= (sx + sy) / 2;
            }
        });
        updateSelectedBounds(data);
        drawSelectionHighlights(data);
    } else if (State.isRotating) {
        const currentAngle = Math.atan2(cy - transformPivot.y, cx - transformPivot.x), diff = currentAngle - rotateStart.angle;
        const data = JSON.parse(JSON.stringify(initialTransformData)), cos = Math.cos(diff), sin = Math.sin(diff);
        State.selectedStrokeIndices.forEach(idx => {
            if (data[idx]) data[idx].points.forEach((p: any) => {
                const rx = p.x - transformPivot.x, ry = p.y - transformPivot.y;
                p.x = transformPivot.x + rx * cos - ry * sin; p.y = transformPivot.y + rx * sin + ry * cos;
            });
        });
        updateSelectedBounds(data);
        drawSelectionHighlights(data);
    }
}

function handlePointerUp(e: PointerEvent) {
    if (State.isPanning && modeBeforeMiddleClick) { setMode(modeBeforeMiddleClick); modeBeforeMiddleClick = null; }
    if (State.isSelecting) {
        setSelecting(false); if (selectionBox) selectionBox.style.display = 'none';
        const { x: cx, y: cy } = getCanvasCoordinates(e);
        findStrokesInArea(selectStart.x, selectStart.y, cx, cy, e.shiftKey, e.ctrlKey);
    }

    if (State.isMoving || State.isResizing || State.isRotating) {
        const { x: cx, y: cy } = getCanvasCoordinates(e);
        const data = JSON.parse(JSON.stringify(initialTransformData));
        if (State.isMoving) {
            const dx = cx - moveStart.x, dy = cy - moveStart.y;
            State.selectedStrokeIndices.forEach(idx => { if (data[idx]) data[idx].points.forEach((p: any) => { p.x += dx; p.y += dy; }); });
        } else if (State.isResizing) {
            const dx = cx - resizeStart.x, dy = cy - resizeStart.y, b = transformPivot;
            let sx = 1, sy = 1;
            if (resizeType === 'r' || resizeType === 'br') sx = (b.width + dx) / b.width;
            if (resizeType === 'b' || resizeType === 'br') sy = (b.height + dy) / b.height;
            sx = Math.max(0.05, sx); sy = Math.max(0.05, sy);
            State.selectedStrokeIndices.forEach(idx => {
                if (data[idx]) {
                    data[idx].points.forEach((p: any) => { p.x = b.minX + (p.x - b.minX) * sx; p.y = b.minY + (p.y - b.minY) * sy; });
                    data[idx].minWidth *= (sx + sy) / 2; data[idx].maxWidth *= (sx + sy) / 2;
                }
            });
        } else if (State.isRotating) {
            const currentAngle = Math.atan2(cy - transformPivot.y, cx - transformPivot.x), diff = currentAngle - rotateStart.angle;
            const cos = Math.cos(diff), sin = Math.sin(diff);
            State.selectedStrokeIndices.forEach(idx => {
                if (data[idx]) data[idx].points.forEach((p: any) => {
                    const rx = p.x - transformPivot.x, ry = p.y - transformPivot.y;
                    p.x = transformPivot.x + rx * cos - ry * sin; p.y = transformPivot.y + rx * sin + ry * cos;
                });
            });
        }
        signaturePad.fromData(data);
        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
    }
    setPanning(false); setMoving(false); setResizing(false); setRotating(false);
}


function updateWorkspaceLayout() {
    const sidePanelEl = document.getElementById('sidePanel');

    // Sync Main Side Panel Width
    let panelWidth = 0;
    if (sidePanelEl && sidePanelEl.classList.contains('docked')) {
        if (sidePanelEl.classList.contains('minimized')) {
            panelWidth = 0;
        } else {
            // Always trust the stored width which is updated during resize
            panelWidth = parseInt(sidePanelEl.dataset.storedWidth || '320');
            // Apply it back to style to ensure it stays active
            sidePanelEl.style.width = panelWidth + 'px';
        }
    }
    document.documentElement.style.setProperty('--panel-width', panelWidth + 'px');

    // Reset other sidebar variables
    document.documentElement.style.setProperty('--sidebar-right-width', '0px');
    document.documentElement.style.setProperty('--sidebar-top-height', '0px');
    document.documentElement.style.setProperty('--sidebar-bottom-height', '0px');
    document.body.classList.remove('has-docked-right', 'has-docked-top', 'has-docked-bottom');

    resizeCanvas();
}

function initSidebarResizing() {
    const sideResizer = document.getElementById('sidePanelResizer'), sidePanelEl = document.getElementById('sidePanel');
    if (sideResizer && sidePanelEl) {
        let isResizing = false, startX = 0, startWidth = 0;
        sideResizer.addEventListener('pointerdown', (e) => {
            isResizing = true; startX = e.clientX; startWidth = sidePanelEl.offsetWidth;
            sideResizer.setPointerCapture(e.pointerId); document.body.classList.add('resizing'); e.preventDefault(); e.stopPropagation();
        });
        window.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            const newWidth = Math.max(260, Math.min(800, startWidth + (e.clientX - startX)));
            document.documentElement.style.setProperty('--panel-width', newWidth + 'px');
            sidePanelEl.style.width = newWidth + 'px';
            sidePanelEl.dataset.storedWidth = newWidth.toString();
            // Don't call updateWorkspaceLayout here to avoid flickering, just update the width
        });
        window.addEventListener('pointerup', (e) => {
            if (isResizing) {
                isResizing = false;
                sideResizer.releasePointerCapture(e.pointerId);
                document.body.classList.remove('resizing');
                updateWorkspaceLayout();
            }
        });
    }
}

function handleKeyDown(e: KeyboardEvent) {
    if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase() || '')) return;
    const key = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    if (ctrl && key === 'y') { e.preventDefault(); redo(); }
    if (ctrl && key === 'a') {
        e.preventDefault(); const data = signaturePad.toData();
        if (data.length > 0) { selectStrokes(data.map((_, i) => i)); }
    }
    if (ctrl && key === 'c') { e.preventDefault(); copySelection(); }
    if (ctrl && key === 'v') { e.preventDefault(); pasteSelection(); }
    if ((key === 'delete' || key === 'backspace') && State.selectedStrokeIndices.length > 0) { e.preventDefault(); deleteSelection(); }
    if (key === 'p') setMode('draw'); if (key === 'v') setMode('select'); if (key === 't') setMode('transform'); if (key === 'h') setMode('pan');
    if (key === 'm') {
        sidePanel?.classList.toggle('minimized');
        document.body.classList.toggle('panel-minimized', sidePanel?.classList.contains('minimized'));
        updateWorkspaceLayout();
    }
}

function findStrokesInArea(x1: number, y1: number, x2: number, y2: number, shift: boolean, ctrl: boolean) {
    const data = signaturePad.toData(), found: number[] = [];
    const rect = canvas.getBoundingClientRect();
    const actualScaleX = rect.width / (canvas.offsetWidth || 1);
    const isClick = (Math.abs(x2 - x1) * actualScaleX) < 5 && (Math.abs(y2 - y1) * actualScaleX) < 5;
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    data.forEach((stroke, idx) => {
        let match = false;
        const hitSlop = 5 / actualScaleX;
        const radius = ((stroke.maxWidth + stroke.minWidth) / 2) + hitSlop;

        // Fast Bounding Box Check
        let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
        for (const p of stroke.points) {
            if (p.x < sMinX) sMinX = p.x;
            if (p.x > sMaxX) sMaxX = p.x;
            if (p.y < sMinY) sMinY = p.y;
            if (p.y > sMaxY) sMaxY = p.y;
        }
        sMinX -= radius; sMaxX += radius; sMinY -= radius; sMaxY += radius;

        if (isClick) {
            // Click selection
            if (midX >= sMinX && midX <= sMaxX && midY >= sMinY && midY <= sMaxY) {
                if (stroke.points.some((p: any) => Math.sqrt((p.x - midX) ** 2 + (p.y - midY) ** 2) < radius + (10 / State.workspaceScale))) match = true;
            }
        } else {
            // Drag Selection (Marquee)
            const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
            // Check if bounding boxes overlap at all
            if (sMaxX < l || sMinX > r || sMaxY < t || sMinY > b) {
                match = false;
            } else {
                // Detailed check: if any point is inside
                if (stroke.points.some((p: any) => p.x >= l && p.x <= r && p.y >= t && p.y <= b)) match = true;
            }
        }

        if (match) found.push(idx);
    });
    if (ctrl && isClick) {
        if (found.length > 0) {
            const idx = found[0], i = State.selectedStrokeIndices.indexOf(idx);
            let next = [...State.selectedStrokeIndices]; if (i > -1) next.splice(i, 1); else next.push(idx);
            selectStrokes(next);
        }
    } else if (shift) selectStrokes([...new Set([...State.selectedStrokeIndices, ...found])]);
    else { if (found.length > 0) selectStrokes(found); else if (isClick) deselectStroke(); }
}

function selectStrokes(indices: number[], save = true) {
    if (indices.length === State.selectedStrokeIndices.length && indices.every((v, i) => v === State.selectedStrokeIndices[i])) return;
    if (save) saveState(); setSelectedIndices(indices);

    updateTransformPanelState();

    if (selectionInfo) { selectionInfo.innerText = `Trazos Seleccionados: ${indices.length}`; selectionInfo.style.display = indices.length > 0 ? 'block' : 'none'; }
    updateSelectedBounds(); drawSelectionHighlights(); syncControlsWithSelection();
}

function deselectStroke(save = true) {
    if (State.selectedStrokeIndices.length === 0) return;
    if (save) saveState(); setSelectedIndices([]);

    updateTransformPanelState();

    if (selectionInfo) selectionInfo.style.display = 'none';
    updateSelectedBounds(); drawSelectionHighlights();
}
