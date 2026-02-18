import {
    State, signaturePad, history, redoStack, setSelectedIndices, setRedoStack, setThickness, setLastColor,
    sctx, selectionCanvas, setStrokeType, ratio, setClipboardStrokes, canvas, container, colorLayer, CANVAS_MARGIN,
    setExportClipOutOfBounds, setUniform, setSmoothing, setColorQuality, ctx
} from '@/scripts/state';
import { updateSelectedBounds, syncControlsWithSelection, updateTransformPanelState, updateSelectionInfo } from '@/scripts/ui_updates';
import { i18n, createIcons } from '@/scripts/data';
import { currentCanvasBorderStyle, currentRadiusUnit, updateExportDpi, updateExportQuality } from '@/scripts/main';
import { AdvancedStrokeRenderer } from '@/scripts/advanced-renderer';

export function updateHintVisibility(forceHide = false) {
    const hintEl = document.getElementById('canvasHint');
    if (!hintEl || !signaturePad) return;

    // Check both isEmpty() and data length for absolute certainty
    const hasStrokes = !signaturePad.isEmpty() || signaturePad.toData().length > 0;

    // Only show hint in draw mode and when truly empty
    const shouldShow = !forceHide && State.currentMode === 'draw' && !hasStrokes;

    if (shouldShow) {
        hintEl.style.display = 'block';
        hintEl.classList.remove('hidden');
    } else {
        hintEl.style.display = 'none';
        hintEl.classList.add('hidden');
    }
}

export function saveState() {
    const data = JSON.parse(JSON.stringify(signaturePad.toData()));
    const selection = [...State.selectedStrokeIndices];
    history.push({ data, selection });
    setRedoStack([]);
    if (history.length > 50) history.shift();
    updateHistoryButtons();
}

export function undo() {
    if (history.length > 0) {
        const currentData = JSON.parse(JSON.stringify(signaturePad.toData()));
        const currentSelection = [...State.selectedStrokeIndices];
        redoStack.push({ data: currentData, selection: currentSelection });

        const lastState = history.pop()!;
        signaturePad.fromData(lastState.data);
        setSelectedIndices(lastState.selection || []);

        updateHintVisibility();

        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateTransformPanelState();
        updateHistoryButtons();
        updateStrokePreview();
        updateSelectionInfo();
    }
}

export function redo() {
    if (redoStack.length > 0) {
        const currentData = JSON.parse(JSON.stringify(signaturePad.toData()));
        const currentSelection = [...State.selectedStrokeIndices];
        history.push({ data: currentData, selection: currentSelection });

        const nextState = redoStack.pop()!;
        signaturePad.fromData(nextState.data);
        setSelectedIndices(nextState.selection || []);

        updateHintVisibility();
        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateTransformPanelState();
        updateHistoryButtons();
        updateStrokePreview();
        updateSelectionInfo();
    }
}

export function updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
    const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = history.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

export function updateThickness(newVal: string | number) {
    const val = typeof newVal === 'string' ? parseFloat(newVal) : newVal;
    const finalVal = Math.max(0.1, Math.min(20, parseFloat(val.toFixed(1))));
    setThickness(finalVal);

    const thicknessValEl = document.getElementById('thicknessVal') as HTMLInputElement;
    const thicknessSliderEl = document.getElementById('thicknessSlider') as HTMLInputElement;
    if (thicknessValEl) thicknessValEl.value = finalVal.toString();
    if (thicknessSliderEl) thicknessSliderEl.value = finalVal.toString();

    const data = signaturePad.toData();
    if (State.selectedStrokeIndices.length > 0) {
        saveState();
        State.selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                // Use the individual stroke as context to keep its relative variety
                const currentAvg = (data[index].maxWidth + data[index].minWidth) / 2;
                const scale = finalVal / (currentAvg || 1);

                data[index].minWidth *= scale;
                data[index].maxWidth *= scale;
            }
        });
        safeFromData(data);
        drawSelectionHighlights();
    } else {
        updateStrokeStyles();
    }
    updateStrokePreview();
}

function getThicknessRange(type: string, baseThickness: number) {
    if (State.isUniform) {
        return { min: baseThickness, max: baseThickness };
    }

    // Calibrated ranges to maintain a perfect 1.0 average perceived weight
    switch (type) {
        case 'marker':
            return { min: baseThickness * 0.9, max: baseThickness * 1.1 };
        case 'pen':
            return { min: baseThickness * 0.6, max: baseThickness * 1.4 };
        case 'brush':
            return { min: baseThickness * 0.2, max: baseThickness * 1.8 };
        case 'fine':
            return { min: baseThickness * 0.95, max: baseThickness * 1.05 };
        case 'natural':
        default:
            return { min: baseThickness * 0.5, max: baseThickness * 1.5 };
    }
}

export function safeFromData(data: any[]) {
    if (!signaturePad) return;

    const oldDist = signaturePad.minDistance;
    const oldThrottle = signaturePad.throttle;

    signaturePad.minDistance = 0;
    signaturePad.throttle = 0;

    // Use AdvancedStrokeRenderer for high-quality, dot-free rendering on main canvas
    signaturePad.clear(); // This is the patched clear that also cleans sctx and physical canvas

    // Use the ctx from state, which is already configured with margin in resizeCanvas
    const advancedRenderer = new AdvancedStrokeRenderer(ctx, ratio);
    data.forEach(stroke => {
        const s = stroke as any;
        advancedRenderer.renderStroke(stroke, s.strokeType || State.currentStrokeType);
    });

    // We still update signaturePad's internal data so undo/redo works
    (signaturePad as any)._data = JSON.parse(JSON.stringify(data));

    signaturePad.minDistance = oldDist;
    signaturePad.throttle = oldThrottle;

    // Reapply current stroke type settings (for future drawing)
    updateStrokeStyles();
}

export function updateStrokeStyles() {
    const widths = getThicknessRange(State.currentStrokeType, State.currentThickness);
    signaturePad.minWidth = widths.min;
    signaturePad.maxWidth = widths.max;

    // Advanced smoothing based on user preference
    const baseWeight = 0.05 + (State.smoothing * 0.9); // 0.05 to 0.95
    const baseDistance = 0.1 + (State.smoothing * 5.9); // 0.1 to 6.0

    // Type-specific adjustments for optimal quality
    let velocityWeight = baseWeight;
    let minDistance = baseDistance;

    switch (State.currentStrokeType) {
        case 'marker':
            // Sharp, precise, minimal smoothing
            velocityWeight = Math.min(baseWeight, 0.3);
            minDistance = Math.min(baseDistance, 0.8);
            signaturePad.velocityFilterWeight = velocityWeight;
            signaturePad.minDistance = minDistance;
            break;

        case 'pen':
            // Smooth ballpoint feel
            velocityWeight = 0.4 + (State.smoothing * 0.5); // 0.4 to 0.9
            minDistance = 0.5 + (State.smoothing * 2.5); // 0.5 to 3.0
            signaturePad.velocityFilterWeight = velocityWeight;
            signaturePad.minDistance = minDistance;
            break;

        case 'brush':
            // Organic, flowing, highly responsive
            velocityWeight = 0.7 + (State.smoothing * 0.25); // 0.7 to 0.95
            minDistance = 1.0 + (State.smoothing * 4.0); // 1.0 to 5.0
            signaturePad.velocityFilterWeight = velocityWeight;
            signaturePad.minDistance = minDistance;
            break;

        case 'fine':
            // Ultra-precise, minimal filtering
            velocityWeight = Math.min(baseWeight, 0.2);
            minDistance = Math.min(baseDistance, 0.5);
            signaturePad.velocityFilterWeight = velocityWeight;
            signaturePad.minDistance = minDistance;
            break;

        case 'natural':
        default:
            // Natural handwriting
            velocityWeight = 0.5 + (State.smoothing * 0.4); // 0.5 to 0.9
            minDistance = 0.8 + (State.smoothing * 3.2); // 0.8 to 4.0
            signaturePad.velocityFilterWeight = velocityWeight;
            signaturePad.minDistance = minDistance;
            break;
    }

    const ctx = (signaturePad as any)._ctx as CanvasRenderingContext2D;
    if (ctx) {
        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Type-specific rendering
        switch (State.currentStrokeType) {
            case 'marker':
                // Sharp, technical
                ctx.lineJoin = 'miter';
                ctx.lineCap = 'square';
                ctx.miterLimit = 10;
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
                break;

            case 'pen':
                // Smooth ballpoint with subtle depth
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                if (State.colorQuality > 1.05) {
                    ctx.shadowBlur = (State.colorQuality - 1.0) * 2;
                    ctx.shadowColor = signaturePad.penColor;
                } else {
                    ctx.shadowBlur = 0.5;
                    ctx.shadowColor = signaturePad.penColor;
                }
                break;

            case 'brush':
                // Organic, textured appearance
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                if (State.colorQuality > 1.05) {
                    ctx.shadowBlur = (State.colorQuality - 1.0) * 5;
                    ctx.shadowColor = signaturePad.penColor;
                } else {
                    ctx.shadowBlur = 1.5;
                    ctx.shadowColor = signaturePad.penColor;
                }
                // Slightly transparent for layering effect
                ctx.globalAlpha = 0.95;
                break;

            case 'fine':
                // Ultra-crisp, no effects
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
                ctx.globalAlpha = 1.0;
                break;

            case 'natural':
            default:
                // Natural handwriting
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                if (State.colorQuality > 1.05) {
                    ctx.shadowBlur = (State.colorQuality - 1.0) * 3;
                    ctx.shadowColor = signaturePad.penColor;
                } else {
                    ctx.shadowBlur = 0.3;
                    ctx.shadowColor = signaturePad.penColor;
                }
                ctx.globalAlpha = 1.0;
                break;
        }
    }
    updateStrokePreview();
}

export function updateUniform(checked: boolean) {
    setUniform(checked);
    if (State.selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        State.selectedStrokeIndices.forEach(index => {
            const s = data[index] as any;
            if (s) {
                const base = (s.maxWidth + s.minWidth) / 2 || State.currentThickness;
                const widths = getThicknessRange(State.currentStrokeType, base);
                s.minWidth = widths.min;
                s.maxWidth = widths.max;
                // Preserve or update stroke type
                if (!s.strokeType) s.strokeType = State.currentStrokeType;
            }
        });
        safeFromData(data);
        drawSelectionHighlights();
    } else {
        updateStrokeStyles();
    }
}

export function updateSmoothing(val: number) {
    setSmoothing(val);
    const smoothingValEl = document.getElementById('smoothingVal');
    if (smoothingValEl) smoothingValEl.textContent = `${Math.round(val * 100)}%`;
    updateStrokeStyles();
}

export function updateColorQuality(val: number) {
    setColorQuality(val);
    const qualityValEl = document.getElementById('colorQualityVal');
    if (qualityValEl) qualityValEl.textContent = `${Math.round(val * 100)}%`;
    updateStrokeStyles();
}

export function applyStrokeType(type: string) {
    setStrokeType(type);
    if (State.selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        State.selectedStrokeIndices.forEach(index => {
            const s = data[index] as any;
            if (s) {
                const base = (s.maxWidth + s.minWidth) / 2 || State.currentThickness;
                const widths = getThicknessRange(type, base);
                s.minWidth = widths.min;
                s.maxWidth = widths.max;
                s.strokeType = type;
            }
        });
        safeFromData(data);
        drawSelectionHighlights();
    } else {
        updateStrokeStyles();
    }
    updateStrokePreview();
}

export function hexToRgba(hex: string, alpha: number) {
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

export function applyColor(colorHex: string) {
    if (!colorHex) return;
    setLastColor(colorHex);
    const finalColor = hexToRgba(colorHex, State.currentAlpha);
    signaturePad.penColor = finalColor;

    if (State.selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        State.selectedStrokeIndices.forEach(index => {
            if (data[index]) data[index].penColor = finalColor;
        });
        safeFromData(data);
    }

    updateSelectedBounds();
    drawSelectionHighlights();
    updateStrokePreview();
}

export function drawSelectionHighlights(customData: any = null) {
    if (!sctx || !selectionCanvas) return;

    // Reset transform to clear exactly what's on the physical canvas
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);

    const mode = State.currentMode;
    if (State.selectedStrokeIndices.length === 0 || (mode !== 'select' && mode !== 'transform')) return;

    // Restore scale and offset for drawing highlights
    const effectiveScale = ratio;
    sctx.setTransform(effectiveScale, 0, 0, effectiveScale, CANVAS_MARGIN * effectiveScale, CANVAS_MARGIN * effectiveScale);

    // Use customData if provided (for real-time transform preview)
    const data = customData || signaturePad.toData();
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';

    const zoomScale = State.workspaceScale;

    State.selectedStrokeIndices.forEach(idx => {
        const stroke = data[idx];
        if (!stroke || stroke.points.length < 2) return;

        sctx.beginPath();
        if (stroke.points.length > 2) {
            sctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length - 2; i++) {
                const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
                const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
                sctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
            }
            sctx.quadraticCurveTo(
                stroke.points[stroke.points.length - 2].x,
                stroke.points[stroke.points.length - 2].y,
                stroke.points[stroke.points.length - 1].x,
                stroke.points[stroke.points.length - 1].y
            );
        } else {
            sctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            sctx.lineTo(stroke.points[1].x, stroke.points[1].y);
        }

        // Outer Glow/Halo
        const haloWidth = stroke.maxWidth + (12 / zoomScale);
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
        sctx.lineWidth = haloWidth;
        sctx.lineCap = 'round';
        sctx.stroke();
    });
}

export function updateStrokePreview() {
    const previewCanvas = document.getElementById('strokePreviewCanvas') as HTMLCanvasElement;
    if (!previewCanvas || previewCanvas.offsetParent === null) return;
    const pctx = previewCanvas.getContext('2d');
    if (!pctx) return;

    const w = previewCanvas.clientWidth;
    const h = previewCanvas.clientHeight;
    previewCanvas.width = w * ratio;
    previewCanvas.height = h * ratio;
    pctx.scale(ratio, ratio);

    pctx.clearRect(0, 0, w, h);
    const color = hexToRgba(State.lastBaseColor, State.currentAlpha);
    pctx.strokeStyle = color;
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    pctx.shadowBlur = 0;
    pctx.shadowColor = 'transparent';

    // Apply specific styles for differentiation in preview
    switch (State.currentStrokeType) {
        case 'marker':
            pctx.lineJoin = 'miter';
            break;
        case 'brush':
            pctx.shadowBlur = 0.5;
            pctx.shadowColor = color;
            break;
    }

    const centerY = h / 2;
    const startX = w * 0.15;
    const endX = w * 0.85;

    const range = getThicknessRange(State.currentStrokeType, State.currentThickness);
    const minW = range.min;
    const maxW = range.max;

    const points = 40;
    pctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const t = i / points;
        const x = startX + (endX - startX) * t;
        const angle = t * Math.PI;
        const swing = Math.sin(angle * 2) * (h * 0.2);
        const y = centerY + swing;

        const pressure = 0.3 + Math.sin(t * Math.PI) * 0.7;
        const currentW = minW + (maxW - minW) * pressure;

        if (i === 0) {
            pctx.moveTo(x, y);
        } else {
            const prevT = (i - 1) / points;
            const prevX = startX + (endX - startX) * prevT;
            const prevSwing = Math.sin(prevT * Math.PI * 2) * (h * 0.2);
            const prevY = centerY + prevSwing;

            pctx.beginPath();
            pctx.moveTo(prevX, prevY);
            pctx.lineTo(x, y);
            pctx.lineWidth = currentW;
            pctx.stroke();
        }
    }
}

// --- Export & Toast Logic from original canvas.js ---

export function showToast(message: string, color = "#10b981") {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = color;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function getExportCanvas() {
    if (!canvas || !container) return canvas || document.createElement('canvas');

    // 1. Core State & Dimensions
    const rect = container.getBoundingClientRect();
    const baseW = rect.width || container.clientWidth || 836;
    const baseH = rect.height || container.clientHeight || 400;
    const margin = State.exportMargin || 0;
    const extraScale = State.exportScale || 1;

    // 2. Determine Base Scale from Preset
    let baseScale = 1;
    if (State.exportPreset === 'HD') {
        baseScale = 1280 / baseW;
    } else if (State.exportPreset === 'FHD') {
        baseScale = 1920 / baseW;
    } else if (State.exportPreset === '4K') {
        baseScale = 3840 / baseW;
    } else if (State.exportPreset === 'CUSTOM') {
        baseScale = State.exportDpi / 96;
    } else {
        baseScale = 1; // DEFAULT
    }

    // Physical Pixel Dimensions
    const pixelWidth = Math.round(baseW * baseScale * extraScale);
    const pixelHeight = Math.round(baseH * baseScale * extraScale);

    // 3. Transformation Calculations
    // Available space inside the target box (at baseScale)
    const availW = Math.max(1, (baseW * baseScale) - (margin * 2));
    const availH = Math.max(1, (baseH * baseScale) - (margin * 2));

    const data = signaturePad.toData();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (data.length > 0) {
        data.forEach(s => s.points.forEach((p: any) => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }));
    } else {
        minX = 0; minY = 0; maxX = 0; maxY = 0;
    }

    let contentW: number, contentH: number;
    let baseMinX: number, baseMinY: number;

    if (State.exportClipOutOfBounds) {
        contentW = baseW;
        contentH = baseH;
        baseMinX = 0;
        baseMinY = 0;
    } else {
        const unionMinX = Math.min(0, minX);
        const unionMinY = Math.min(0, minY);
        const unionMaxX = Math.max(baseW, maxX);
        const unionMaxY = Math.max(baseH, maxY);
        contentW = Math.max(1, unionMaxX - unionMinX);
        contentH = Math.max(1, unionMaxY - unionMinY);
        baseMinX = unionMinX;
        baseMinY = unionMinY;
    }

    const fitScale = Math.min(availW / contentW, availH / contentH);
    const shiftX = margin + (availW - contentW * fitScale) / 2;
    const shiftY = margin + (availH - contentH * fitScale) / 2;

    const renderScale = extraScale;

    // 4. Create & Prepare Canvas
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = pixelWidth;
    exportCanvas.height = pixelHeight;
    const ectx = exportCanvas.getContext("2d");
    if (!ectx) return canvas;

    ectx.imageSmoothingEnabled = true;
    ectx.imageSmoothingQuality = 'high';

    // 5. Background & Border (Strokes come after in temp pad)
    const bgColor = colorLayer?.style.backgroundColor || 'transparent';
    const isTransparent = !bgColor || bgColor === 'transparent' || bgColor.includes('rgba(0, 0, 0, 0)');
    const radiusRaw = parseFloat((document.getElementById('radiusSlider') as HTMLInputElement)?.value || "0");
    const radius = State.exportPreset === 'HD' || State.exportPreset === 'FHD' || State.exportPreset === '4K' || State.exportPreset === 'CUSTOM'
        ? (radiusRaw / 100) * Math.min(baseW * baseScale, baseH * baseScale)
        : (currentRadiusUnit === '%' ? (radiusRaw / 100) * Math.min(baseW, baseH) : radiusRaw);

    if (!isTransparent) {
        ectx.fillStyle = bgColor;
        fillRoundedRect(ectx, 0, 0, pixelWidth, pixelHeight, radius * renderScale);
    }

    // 6. Draw Strokes
    if (data.length > 0) {
        const totalContentScale = fitScale * renderScale;
        const scaledData = data.map(stroke => {
            if (!stroke) return stroke;
            const clone = JSON.parse(JSON.stringify(stroke));
            if (clone.minWidth !== undefined) clone.minWidth *= totalContentScale;
            if (clone.maxWidth !== undefined) clone.maxWidth *= totalContentScale;
            if (clone.points) {
                clone.points.forEach((p: any) => {
                    p.x = ((p.x - baseMinX) * fitScale + shiftX) * renderScale;
                    p.y = ((p.y - baseMinY) * fitScale + shiftY) * renderScale;
                });
            }
            return clone;
        });

        // Use AdvancedStrokeRenderer instead of SignaturePad for high-quality export
        const advancedRenderer = new AdvancedStrokeRenderer(ectx, 1);

        scaledData.forEach(stroke => {
            // Ensure stroke has points
            if (!stroke || !stroke.points || stroke.points.length === 0) return;

            // Use current stroke type for rendering style, or fallback to 'natural'
            // Use the specific stroke type if it exists, otherwise use current global
            const s = stroke as any;
            advancedRenderer.renderStroke(stroke, s.strokeType || State.currentStrokeType);
        });
    }

    // 7. Draw Borders
    const borderWidthSlider = document.getElementById('borderWidthSlider') as HTMLInputElement;
    const borderWidth = parseFloat(borderWidthSlider?.value || "0");
    if (borderWidth > 0 && currentCanvasBorderStyle !== 'none') {
        const sw = borderWidth * baseScale * renderScale;
        const inset = sw / 2;
        ectx.lineWidth = sw;
        ectx.strokeStyle = container.style.borderColor || "rgba(255, 255, 255, 0.08)";

        const dashSlider = document.getElementById('borderDashSlider') as HTMLInputElement;
        const dash = parseInt(dashSlider?.value || '4') * baseScale * renderScale;
        if (currentCanvasBorderStyle === 'dashed') ectx.setLineDash([dash, dash]);
        else if (currentCanvasBorderStyle === 'dotted') ectx.setLineDash([1, dash]);
        else ectx.setLineDash([]);

        strokeRoundedRect(ectx, inset, inset, pixelWidth - sw, pixelHeight - sw, Math.max(0, radius * renderScale - inset));
    }

    return exportCanvas;
}

export function downloadPng() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    const exportCanvas = getExportCanvas();
    const dataURL = exportCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    showToast(i18n[State.currentLang as keyof typeof i18n].toastPngDownloaded);
}

export function getExportSvg(): string {
    if (!signaturePad || !container) return "";

    // 1. Core State & Initial Dimensions
    const rect = container.getBoundingClientRect();
    const baseW = rect.width || container.clientWidth || 836;
    const baseH = rect.height || container.clientHeight || 400;
    const extraScale = State.exportScale || 1;
    const margin = State.exportMargin || 0;

    // 2. Determine Base Scale from Preset
    let baseScale = 1;
    if (State.exportPreset === 'HD') {
        baseScale = 1280 / baseW;
    } else if (State.exportPreset === 'FHD') {
        baseScale = 1920 / baseW;
    } else if (State.exportPreset === '4K') {
        baseScale = 3840 / baseW;
    } else if (State.exportPreset === 'CUSTOM') {
        baseScale = State.exportDpi / 96;
    } else {
        baseScale = 2; // DEFAULT (Increased to 2x for better quality)
    }

    const totalScale = baseScale * extraScale;
    const svgW = Math.round(baseW * totalScale);
    const svgH = Math.round(baseH * totalScale);

    // 2. Calculate Content Bounds
    const data = signaturePad.toData();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (data.length > 0) {
        data.forEach(s => s.points.forEach((p: any) => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }));
    } else {
        minX = 0; minY = 0; maxX = 0; maxY = 0;
    }

    // 3. Transformation Calculations
    const availW = Math.max(1, (baseW * baseScale) - (margin * 2));
    const availH = Math.max(1, (baseH * baseScale) - (margin * 2));

    let contentW: number, contentH: number;
    let baseMinX: number, baseMinY: number;

    if (State.exportClipOutOfBounds) {
        contentW = baseW;
        contentH = baseH;
        baseMinX = 0;
        baseMinY = 0;
    } else {
        const unionMinX = Math.min(0, minX);
        const unionMinY = Math.min(0, minY);
        const unionMaxX = Math.max(baseW, maxX);
        const unionMaxY = Math.max(baseH, maxY);
        contentW = Math.max(1, unionMaxX - unionMinX);
        contentH = Math.max(1, unionMaxY - unionMinY);
        baseMinX = unionMinX;
        baseMinY = unionMinY;
    }

    const fitScale = Math.min(availW / contentW, availH / contentH);
    const shiftX = margin + (availW - contentW * fitScale) / 2;
    const shiftY = margin + (availH - contentH * fitScale) / 2;

    const renderScale = extraScale;

    // 4. SVG Generation
    const computedStyle = colorLayer ? window.getComputedStyle(colorLayer) : window.getComputedStyle(container);
    const bgColor = colorLayer?.style.backgroundColor || computedStyle.backgroundColor || "transparent";
    const isTransparent = !bgColor || bgColor === 'transparent' || bgColor.includes('rgba(0, 0, 0, 0)');
    const radiusRaw = parseFloat((document.getElementById('radiusSlider') as HTMLInputElement)?.value || '0');
    const radius = State.exportPreset === 'HD' || State.exportPreset === 'FHD' || State.exportPreset === '4K' || State.exportPreset === 'CUSTOM'
        ? (radiusRaw / 100) * Math.min(baseW * baseScale, baseH * baseScale)
        : (currentRadiusUnit === '%' ? (radiusRaw / 100) * Math.min(baseW, baseH) : radiusRaw);

    const borderWidth = parseFloat((document.getElementById('borderWidthSlider') as HTMLInputElement)?.value || '0');
    const bColor = container.style.borderColor || computedStyle.borderColor || "rgba(255, 255, 255, 0.08)";
    const bStyle = currentCanvasBorderStyle;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${baseW * baseScale * renderScale} ${baseH * baseScale * renderScale}">`;

    // Background
    if (!isTransparent) {
        svg += `<rect x="0" y="0" width="${baseW * baseScale * renderScale}" height="${baseH * baseScale * renderScale}" fill="${bgColor}" rx="${radius * renderScale}" ry="${radius * renderScale}"/>`;
    }

    // Strokes Container (with clipping if needed)
    if (State.exportClipOutOfBounds) {
        const clipId = `clip-${Date.now()}`;
        svg += `<defs><clipPath id="${clipId}"><rect x="${shiftX * renderScale}" y="${shiftY * renderScale}" width="${baseW * fitScale * renderScale}" height="${baseH * fitScale * renderScale}"/></clipPath></defs>`;
        svg += `<g clip-path="url(#${clipId})">`;
    } else {
        svg += `<g>`;
    }

    // Draw paths...
    if (data.length > 0) {
        // Create a dummy renderer instance just to access the path generation logic
        // We cast {} as Context because getSVGPath doesn't use the context
        const renderer = new AdvancedStrokeRenderer({} as CanvasRenderingContext2D, 1);

        data.forEach((stroke) => {
            if (!stroke || !stroke.points || stroke.points.length < 2) return;
            const strokeColor = (stroke as any).penColor || (stroke as any).color || "#000";
            const points = stroke.points.map((p: any) => ({
                x: ((p.x - baseMinX) * fitScale + shiftX) * renderScale,
                y: ((p.y - baseMinY) * fitScale + shiftY) * renderScale,
                pressure: p.pressure, // Preserve pressure if needed, though SVG path is uniform width usually
                time: p.time
            }));

            // Use AdvancedStrokeRenderer to generate smooth cubic Bezier path
            const d = renderer.getSVGPath(points);

            if (d) {
                const sw = (stroke.maxWidth || 2.5) * fitScale * renderScale;
                // Note: SVG path with uniform stroke width doesn't capture variable width (pressure) perfectly
                // unless we render it as a filled shape (like the canvas renderer does).
                // For now, we improve the curve quality.
                svg += `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
            }
        });
    }

    svg += `</g>`;

    // Border
    if (borderWidth > 0 && bStyle !== 'none') {
        const sw = borderWidth * baseScale * renderScale;
        const inset = sw / 2;
        const dashSlider = document.getElementById('borderDashSlider') as HTMLInputElement;
        const dash = parseInt(dashSlider?.value || '4') * baseScale * renderScale;
        let dashAttr = "";
        if (bStyle === 'dashed') dashAttr = `stroke-dasharray="${dash},${dash}"`;
        else if (bStyle === 'dotted') dashAttr = `stroke-dasharray="1,${dash}"`;

        svg += `<rect x="${inset}" y="${inset}" width="${(baseW * baseScale * renderScale) - sw}" height="${(baseH * baseScale * renderScale) - sw}" fill="none" stroke="${bColor}" stroke-width="${sw}" rx="${Math.max(0, radius * renderScale - inset)}" ry="${Math.max(0, radius * renderScale - inset)}" ${dashAttr}/>`;
    }

    svg += `</svg>`;
    return svg;
}


export function downloadJpg() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    const exportCanvas = getExportCanvas();
    const dataURL = exportCanvas.toDataURL("image/jpeg", State.exportQuality);
    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.jpg`;
    link.href = dataURL;
    link.click();
    showToast(i18n[State.currentLang as keyof typeof i18n].toastJpgDownloaded);
}

export function downloadWebp() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    const exportCanvas = getExportCanvas();
    const dataURL = exportCanvas.toDataURL("image/webp", State.exportQuality);
    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.webp`;
    link.href = dataURL;
    link.click();
    showToast(i18n[State.currentLang as keyof typeof i18n].toastWebpDownloaded);
}

export async function copyJpgBase64() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const exportCanvas = getExportCanvas();
        const dataURL = exportCanvas.toDataURL("image/jpeg", State.exportQuality);
        await navigator.clipboard.writeText(dataURL);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastJpgCopied);
    } catch (err) {
        console.error(err);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastError, "#ef4444");
    }
}

export async function copyWebpBase64() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const exportCanvas = getExportCanvas();
        const dataURL = exportCanvas.toDataURL("image/webp", State.exportQuality);
        await navigator.clipboard.writeText(dataURL);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastWebpCopied);
    } catch (err) {
        console.error(err);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastError, "#ef4444");
    }
}

export function downloadSvg() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }

    const wrappedSvg = getExportSvg();
    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.svg`;
    link.href = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(wrappedSvg)));
    showToast(i18n[State.currentLang as keyof typeof i18n].toastSvgDownloaded);
}

// --- BMP ENCODER ---
function encodeBMP(canvas: HTMLCanvasElement): Blob {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // BMP padding (rows must be multiple of 4 bytes)
    const rowBytes = width * 3;
    const padding = (4 - (rowBytes % 4)) % 4;
    const stride = rowBytes + padding;

    const fileSize = 54 + (stride * height);
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // File Header (14 bytes)
    view.setUint16(0, 0x4D42, true); // BM
    view.setUint32(2, fileSize, true); // File size
    view.setUint32(6, 0, true); // Reserved
    view.setUint32(10, 54, true); // Offset to pixel data

    // DIB Header (40 bytes - BITMAPINFOHEADER)
    view.setUint32(14, 40, true); // Header size
    view.setInt32(18, width, true); // Width
    view.setInt32(22, height, true); // Height (bottom-up if positive, but we write bottom-up)
    view.setUint16(26, 1, true); // Planes
    view.setUint16(28, 24, true); // BPP (24-bit)
    view.setUint32(30, 0, true); // Compression (BI_RGB)
    view.setUint32(34, stride * height, true); // Image size
    view.setInt32(38, 2835, true); // X PPM (~72 DPI)
    view.setInt32(42, 2835, true); // Y PPM
    view.setUint32(46, 0, true); // Colors used
    view.setUint32(50, 0, true); // Important colors

    // Pixel Data (Bottom-Up, BGR)
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // BGRA input -> BGR output
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Alpha is ignored in 24-bit BMP. 
            // Composite against white if transparent?
            // Since we grabbed raw data, it's premultiplied or just values.
            // Let's assume standard compositing for simplicity or just dump RGB.
            // If alpha is 0, it's black. Ideally we should composite over white.
            const a = data[i + 3] / 255;

            // Composite over white (assuming bg is white for BMP export)
            // out = src * a + dst * (1 - a)
            const outR = r * a + 255 * (1 - a);
            const outG = g * a + 255 * (1 - a);
            const outB = b * a + 255 * (1 - a);

            view.setUint8(offset++, outB);
            view.setUint8(offset++, outG);
            view.setUint8(offset++, outR);
        }
        // Padding
        for (let p = 0; p < padding; p++) {
            view.setUint8(offset++, 0);
        }
    }

    return new Blob([buffer], { type: "image/bmp" });
}

export function downloadBmp() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const exportCanvas = getExportCanvas();
        // Try native first (Chrome)
        // Check if browser supports image/bmp
        const dataUrl = exportCanvas.toDataURL("image/bmp");
        if (dataUrl.startsWith("data:image/bmp")) {
            const link = document.createElement("a");
            link.download = `firma-${Date.now()}.bmp`;
            link.href = dataUrl;
            link.click();
            showToast("Descargado como BMP");
            return;
        }

        // Fallback to manual encoding
        const blob = encodeBMP(exportCanvas);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `firma-${Date.now()}.bmp`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast("Descargado como BMP");
    } catch (e) {
        console.error(e);
        showToast("Error exportando BMP", "#ef4444");
    }
}

// --- TIFF ENCODER ---
function encodeTIFF(canvas: HTMLCanvasElement): Blob {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Structure:
    // Header (8 bytes)
    // Image Data (RGB)
    // IFD (12 bytes * numTags + 2 + 4)
    // Values for IFD tags (Resolution etc)

    const numTags = 12;
    // const headerSize = 8;
    const ifdSize = 2 + (numTags * 12) + 4;
    const pixelDataSize = width * height * 3;

    // We'll put pixels after the header/IFD/values to keep offsets simple?
    // Actually, usually Header -> IFD -> Values -> Pixels is cleaner or Header -> Pixels -> IFD.
    // Let's do Header -> IFD -> Values -> Pixels.

    // Resolution values (2 * 8 bytes = 16 bytes)
    // BitsPerSample (3 * 2 bytes = 6 bytes)
    // StripOffsets (4 bytes, but can fit in tag if small... wait, it points to data)
    // StripByteCounts (4 bytes)
    // XResolution/YResolution point to rationals (2 ulongs each).

    // const valuesSize = 16 + 6; // Approx

    // Let's use a simpler layout:
    // Header (8)
    // IFD (2 + 12*12 + 4 = 150)
    // Extra Data (Resolution Rationals (16), BitsPerSample (6))
    // Image Data

    const offsetIfd = 8;
    const offsetExtra = offsetIfd + ifdSize;
    const offsetAttribs = offsetExtra; // Start of extra data

    const resolutionOffset = offsetAttribs;
    const bitsPerSampleOffset = resolutionOffset + 16;

    const offsetData = bitsPerSampleOffset + 6; // Start of pixel pixels
    // Align data to word boundary if needed (TIFF likes word alignment)
    // offsetData should be even.

    const fileSize = offsetData + pixelDataSize;
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // Header
    view.setUint16(0, 0x4949, true); // II (Little Endian)
    view.setUint16(2, 42, true);     // Magic
    view.setUint32(4, offsetIfd, true); // Offset to IFD

    // IFD
    let ifdPtr = offsetIfd;
    view.setUint16(ifdPtr, numTags, true); ifdPtr += 2;

    const writeTag = (tag: number, type: number, count: number, valueOrOffset: number) => {
        view.setUint16(ifdPtr, tag, true);
        view.setUint16(ifdPtr + 2, type, true);
        view.setUint32(ifdPtr + 4, count, true);
        view.setUint32(ifdPtr + 8, valueOrOffset, true);
        ifdPtr += 12;
    };

    // 256: ImageWidth (Short/Long)
    writeTag(256, 4, 1, width);
    // 257: ImageLength (Short/Long)
    writeTag(257, 4, 1, height);
    // 258: BitsPerSample (Short, count 3) -> Offset
    writeTag(258, 3, 3, bitsPerSampleOffset);
    // 259: Compression (Short) 1 = None
    writeTag(259, 3, 1, 1);
    // 262: PhotometricInterpretation (Short) 2 = RGB
    writeTag(262, 3, 1, 2);
    // 273: StripOffsets (Long) -> PixelData
    writeTag(273, 4, 1, offsetData);
    // 277: SamplesPerPixel (Short) 3
    writeTag(277, 3, 1, 3);
    // 278: RowsPerStrip (Long) -> Height (1 strip)
    writeTag(278, 4, 1, height);
    // 279: StripByteCounts (Long)
    writeTag(279, 4, 1, pixelDataSize);
    // 282: XResolution (Rational) -> Offset
    writeTag(282, 5, 1, resolutionOffset);
    // 283: YResolution (Rational) -> Offset
    writeTag(283, 5, 1, resolutionOffset + 8);
    // 296: ResolutionUnit (Short) 2 = Inch
    writeTag(296, 3, 1, 2);

    // Next IFD Offset (0)
    view.setUint32(ifdPtr, 0, true);

    // Write Extra Data
    // Resolution (72/1)
    view.setUint32(resolutionOffset, 72, true);
    view.setUint32(resolutionOffset + 4, 1, true);
    view.setUint32(resolutionOffset + 8, 72, true);
    view.setUint32(resolutionOffset + 12, 1, true);

    // BitsPerSample (8, 8, 8)
    view.setUint16(bitsPerSampleOffset, 8, true);
    view.setUint16(bitsPerSampleOffset + 2, 8, true);
    view.setUint16(bitsPerSampleOffset + 4, 8, true);

    // Write Pixels (RGB)
    let pxPtr = offsetData;
    for (let i = 0; i < pixelDataSize / 3; i++) {
        // RGBA -> RGB
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3] / 255;

        // Composite
        const outR = r * a + 255 * (1 - a);
        const outG = g * a + 255 * (1 - a);
        const outB = b * a + 255 * (1 - a);

        view.setUint8(pxPtr++, outR);
        view.setUint8(pxPtr++, outG);
        view.setUint8(pxPtr++, outB);
    }

    return new Blob([buffer], { type: "image/tiff" });
}

export function downloadTiff() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const exportCanvas = getExportCanvas();
        const blob = encodeTIFF(exportCanvas);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `firma-${Date.now()}.tiff`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast("Descargado como TIFF");
    } catch (e) {
        console.error(e);
        showToast("Error exportando TIFF", "#ef4444");
    }
}

export function triggerExport() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    openExportModal();
}

function openExportModal() {
    const modal = document.getElementById('exportModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Default Enable "Clip Out Of Bounds" on open
    setExportClipOutOfBounds(true);
    const clipToggle = document.getElementById('modalClipToggle') as HTMLInputElement;
    if (clipToggle) clipToggle.checked = true;

    // Get modal sections for progressive loading
    const previewBox = modal.querySelector('.export-preview-box') as HTMLElement;
    const formatGroup = modal.querySelector('#modalFormatSelector')?.closest('.panel-input-group') as HTMLElement;
    const actionGroup = modal.querySelector('#modalActionSelector')?.closest('.panel-input-group') as HTMLElement;
    const qualityGroup = document.getElementById('modalQualityGroup');
    const dpiGroup = document.getElementById('modalDpiGroup');
    const clipGroup = document.getElementById('modalClipToggle')?.closest('.panel-input-group') as HTMLElement;
    const exportActions = modal.querySelector('.export-actions') as HTMLElement;

    // Hide all sections initially
    if (previewBox) previewBox.style.opacity = '0';
    if (formatGroup) formatGroup.style.opacity = '0';
    if (actionGroup) actionGroup.style.opacity = '0';
    if (qualityGroup) qualityGroup.style.opacity = '0';
    if (dpiGroup) dpiGroup.style.opacity = '0';
    if (clipGroup) clipGroup.style.opacity = '0';
    if (exportActions) exportActions.style.opacity = '0';

    // Sync modal buttons with current state
    document.querySelectorAll('#modalFormatSelector .preset-btn').forEach(btn => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.format === State.exportFormat);
    });
    document.querySelectorAll('#modalActionSelector .preset-btn').forEach(btn => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.action === State.exportAction);
    });

    updateModalContext();
    updateExportQuality(State.exportQuality * 100);
    updateExportDpi(State.exportDpi);
    updateExportPreview();

    // Progressive loading with animations
    setTimeout(() => {
        if (previewBox) {
            previewBox.style.transition = 'opacity 0.3s ease-in';
            previewBox.style.opacity = '1';
        }
    }, 50);

    setTimeout(() => {
        if (formatGroup) {
            formatGroup.style.transition = 'opacity 0.2s ease-in';
            formatGroup.style.opacity = '1';
        }
    }, 150);

    setTimeout(() => {
        if (actionGroup) {
            actionGroup.style.transition = 'opacity 0.2s ease-in';
            actionGroup.style.opacity = '1';
        }
    }, 250);

    setTimeout(() => {
        if (qualityGroup) {
            qualityGroup.style.transition = 'opacity 0.2s ease-in';
            qualityGroup.style.opacity = '1';
        }
    }, 350);

    setTimeout(() => {
        if (dpiGroup) {
            dpiGroup.style.transition = 'opacity 0.2s ease-in';
            dpiGroup.style.opacity = '1';
        }
    }, 450);

    setTimeout(() => {
        if (clipGroup) {
            clipGroup.style.transition = 'opacity 0.2s ease-in';
            clipGroup.style.opacity = '1';
        }
    }, 550);

    setTimeout(() => {
        if (exportActions) {
            exportActions.style.transition = 'opacity 0.2s ease-in';
            exportActions.style.opacity = '1';
        }
    }, 650);
}

export function updateModalContext() {
    const format = State.exportFormat;
    const action = State.exportAction;

    const qualityGroup = document.getElementById('modalQualityGroup');
    if (qualityGroup) {
        qualityGroup.style.display = (format === 'JPG' || format === 'WEBP') ? 'flex' : 'none';
    }

    const finalBtnText = document.getElementById('finalBtnText');
    if (finalBtnText) {
        if (action === 'download') finalBtnText.textContent = i18n[State.currentLang as keyof typeof i18n].confirmExport;
        else finalBtnText.textContent = i18n[State.currentLang as keyof typeof i18n].confirmCopy;
    }
}


export function updateExportPreview() {
    const container = document.getElementById('exportPreviewContainer');
    // Prevent execution if modal is hidden (offsetParent is null when hidden)
    if (!container || container.offsetParent === null) return;

    const format = State.exportFormat;
    const dimEl = document.getElementById('previewDimensions');
    const formatEl = document.getElementById('previewFormat');

    const exportCanvas = getExportCanvas();
    if (dimEl) dimEl.textContent = `${Math.round(exportCanvas.width)} x ${Math.round(exportCanvas.height)} PX`;
    if (formatEl) formatEl.textContent = format;

    container.innerHTML = '';

    if (format === 'SVG') {
        const svg = getExportSvg();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svg;
        container.appendChild(wrapper.firstChild!);
    } else {
        const img = document.createElement('img');
        const mime = format === 'PNG' ? 'image/png' : format === 'JPG' ? 'image/jpeg' : 'image/webp';
        img.src = exportCanvas.toDataURL(mime, State.exportQuality);
        container.appendChild(img);
    }

    createIcons();
}


export async function copyPngToClipboard() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const exportCanvas = getExportCanvas();
        const blob = await new Promise<Blob | null>(res => exportCanvas.toBlob(res, "image/png"));
        if (!blob) throw new Error("Canvas to Blob failed");

        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastPngCopied);
    } catch (err) {
        console.error(err);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastError, "#ef4444");
    }
}

export async function copyPngBase64() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const exportCanvas = getExportCanvas();
        const dataURL = exportCanvas.toDataURL("image/png");
        await navigator.clipboard.writeText(dataURL);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastPngCopied);
    } catch (err) {
        console.error(err);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastError, "#ef4444");
    }
}

export async function copySvgBase64() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const wrappedSvg = getExportSvg();
        const dataURL = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(wrappedSvg)));
        await navigator.clipboard.writeText(dataURL);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSvgCopied);
    } catch (err) {
        console.error(err);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastError, "#ef4444");
    }
}
export function copySelection() {
    if (State.selectedStrokeIndices.length === 0) return;
    const data = signaturePad.toData();
    const strokes = State.selectedStrokeIndices.map(idx => JSON.parse(JSON.stringify(data[idx])));
    setClipboardStrokes(strokes);
    showToast(i18n[State.currentLang as keyof typeof i18n].toastStrokesCopied, "#6366f1");
}

export function pasteSelection() {
    if (State.clipboardStrokes.length === 0) return;
    saveState();
    const data = signaturePad.toData();
    const offset = 20;
    const newStrokes = State.clipboardStrokes.map((s: any) => {
        const clone = JSON.parse(JSON.stringify(s));
        clone.points.forEach((p: any) => { p.x += offset; p.y += offset; });
        return clone;
    });

    // Append new strokes
    const nextData = [...data, ...newStrokes];
    safeFromData(nextData);

    // Select the new strokes
    const newIndices = newStrokes.map((_: any, i: number) => data.length + i);
    setSelectedIndices(newIndices);

    updateSelectedBounds();
    drawSelectionHighlights();
    syncControlsWithSelection();
    updateTransformPanelState();
    updateSelectionInfo();
    updateHintVisibility();

    showToast(i18n[State.currentLang as keyof typeof i18n].toastStrokesPasted, "#6366f1");
}

export function deleteSelection() {
    if (State.selectedStrokeIndices.length === 0) return;
    saveState();
    const data = signaturePad.toData();
    const next = data.filter((_, i) => !State.selectedStrokeIndices.includes(i));
    safeFromData(next);

    setSelectedIndices([]);
    updateSelectedBounds();
    drawSelectionHighlights();
    updateTransformPanelState();
    updateSelectionInfo();
    updateHintVisibility();
}

export function rotateSelection90(dir: 'cw' | 'ccw') {
    if (State.selectedStrokeIndices.length === 0) return;
    saveState();
    const data = signaturePad.toData();

    // Calculate pivot
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    State.selectedStrokeIndices.forEach(idx => {
        data[idx].points.forEach((p: any) => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const angle = dir === 'cw' ? Math.PI / 2 : -Math.PI / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    State.selectedStrokeIndices.forEach(idx => {
        data[idx].points.forEach((p: any) => {
            const rx = p.x - cx, ry = p.y - cy;
            p.x = cx + rx * cos - ry * sin;
            p.y = cy + rx * sin + ry * cos;
        });
    });

    safeFromData(data);
    updateSelectedBounds();
    drawSelectionHighlights();
}

export function flipSelection(axis: 'h' | 'v') {
    if (State.selectedStrokeIndices.length === 0) return;
    saveState();
    const data = signaturePad.toData();

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    State.selectedStrokeIndices.forEach(idx => {
        data[idx].points.forEach((p: any) => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
    });

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    State.selectedStrokeIndices.forEach(idx => {
        data[idx].points.forEach((p: any) => {
            if (axis === 'h') p.x = midX - (p.x - midX);
            else p.y = midY - (p.y - midY);
        });
    });

    safeFromData(data);
    updateSelectedBounds();
    drawSelectionHighlights();
}

export function scaleSelection(factor: number, save = true, baseData: any = null) {
    if (State.selectedStrokeIndices.length === 0) return;
    if (save && !baseData) saveState();

    // If baseData is provided, we use IT as the source truth (for previewing), otherwise we use current data
    const sourceData = baseData ? JSON.parse(JSON.stringify(baseData)) : signaturePad.toData();
    const data = signaturePad.toData(); // Current data we will modify

    // Calculate bounds from SOURCE DATA
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    State.selectedStrokeIndices.forEach(idx => {
        if (sourceData[idx]) {
            sourceData[idx].points.forEach((p: any) => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        }
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    State.selectedStrokeIndices.forEach(idx => {
        if (sourceData[idx] && data[idx]) {
            const srcPoints = sourceData[idx].points;

            const newPoints = srcPoints.map((p: any) => ({
                x: cx + (p.x - cx) * factor,
                y: cy + (p.y - cy) * factor,
                pressure: p.pressure,
                color: p.color
            }));

            data[idx].points = newPoints;
            data[idx].minWidth = sourceData[idx].minWidth * factor;
            data[idx].maxWidth = sourceData[idx].maxWidth * factor;
        }
    });

    safeFromData(data);
    updateSelectedBounds();
    drawSelectionHighlights();
}

function fillRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
}

function strokeRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
}
