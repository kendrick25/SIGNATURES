import {
    signaturePad, State, setMode as setStateMode, workspacePan,
    setPanning, setMoving,
    setSelecting, setResizing,
    setRotating,
    setSelectedIndices, history, redoStack, currentLang,
    workspace, selectionInfo, selectionBox,
    sidePanel, lastBaseColor, setAlpha,
    container, canvas, selectionCanvas, setWorkspaceScale, customColors,
    favoriteColors, setFavoriteColors, setExportQuality, setExportDpi, setExportFormat, setExportAction, setExportClipOutOfBounds, setViewClipOutOfBounds, setExportScale, setExportMargin, setExportPreset, CANVAS_MARGIN
} from '@/scripts/state';
import {
    saveState, undo, redo, updateThickness, applyStrokeType,
    applyColor, drawSelectionHighlights, updateStrokeStyles,
    updateStrokePreview, downloadPng, downloadSvg, copyPngToClipboard,
    copySelection, pasteSelection, deleteSelection,
    rotateSelection90, flipSelection, scaleSelection, showToast, updateHintVisibility, safeFromData, copyPngBase64, copySvgBase64,
    downloadJpg, downloadWebp, copyJpgBase64, copyWebpBase64, triggerExport, updateExportPreview, updateModalContext
} from '@/scripts/canvas';
import {
    updateWorkspaceTransform, syncSizeValues,
    recenterCanvas, resizeCanvas, autoAdjustCanvas
} from '@/scripts/workspace';
import { renderUIComponents, updateGlobalReferences, createIcons, updateLanguage, i18n } from '@/scripts/data';
import { updateSelectedBounds, getSelectedDataBounds, syncControlsWithSelection, updateTransformPanelState } from '@/scripts/ui_updates';



// --- Initialization ---

export let currentCanvasBorderStyle = 'none';
export let currentRadiusUnit = 'px';
let bgOpacity = 1.0;
let borderOpacity = 1.0;
let activePickerId: string | null = null;
let currentPickerColor = { h: 0, s: 100, v: 100 };

export function initAppLogic() {
    updateLanguage(currentLang);
    updateWorkspaceTransform();
    syncSizeValues();
    updateStrokeStyles();
    updateStrokePreview();
    updateHistoryButtons();
    updateCanvasBorder();

    (window as any).currentMode = 'draw';
    setMode('draw');
    recenterCanvas();
    updateTransformPanelState();

    attachEventListeners();
    attachDynamicListeners();
    initSidebarResizing();
    updateWorkspaceLayout();
    initAdvancedPicker();
    makeDraggable('exportModal');

    // Initial state check for body classes
    if (sidePanel) {
        const isMinimized = sidePanel.classList.contains('minimized');
        document.body.classList.toggle('panel-minimized', isMinimized);
    }

    if (signaturePad) {
        // Fix for SignaturePad 5.x: The library expects _createPoint(clientX, clientY, pressure).
        const originalCreatePoint = (signaturePad as any)._createPoint;
        if (typeof originalCreatePoint === 'function') {
            (signaturePad as any)._createPoint = function (x: number, y: number, pressure: number) {
                const rect = canvas.getBoundingClientRect();
                // Definitive scale factor: realized screen width / logical layout width
                const s = rect.width / (canvas.clientWidth || 1);

                // 1. Convert screen to logical canvas coordinates (0 to HUGE)
                const logicalXHuge = (x - rect.left) / (s || 1);
                const logicalYHuge = (y - rect.top) / (s || 1);

                // 2. Subtract margin so (0,0) is at container top-left
                const logicalX = logicalXHuge - CANVAS_MARGIN;
                const logicalY = logicalYHuge - CANVAS_MARGIN;

                // 3. SignaturePad internally subtracts rect.left, 
                // so we pass rect.left + logical coord to counteract it.
                return originalCreatePoint.call(this, rect.left + logicalX, rect.top + logicalY, pressure);
            };
        }

        // Sync the older internal reference just in case
        (signaturePad as any)._getPointFromEvent = (signaturePad as any)._createPoint;
    }
    updateTransformPanelState();
    updateHintVisibility();
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
        updateHintVisibility();
        if (selectionCanvas) selectionCanvas.classList.remove('active');
        deselectStroke(false);
    } else {
        signaturePad.off();
        updateHintVisibility();
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
    if (!container || !workspace) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const sx = rect.width / (container.clientWidth || 1);
    const sy = rect.height / (container.clientHeight || 1);
    const s = (sx + sy) / 2;

    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
        x: (clientX - rect.left) / (s || 1),
        y: (clientY - rect.top) / (s || 1)
    };
}

export function updateExportDpi(val: string | number) {
    let dpi = parseFloat(val.toString());
    if (isNaN(dpi)) dpi = 96; // Default fallback
    dpi = Math.max(72, Math.min(10000, dpi));
    setExportDpi(dpi);

    // Update modal elements
    const el = document.getElementById('modalDpiVal') as HTMLInputElement;
    if (el) el.value = Math.round(dpi).toString();

    // Active state managed by click listeners now.

    // If modal is open, update preview
    if (!document.getElementById('exportModal')?.classList.contains('hidden')) {
        updateExportPreview();
    }
}

export function updateExportQuality(val: string | number) {
    const quality = Math.max(10, Math.min(100, parseInt(val.toString())));
    setExportQuality(quality / 100);

    // Update modal elements
    const valEl = document.getElementById('modalQualityVal');
    if (valEl) valEl.textContent = quality + '%';

    const slider = document.getElementById('modalQualitySlider') as HTMLInputElement;
    if (slider) slider.value = quality.toString();

    // If modal is open, update preview
    if (!document.getElementById('exportModal')?.classList.contains('hidden')) {
        updateExportPreview();
    }
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
        updateHintVisibility(true);
    });

    // Ensure hint is updated after any drawing operation
    signaturePad.addEventListener("afterUpdate", () => {
        updateHintVisibility();
    });


    document.getElementById('workspaceToggle')?.addEventListener('click', () => {
        sidePanel.classList.toggle('minimized');
        const isMinimized = sidePanel.classList.contains('minimized');
        document.body.classList.toggle('panel-minimized', isMinimized);

        // Ensure visibility
        if (!isMinimized) {
            sidePanel.style.display = 'flex';

            // Progressive loading of panel sections
            const groupStroke = document.getElementById('groupStroke');
            const groupTransform = document.getElementById('groupTransform');
            const groupCanvas = document.getElementById('groupCanvas');

            // Hide all sections initially
            if (groupStroke) groupStroke.style.display = 'none';
            if (groupTransform) groupTransform.style.display = 'none';
            if (groupCanvas) groupCanvas.style.display = 'none';

            requestAnimationFrame(() => {
                sidePanel.style.opacity = '1';
                sidePanel.style.transform = sidePanel.classList.contains('docked') ? 'none' : 'translateX(0)';
                updateWorkspaceLayout();

                // Load sections progressively
                setTimeout(() => {
                    if (groupStroke) {
                        groupStroke.style.display = 'block';
                        groupStroke.style.opacity = '0';
                        requestAnimationFrame(() => {
                            groupStroke.style.transition = 'opacity 0.2s ease-in';
                            groupStroke.style.opacity = '1';
                        });
                    }
                }, 50);

                setTimeout(() => {
                    if (groupTransform) {
                        groupTransform.style.display = 'block';
                        groupTransform.style.opacity = '0';
                        requestAnimationFrame(() => {
                            groupTransform.style.transition = 'opacity 0.2s ease-in';
                            groupTransform.style.opacity = '1';
                        });
                    }
                }, 150);

                setTimeout(() => {
                    if (groupCanvas) {
                        groupCanvas.style.display = 'block';
                        groupCanvas.style.opacity = '0';
                        requestAnimationFrame(() => {
                            groupCanvas.style.transition = 'opacity 0.2s ease-in';
                            groupCanvas.style.opacity = '1';
                        });
                    }
                }, 250);
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
            const picker = colorDot.parentElement!;
            picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            colorDot.classList.add('active');
            const color = colorDot.getAttribute('data-color')!;

            if (picker.id === 'colorPicker') {
                applyColor(color);
            } else if (picker.id === 'canvasBgPicker') {
                if (container) {
                    container.style.backgroundColor = color;
                    updateCanvasBackground();
                }
            } else if (picker.id === 'canvasBorderColorPicker') {
                if (container) {
                    container.style.borderColor = color;
                    updateCanvasBorder();
                }
            }

            // If a standard dot is selected, clear the custom color for this picker
            if (!colorDot.classList.contains('custom-selected-dot')) {
                customColors[picker.id] = '';
                picker.querySelector('.custom-selected-dot')?.classList.add('hidden');
            }
        }

        const customBtn = target.closest('.custom-color-btn') as HTMLElement;
        if (customBtn) {
            activePickerId = customBtn.parentElement!.id;
            openAdvancedPicker();
        }

        const langBtn = target.closest('.lang-btn') as HTMLElement;
        if (langBtn) {
            updateLanguage(langBtn.dataset.lang!);
            renderUIComponents();
            updateGlobalReferences();
            createIcons();
            attachControlListeners();
        }

        const borderTypeBtn = target.closest('#borderTypePresets .preset-btn') as HTMLElement;
        if (borderTypeBtn) {
            document.querySelectorAll('#borderTypePresets .preset-btn').forEach(b => b.classList.remove('active'));
            borderTypeBtn.classList.add('active');
            if (container) {
                currentCanvasBorderStyle = borderTypeBtn.dataset.borderType!;
                updateCanvasBorder();
            }
        }

        const radiusUnitBtn = target.closest('#radiusUnitToggle .unit-btn') as HTMLElement;
        if (radiusUnitBtn) {
            document.querySelectorAll('#radiusUnitToggle .unit-btn').forEach(b => b.classList.remove('active'));
            radiusUnitBtn.classList.add('active');
            currentRadiusUnit = radiusUnitBtn.dataset.unit || 'px';
            const radiusSlider = document.getElementById('radiusSlider') as HTMLInputElement;
            if (radiusSlider) {
                const val = radiusSlider.value + currentRadiusUnit;
                const radiusVal = document.getElementById('radiusVal');
                if (radiusVal) radiusVal.textContent = val;
                updateCanvasBorder();
            }
        }

        const sizePresetBtn = target.closest('#canvasSizePresets .preset-btn') as HTMLElement;
        if (sizePresetBtn) {
            document.querySelectorAll('#canvasSizePresets .preset-btn').forEach(b => b.classList.remove('active'));
            sizePresetBtn.classList.add('active');

            const size = sizePresetBtn.dataset.size;
            const updateCanvasW = (val: number) => { if (container) container.style.width = val + 'px'; syncSizeValues(); resizeCanvas(); };
            const updateCanvasH = (val: number) => { if (container) container.style.height = val + 'px'; syncSizeValues(); resizeCanvas(); };
            if (size === 'normal') { updateCanvasW(836); updateCanvasH(400); }
            else if (size === 'medium') { updateCanvasW(1200); updateCanvasH(600); }
            else if (size === 'large') { updateCanvasW(1600); updateCanvasH(800); }
        }

        const dpiPresetBtn = target.closest('.dpi-presets .preset-btn') as HTMLElement;
        if (dpiPresetBtn) {
            updateExportDpi(dpiPresetBtn.dataset.dpi!);
        }

        if (target.closest('#exportMainBtn')) triggerExport();

        const formatBtn = target.closest('#modalFormatSelector .preset-btn') as HTMLElement;
        if (formatBtn) {
            setExportFormat(formatBtn.dataset.format!);
            document.querySelectorAll('#modalFormatSelector .preset-btn').forEach(b => b.classList.remove('active'));
            formatBtn.classList.add('active');
            updateModalContext();
            updateExportPreview();
        }

        const actionBtn = target.closest('#modalActionSelector .preset-btn') as HTMLElement;
        if (actionBtn) {
            setExportAction(actionBtn.dataset.action!);
            document.querySelectorAll('#modalActionSelector .preset-btn').forEach(b => b.classList.remove('active'));
            actionBtn.classList.add('active');
            updateModalContext();
            updateExportPreview();
        }

        if (target.closest('#closeExportModal')) {
            document.getElementById('exportModal')?.classList.add('hidden');
        }

        if (target.closest('#finalExportBtn')) {
            const format = State.exportFormat;
            const action = State.exportAction;

            document.getElementById('exportModal')?.classList.add('hidden');

            if (action === 'download') {
                if (format === 'PNG') downloadPng();
                else if (format === 'SVG') downloadSvg();
                else if (format === 'JPG') downloadJpg();
                else if (format === 'WEBP') downloadWebp();
            } else if (action === 'copy') {
                if (format === 'PNG') copyPngToClipboard();
                else if (format === 'SVG') copySvgBase64();
                else if (format === 'JPG') copyJpgBase64();
                else if (format === 'WEBP') copyWebpBase64();
            } else if (action === 'base64') {
                if (format === 'PNG') copyPngBase64();
                else if (format === 'SVG') copySvgBase64();
                else if (format === 'JPG') copyJpgBase64();
                else if (format === 'WEBP') copyWebpBase64();
            }
        }



        if (target.closest('#undoBtn')) undo();
        if (target.closest('#redoBtn')) redo();
        if (target.closest('#clearBtn')) {
            if (!signaturePad.isEmpty()) {
                saveState();
                signaturePad.clear();
                updateHintVisibility();
                deselectStroke(false);
            }
        }

        if (target.closest('#centerCanvasBtn')) autoAdjustCanvas();
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
        const val = Math.max(20, Math.min(2000, parseInt(w)));
        if (container) container.style.width = val + 'px';
        const wVal = document.getElementById('canvasWidthVal') as HTMLInputElement;
        const wSlider = document.getElementById('widthSlider') as HTMLInputElement;
        if (wVal) wVal.value = val.toString();
        if (wSlider) wSlider.value = val.toString();
        syncSizeValues(); resizeCanvas();
    };
    const updateCanvasH = (h: any) => {
        const val = Math.max(20, Math.min(1000, parseInt(h)));
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

    document.getElementById('bgOpacitySlider')?.addEventListener('input', (e: any) => {
        bgOpacity = parseFloat(e.target.value) / 100;
        const valEl = document.getElementById('bgOpacityVal');
        if (valEl) valEl.innerText = e.target.value + '%';
        updateCanvasBackground();
    });

    document.getElementById('borderOpacitySlider')?.addEventListener('input', (e: any) => {
        borderOpacity = parseFloat(e.target.value) / 100;
        const valEl = document.getElementById('borderOpacityVal');
        if (valEl) valEl.innerText = e.target.value + '%';
        updateCanvasBorder();
    });

    document.getElementById('radiusSlider')?.addEventListener('input', (e: any) => {
        const val = e.target.value + currentRadiusUnit;
        if (container) {
            container.style.borderRadius = val;
            updateCanvasBorder();
        }
        const radiusVal = document.getElementById('radiusVal');
        if (radiusVal) radiusVal.textContent = val;
    });

    document.getElementById('borderWidthSlider')?.addEventListener('input', (e: any) => {
        const val = e.target.value + 'px';
        if (container) {
            container.style.borderWidth = val;
            updateCanvasBorder();
        }
        const borderWidthVal = document.getElementById('borderWidthVal');
        if (borderWidthVal) borderWidthVal.textContent = val;
    });

    document.getElementById('borderDashSlider')?.addEventListener('input', (e: any) => {
        const val = e.target.value + 'px';
        updateCanvasBorder();
        const borderDashVal = document.getElementById('borderDashVal');
        if (borderDashVal) borderDashVal.textContent = val;
    });

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

    document.getElementById('modalQualitySlider')?.addEventListener('input', (e: any) => updateExportQuality(e.target.value));

    const modalDpiValEl = document.getElementById('modalDpiVal') as HTMLInputElement;
    if (modalDpiValEl) modalDpiValEl.onchange = (e: any) => updateExportDpi(e.target.value);

    setupContinuousClick('incModalDpi', () => updateExportDpi(State.exportDpi + 10));
    setupContinuousClick('decModalDpi', () => updateExportDpi(State.exportDpi - 10));
    setupScrubbing('modalDpiScrubArea', () => State.exportDpi, (v) => updateExportDpi(v), 2);

    document.getElementById('modalClipToggle')?.addEventListener('change', (e: any) => {
        setExportClipOutOfBounds(e.target.checked);
        updateExportPreview();
    });

    document.getElementById('viewClipToggle')?.addEventListener('change', (e: any) => {
        setViewClipOutOfBounds(e.target.checked);
        updateWorkspaceView();
    });

    // --- New Export Controls ---
    // --- New Export Controls ---
    // --- New Export Controls ---
    const toggleDpiInput = (enable: boolean) => {
        const input = document.getElementById('modalDpiVal') as HTMLInputElement;
        const inc = document.getElementById('incModalDpi') as HTMLButtonElement;
        const dec = document.getElementById('decModalDpi') as HTMLButtonElement;
        const scrub = document.getElementById('modalDpiScrubArea');

        if (input) input.disabled = !enable;
        if (inc) inc.disabled = !enable;
        if (dec) dec.disabled = !enable;
        if (scrub) scrub.style.pointerEvents = enable ? 'auto' : 'none';
        if (scrub) scrub.style.opacity = enable ? '1' : '0.5';
    };

    // Initialize as disabled
    toggleDpiInput(false);

    // Unified Preset Listener
    document.querySelectorAll('.dpi-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const b = e.currentTarget as HTMLElement;
            const dpiData = b.dataset.dpi;

            // Update active state
            document.querySelectorAll('.dpi-presets .preset-btn').forEach(el => el.classList.remove('active'));
            b.classList.add('active');

            if (dpiData === 'CUSTOM') {
                toggleDpiInput(true);
                setExportPreset('CUSTOM');
            } else {
                toggleDpiInput(false);
                setExportPreset(dpiData || 'DEFAULT');
            }
            updateExportPreview();
        });
    });

    // Removed setDpiForResolution as it's no longer used for automatic conversion


    const updateMargin = (val: number) => {
        setExportMargin(val);
        const el = document.getElementById('modalMarginVal');
        if (el) el.textContent = val + 'px';
        updateExportPreview();
    };
    document.getElementById('modalMarginSlider')?.addEventListener('input', (e: any) => updateMargin(parseInt(e.target.value)));

    const updateExportScale = (val: number) => {
        const v = parseFloat(val.toString());
        const final = Math.max(0.5, Math.min(10, v));
        setExportScale(final);
        const el = document.getElementById('modalScaleVal');
        if (el) el.innerText = final + 'x';
        updateExportPreview();
    };
    document.getElementById('modalScaleSlider')?.addEventListener('input', (e: any) => updateExportScale(parseFloat(e.target.value)));

    // Explicit listeners for Action and Format selectors if not already covered
    document.querySelectorAll('#modalActionSelector .preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            if (action) {
                setExportAction(action);
                // Update active state
                document.querySelectorAll('#modalActionSelector .preset-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                // Update Icon
                const finalBtn = document.getElementById('finalExportBtn');
                if (finalBtn) {
                    const iconName = action === 'download' ? 'download' : (action === 'copy' ? 'copy' : 'file-code');
                    // Remove existing icon (SVG or i)
                    const oldIcon = finalBtn.querySelector('i, svg');
                    if (oldIcon) oldIcon.remove();

                    // Add new icon
                    const i = document.createElement('i');
                    i.setAttribute('data-lucide', iconName);
                    finalBtn.prepend(i);
                    createIcons(); // content is updated
                }
                updateModalContext();
            }
        });
    });

    document.querySelectorAll('#modalFormatSelector .preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const format = target.dataset.format;
            if (format) {
                setExportFormat(format);
                document.querySelectorAll('#modalFormatSelector .preset-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                updateModalContext();
                updateExportPreview();
            }
        });
    });

    updateWorkspaceView(); // Initialize state

    // Capture points outside canvas during drawing
    const mainCanvas = document.getElementById('signatureCanvas');
    if (mainCanvas) {
        mainCanvas.addEventListener('pointerdown', (e) => {
            (mainCanvas as HTMLElement).setPointerCapture(e.pointerId);
        });
    }
}

export function updateWorkspaceView() {
    if (!container) return;
    container.style.overflow = State.viewClipOutOfBounds ? 'hidden' : 'visible';
}

function updateCanvasBackground() {
    if (!container) return;
    const bgColor = container.style.backgroundColor || '#0d1117';
    // If it's hex, convert to rgba. If it's already rgba, we replace the alpha.
    const finalColor = applyAlpha(bgColor, bgOpacity);
    container.style.backgroundColor = finalColor;
}

function applyAlpha(color: string, alpha: number) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
        return 'rgba(0, 0, 0, 0)';
    }
    if (color.startsWith('rgba')) {
        return color.replace(/[\d\.]+\)$/g, `${alpha})`);
    } else if (color.startsWith('#')) {
        return hexToRgba(color, alpha);
    } else if (color.startsWith('rgb')) {
        return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }
    return color;
}

function hexToRgba(hex: string, alpha: number) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateCanvasBorder() {
    if (!container) return;
    const style = currentCanvasBorderStyle;
    const rawColor = container.style.borderColor || 'rgba(255, 255, 255, 0.08)';
    const color = applyAlpha(rawColor, borderOpacity);
    const width = (document.getElementById('borderWidthSlider') as HTMLInputElement)?.value || '1';
    const radius = (document.getElementById('radiusSlider') as HTMLInputElement)?.value || '0';
    const dashVal = (document.getElementById('borderDashSlider') as HTMLInputElement)?.value || '4';

    const isNone = style === 'none';
    const dashSlider = document.getElementById('borderDashSlider') as HTMLInputElement;
    if (dashSlider) dashSlider.disabled = (style === 'solid' || isNone);

    const widthSlider = document.getElementById('borderWidthSlider') as HTMLInputElement;
    const radiusSlider = document.getElementById('radiusSlider') as HTMLInputElement;
    const borderOpacitySlider = document.getElementById('borderOpacitySlider') as HTMLInputElement;
    const borderColorPicker = document.getElementById('canvasBorderColorPicker') as HTMLElement;

    if (widthSlider) widthSlider.disabled = isNone;
    if (radiusSlider) radiusSlider.disabled = isNone;
    if (borderOpacitySlider) borderOpacitySlider.disabled = isNone;
    if (borderColorPicker) {
        borderColorPicker.style.pointerEvents = isNone ? 'none' : 'auto';
        borderColorPicker.style.opacity = isNone ? '0.5' : '1';
    }

    const radiusWithUnit = radius + currentRadiusUnit;

    if (style === 'solid' || style === 'none') {
        container.style.backgroundImage = 'none';
        container.style.borderStyle = style;
        container.style.borderWidth = width + 'px';
        container.style.borderColor = color;
        container.style.borderRadius = radiusWithUnit;
        return;
    }

    // Advanced: SVG Border for custom dashed/dotted spacing
    container.style.borderStyle = 'none';
    container.style.borderWidth = '0';

    let dashArray = `${dashVal}, ${dashVal}`;
    if (style === 'dotted') dashArray = `1, ${dashVal}`;

    const radiusPx = currentRadiusUnit === '%' ? (parseFloat(radius) / 100) * Math.min(container.offsetWidth, container.offsetHeight) : parseFloat(radius);

    const finalSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>
            <rect x='${parseFloat(width) / 2}' y='${parseFloat(width) / 2}' 
                  width='calc(100% - ${width}px)' height='calc(100% - ${width}px)' 
                  style='fill:none; stroke:${color}; stroke-width:${width}; stroke-dasharray:${dashArray};' 
                  rx='${radiusPx}' ry='${radiusPx}'/>
        </svg>
    `.trim().replace(/\n/g, '').replace(/\s+/g, ' ');

    container.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(finalSvg)}")`;
    container.style.backgroundSize = '100% 100%';
    container.style.backgroundRepeat = 'no-repeat';
    container.style.borderRadius = radiusWithUnit;
}

// --- Advanced Color Picker Logic ---

// --- Floating Window Logic ---

function makeDraggable(windowId: string) {
    const picker = document.getElementById(windowId);
    if (!picker) return;

    // Use header if available, otherwise the element itself (fallback)
    const handle = picker.querySelector('.window-header') || picker;

    let isDragging = false;
    let startX = 0, startY = 0;
    // We store initial offsets relative to the viewport
    let initialLeft = 0, initialTop = 0;

    handle.addEventListener('pointerdown', (e: any) => {
        // Ignore clicks on buttons/inputs inside the header
        if (e.target.closest('button') || e.target.closest('input')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = picker.getBoundingClientRect();
        // Since we use transform translate(-50%, -50%) for centering, 'left' and 'top' should track the center point
        // BUT if it's not centered via transform, we need to adapt.
        // Assuming the CSS uses: top: 50%; left: 50%; transform: translate(-50%, -50%);
        // We will switch to direct pixel positioning on drag start to avoid transform complexity, or just update top/left.
        // Let's stick to updating top/left assuming they are the center point if transform is present.

        // Actually, let's keep it simple: Calculate the current visual top/left and map it.
        // If transform is present, the 'left/top' style properties might be percentage based initially.
        // We will convert them to pixels on start.

        // Simpler approach: 
        // 1. Get current visual rect.
        // 2. Set margins to 0 and transform to none to take full manual control.
        // 3. Set top/left to the current rect position.

        // However, this might break centering logic if resizing happens. 
        // Let's stick to the existing logic but clamp the result.

        // Existing logic uses: 
        // initialX = rect.left + rect.width / 2;
        // initialY = rect.top + rect.height / 2;
        // picker.style.left = ...

        // Let's refine that.
        initialLeft = rect.left;
        initialTop = rect.top;

        // We need to account for the fact that setting 'left' might move the element differently if 'transform' is active.
        // If transform is translate(-50%, -50%), then setting left=X puts the center at X.
        // The existing code: picker.style.left = `${initialX + dx}px` implies setting center.

        // Let's detect if transform is active.
        // If we want to constrain it, we need to know the dimensions.

        // If we want to constrain it, we need to know the dimensions.
        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e: any) => {
        if (!isDragging) return;
        e.preventDefault();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const rect = picker.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // Constrain to viewport
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        // Clamp (newLeft, newTop) ensures the top-left corner is within [0, W-w] and [0, H-h]
        newLeft = Math.max(0, Math.min(newLeft, viewportW - width));
        newTop = Math.max(0, Math.min(newTop, viewportH - height));

        // Now apply to the element. 
        // If the element has transform: translate(-50%, -50%), then 'left' needs to be center.
        // rect.left is the visual left edge.
        // If we want visual left edge to be 'newLeft', and we have translate(-50%), 
        // then style.left should be newLeft + width/2.

        picker.style.margin = '0'; // Clear auto margins if any
        picker.style.transform = 'translate(0, 0)'; // Remove centering transform to simplify positioning
        picker.style.left = `${newLeft}px`;
        picker.style.top = `${newTop}px`;
    });

    handle.addEventListener('pointerup', (e: any) => {
        isDragging = false;
        handle.releasePointerCapture(e.pointerId);
    });
}

let refreshAdvancedPicker: (() => void) | null = null;
function initAdvancedPicker() {
    const picker = document.getElementById('advancedColorPicker');
    const closeBtn = document.getElementById('closeAdvancedPicker');
    const addFavBtn = document.getElementById('addFavoriteBtn');

    makeDraggable('advancedColorPicker');

    closeBtn?.addEventListener('click', () => {
        picker?.classList.add('hidden');
    });

    addFavBtn?.addEventListener('click', () => {
        const color = hexInput.value.toUpperCase();
        if (!favoriteColors.includes(color)) {
            if (favoriteColors.length >= 4) {
                showToast(i18n[currentLang as keyof typeof i18n].toastMaxFavorites, "#f59e0b");
                return;
            }
            setFavoriteColors([...favoriteColors, color]);
            renderAdvancedFavorites();
            renderUIComponents();
            updateGlobalReferences();
            createIcons();
        }
    });

    const canvas = document.getElementById('colorCanvas') as HTMLCanvasElement;
    const hueSlider = document.getElementById('hueSlider') as HTMLInputElement;
    const rInput = document.getElementById('rInput') as HTMLInputElement;
    const gInput = document.getElementById('gInput') as HTMLInputElement;
    const bInput = document.getElementById('bInput') as HTMLInputElement;
    const hexInput = document.getElementById('hexInput') as HTMLInputElement;
    const applyBtn = document.getElementById('applyAdvancedColor');

    function updateFromHSB() {
        const rgb = hsbToRgb(currentPickerColor.h, currentPickerColor.s, currentPickerColor.v);
        rInput.value = rgb.r.toString();
        gInput.value = rgb.g.toString();
        bInput.value = rgb.b.toString();
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        hexInput.value = hex.toUpperCase();
        document.getElementById('currentColorPreview')!.style.backgroundColor = hex;
        renderColorCanvas();
        updateCursorPosition();
    }

    canvas?.addEventListener('pointerdown', (e) => {
        const onMove = (pe: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            let x = Math.max(0, Math.min(rect.width, pe.clientX - rect.left));
            let y = Math.max(0, Math.min(rect.height, pe.clientY - rect.top));
            currentPickerColor.s = (x / rect.width) * 100;
            currentPickerColor.v = 100 - (y / rect.height) * 100;
            updateFromHSB();
        };
        onMove(e);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', () => window.removeEventListener('pointermove', onMove), { once: true });
    });

    hueSlider?.addEventListener('input', (e: any) => {
        currentPickerColor.h = parseInt(e.target.value);
        updateFromHSB();
    });

    [rInput, gInput, bInput].forEach(inp => {
        inp.addEventListener('change', () => {
            const r = parseInt(rInput.value), g = parseInt(gInput.value), b = parseInt(bInput.value);
            const hsb = rgbToHsb(r, g, b);
            currentPickerColor = hsb;
            hueSlider.value = hsb.h.toString();
            updateFromHSB();
        });

        // Custom arrows logic
        const arrows = inp.parentElement!.querySelector('.input-arrows');
        arrows?.querySelector('.arrow-up')?.addEventListener('click', () => {
            inp.value = Math.min(255, parseInt(inp.value || '0') + 1).toString();
            inp.dispatchEvent(new Event('change'));
        });
        arrows?.querySelector('.arrow-down')?.addEventListener('click', () => {
            inp.value = Math.max(0, parseInt(inp.value || '0') - 1).toString();
            inp.dispatchEvent(new Event('change'));
        });
    });

    hexInput?.addEventListener('change', () => {
        const rgb = hexToRgb(hexInput.value);
        if (rgb) {
            const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
            currentPickerColor = hsb;
            hueSlider.value = hsb.h.toString();
            updateFromHSB();
        }
    });

    applyBtn?.addEventListener('click', () => {
        const color = hexInput.value;
        applySelectedColor(color);
        picker?.classList.add('hidden');
    });

    refreshAdvancedPicker = updateFromHSB;
    renderColorCanvas();
    renderAdvancedFavorites();
}

function renderAdvancedFavorites() {
    const container = document.getElementById('advancedFavorites');
    if (!container) return;

    container.innerHTML = favoriteColors.map((color, index) => `
        <div class="fav-item" data-index="${index}">
            <div class="fav-dot" style="background: ${color};" data-color="${color}"></div>
            <div class="fav-controls">
                <button class="fav-action move-left" title="Mover izquierda">
                    <i data-lucide="chevron-left"></i>
                </button>
                <button class="fav-action remove-fav" title="Eliminar">
                    <i data-lucide="x"></i>
                </button>
                <button class="fav-action move-right" title="Mover derecha">
                    <i data-lucide="chevron-right"></i>
                </button>
            </div>
        </div>
    `).join('');

    createIcons();

    container.querySelectorAll('.fav-dot').forEach(dot => {
        dot.addEventListener('click', (e: any) => {
            const color = e.target.dataset.color;
            const rgb = hexToRgb(color);
            if (rgb) {
                currentPickerColor = rgbToHsb(rgb.r, rgb.g, rgb.b);
                const hueSlider = document.getElementById('hueSlider') as HTMLInputElement;
                hueSlider.value = currentPickerColor.h.toString();

                // Trigger update
                const rInput = document.getElementById('rInput') as HTMLInputElement;
                const gInput = document.getElementById('gInput') as HTMLInputElement;
                const bInput = document.getElementById('bInput') as HTMLInputElement;
                const hexInput = document.getElementById('hexInput') as HTMLInputElement;

                const rgbVal = hsbToRgb(currentPickerColor.h, currentPickerColor.s, currentPickerColor.v);
                rInput.value = rgbVal.r.toString();
                gInput.value = rgbVal.g.toString();
                bInput.value = rgbVal.b.toString();
                hexInput.value = color.toUpperCase();
                document.getElementById('currentColorPreview')!.style.backgroundColor = color;

                renderColorCanvas();
                updateCursorPosition();
            }
        });
    });

    container.querySelectorAll('.fav-action').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.stopPropagation();
            const item = btn.closest('.fav-item') as HTMLElement;
            const index = parseInt(item.dataset.index!);
            let newFavs = [...favoriteColors];

            if (btn.classList.contains('remove-fav')) {
                newFavs.splice(index, 1);
            } else if (btn.classList.contains('move-left') && index > 0) {
                [newFavs[index - 1], newFavs[index]] = [newFavs[index], newFavs[index - 1]];
            } else if (btn.classList.contains('move-right') && index < newFavs.length - 1) {
                [newFavs[index + 1], newFavs[index]] = [newFavs[index], newFavs[index + 1]];
            }

            setFavoriteColors(newFavs);
            renderAdvancedFavorites();
            renderUIComponents();
            updateGlobalReferences();
        });
    });
}

function renderColorCanvas() {
    const canvas = document.getElementById('colorCanvas') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = `hsl(${currentPickerColor.h}, 100%, 50%)`;
    ctx.fillRect(0, 0, w, h);

    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, '#fff');
    whiteGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, 'transparent');
    blackGrad.addColorStop(1, '#000');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
}

function updateCursorPosition() {
    const cursor = document.getElementById('colorCursor');
    if (cursor) {
        cursor.style.left = `${currentPickerColor.s}%`;
        cursor.style.top = `${100 - currentPickerColor.v}%`;
    }
}

function openAdvancedPicker() {
    if (!activePickerId) return;

    // Get current color from custom or default
    let color = customColors[activePickerId];
    if (!color) {
        if (activePickerId === 'colorPicker') color = '#ffffff';
        else if (activePickerId === 'canvasBgPicker') color = '#0f172a';
        else color = '#ffffff';
    }

    const rgb = hexToRgb(color);
    if (rgb) {
        currentPickerColor = rgbToHsb(rgb.r, rgb.g, rgb.b);
        const hueSlider = document.getElementById('hueSlider') as HTMLInputElement;
        if (hueSlider) hueSlider.value = currentPickerColor.h.toString();
        if (refreshAdvancedPicker) refreshAdvancedPicker();
    }

    document.getElementById('advancedColorPicker')?.classList.remove('hidden');
    updateCursorPosition();
}

function applySelectedColor(color: string) {
    if (!activePickerId) return;
    const picker = document.getElementById(activePickerId);
    if (!picker) return;

    // Persist in state
    customColors[activePickerId] = color;

    // Update the custom dot
    let customDot = picker.querySelector('.custom-selected-dot') as HTMLElement;
    if (customDot) {
        customDot.style.background = color;
        customDot.dataset.color = color;
        customDot.classList.remove('hidden');
        picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        customDot.classList.add('active');
    }

    if (activePickerId === 'colorPicker') {
        applyColor(color);
    } else if (activePickerId === 'canvasBgPicker') {
        if (container) {
            container.style.backgroundColor = color;
            updateCanvasBackground();
        }
    } else if (activePickerId === 'canvasBorderColorPicker') {
        if (container) {
            container.style.borderColor = color;
            updateCanvasBorder();
        }
    }

    // Re-render UI to update dots if color was custom
    renderUIComponents();
    updateGlobalReferences();
    createIcons();
}

// Math helpers
function hsbToRgb(h: number, s: number, b: number) {
    s /= 100; b /= 100;
    const k = (n: number) => (n + h / 60) % 6;
    const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
    return { r: Math.round(255 * f(5)), g: Math.round(255 * f(3)), b: Math.round(255 * f(1)) };
}

function rgbToHex(r: number, g: number, b: number) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function rgbToHsb(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function handleWheel(e: WheelEvent) {
    if (!workspace || !canvas) return;
    e.preventDefault();

    // 1. Get current physical position of drawing surface (container)
    const containerRect = container.getBoundingClientRect();

    // 2. Identify the logical "Scene" coordinate under the mouse
    // This is the invariant point we want to keep under the cursor.
    const sceneX = (e.clientX - containerRect.left) / State.workspaceScale;
    const sceneY = (e.clientY - containerRect.top) / State.workspaceScale;

    // 3. Calculate new scale
    const delta = -e.deltaY, factor = 1 + delta * 0.001;
    const newScale = Math.max(0.1, Math.min(5, State.workspaceScale * factor));

    if (newScale !== State.workspaceScale) {
        // 4. Stable "Initial" layout position (pan=0)
        // Since transform-origin is 0,0, the left edge visual position is: InitialLeft + PanX
        // So InitialLeft = current_left - current_pan
        const initialLayoutX = containerRect.left - workspacePan.x;
        const initialLayoutY = containerRect.top - workspacePan.y;

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

    function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
    }

    if (State.currentMode === 'select' || State.currentMode === 'transform') {
        const bounds = getSelectedDataBounds();
        const clickedInsideSelection = (cx >= bounds.minX && cx <= bounds.maxX && cy >= bounds.minY && cy <= bounds.maxY);
        const data = signaturePad.toData();
        let clickedStrokeIdx = -1;
        const rect = canvas.getBoundingClientRect();
        const actualScaleX = rect.width / canvas.offsetWidth || 1;

        for (let i = data.length - 1; i >= 0; i--) {
            const stroke = data[i];
            const baseSlop = 15 / actualScaleX;
            const radius = ((stroke.maxWidth + stroke.minWidth) / 2) + baseSlop;
            const tolerance = 12 / State.workspaceScale;
            const threshold = radius + tolerance;

            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for (const p of stroke.points) {
                if (p.x < sMinX) sMinX = p.x; if (p.x > sMaxX) sMaxX = p.x;
                if (p.y < sMinY) sMinY = p.y; if (p.y > sMaxY) sMaxY = p.y;
            }
            if (cx < sMinX - threshold || cx > sMaxX + threshold || cy < sMinY - threshold || cy > sMaxY + threshold) continue;

            // Detailed Check: Distance to each segment
            for (let j = 0; j < stroke.points.length - 1; j++) {
                const p1 = stroke.points[j], p2 = stroke.points[j + 1];
                if (distToSegment(cx, cy, p1.x, p1.y, p2.x, p2.y) < threshold) {
                    clickedStrokeIdx = i; break;
                }
            }
            if (clickedStrokeIdx !== -1) break;

            // Single point stroke check
            if (stroke.points.length === 1) {
                const p = stroke.points[0];
                if (Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) < threshold) {
                    clickedStrokeIdx = i; break;
                }
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
                // If it's a fixed click on background, findStrokesInArea will handle deselection on Up
            } else if (State.currentMode === 'transform' && !clickedInsideSelection) {
                deselectStroke();
            }
        }
    } else if (State.currentMode === 'pan') {
        setPanning(true); panStart = { x: e.clientX, y: e.clientY };
    }
}

function handlePointerMove(e: PointerEvent) {
    updateCursor(e);
    if (State.isPanning) {
        workspacePan.x += (e.clientX - panStart.x); workspacePan.y += (e.clientY - panStart.y);
        panStart = { x: e.clientX, y: e.clientY }; updateWorkspaceTransform(); return;
    }
    const { x: cx, y: cy } = getCanvasCoordinates(e);
    if (State.isSelecting && selectionBox) {
        const dx = Math.abs(cx - selectStart.x), dy = Math.abs(cy - selectStart.y);
        if (dx > 3 || dy > 3) {
            const x = Math.min(cx, selectStart.x), y = Math.min(cy, selectStart.y), w = Math.abs(cx - selectStart.x), h = Math.abs(cy - selectStart.y);
            selectionBox.style.display = 'block';
            selectionBox.style.left = x + 'px'; selectionBox.style.top = y + 'px'; selectionBox.style.width = w + 'px'; selectionBox.style.height = h + 'px';
        }
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
        setSelecting(false);
        if (selectionBox) {
            selectionBox.style.display = 'none';
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
        }
        const { x: cx, y: cy } = getCanvasCoordinates(e);
        findStrokesInArea(selectStart.x, selectStart.y, cx, cy, e.shiftKey, e.ctrlKey);
        selectStart = { x: 0, y: 0 };
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
        safeFromData(data);
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
    function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
    }

    data.forEach((stroke, idx) => {
        if (!stroke) return;
        let match = false;
        const hitSlop = 15 / actualScaleX;
        const radius = (((stroke.maxWidth || 0) + (stroke.minWidth || 0)) / 2) + hitSlop;
        const tolerance = 12 / State.workspaceScale;
        const threshold = radius + tolerance;

        let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
        for (const p of stroke.points) {
            if (p.x < sMinX) sMinX = p.x; if (p.x > sMaxX) sMaxX = p.x;
            if (p.y < sMinY) sMinY = p.y; if (p.y > sMaxY) sMaxY = p.y;
        }

        if (isClick) {
            if (midX >= sMinX - threshold && midX <= sMaxX + threshold && midY >= sMinY - threshold && midY <= sMaxY + threshold) {
                for (let j = 0; j < stroke.points.length - 1; j++) {
                    if (distToSegment(midX, midY, stroke.points[j].x, stroke.points[j].y, stroke.points[j + 1].x, stroke.points[j + 1].y) < threshold) {
                        match = true; break;
                    }
                }
                if (!match && stroke.points.length === 1) {
                    const p = stroke.points[0];
                    if (Math.sqrt((p.x - midX) ** 2 + (p.y - midY) ** 2) < threshold) match = true;
                }
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
    updateStrokeStyles();
}

function deselectStroke(save = true) {
    if (State.selectedStrokeIndices.length === 0) return;
    if (save) saveState(); setSelectedIndices([]);

    updateTransformPanelState();

    if (selectionInfo) selectionInfo.style.display = 'none';
    updateSelectedBounds(); drawSelectionHighlights();
}
