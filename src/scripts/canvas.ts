import SignaturePad from 'signature_pad';
import { State, signaturePad, history, redoStack, setSelectedIndices, setRedoStack, setThickness, setLastColor, sctx, selectionCanvas, setStrokeType, ratio, setClipboardStrokes, canvas, container } from '@/scripts/state';
import { updateSelectedBounds, syncControlsWithSelection, updateTransformPanelState } from '@/scripts/ui_updates';
import { i18n } from '@/scripts/data';
import { currentCanvasBorderStyle, currentRadiusUnit } from '@/scripts/main';

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
    switch (type) {
        case 'marker': return { min: baseThickness, max: baseThickness };
        case 'pen': return { min: baseThickness * 0.4, max: baseThickness * 1.6 }; // Avg 1.0
        case 'brush': return { min: baseThickness * 0.2, max: baseThickness * 1.8 }; // Avg 1.0
        case 'fine': return { min: baseThickness * 0.9, max: baseThickness * 1.1 };  // Avg 1.0
        case 'natural':
        default: return { min: baseThickness * 0.7, max: baseThickness * 1.3 };     // Avg 1.0
    }
}

export function safeFromData(data: any[]) {
    if (!signaturePad) return;
    // CRITICAL: Stop signaturePad from filtering points during programmatic redraw
    // If minDistance > 0, fromData will actually DELETE points that are too close,
    // which causes the "change in stroke" reported by the user.
    const oldDist = signaturePad.minDistance;
    const oldThrottle = signaturePad.throttle;

    signaturePad.minDistance = 0;
    signaturePad.throttle = 0;

    signaturePad.fromData(data);

    signaturePad.minDistance = oldDist;
    signaturePad.throttle = oldThrottle;
}

export function updateStrokeStyles() {
    const widths = getThicknessRange(State.currentStrokeType, State.currentThickness);
    signaturePad.minWidth = widths.min;
    signaturePad.maxWidth = widths.max;

    // Use lower values to preserve "vibration" and "sensitivity" as requested.
    // High values (0.7+) were causing the "loss of fidelity" by over-smoothing the user's micro-movements.
    switch (State.currentStrokeType) {
        case 'marker': signaturePad.velocityFilterWeight = 0.05; break;
        case 'pen': signaturePad.velocityFilterWeight = 0.4; break;
        case 'brush': signaturePad.velocityFilterWeight = 0.3; break;
        case 'fine': signaturePad.velocityFilterWeight = 0.1; break;
        case 'natural':
        default: signaturePad.velocityFilterWeight = 0.3; break;
    }
    updateStrokePreview();
}

export function applyStrokeType(type: string) {
    setStrokeType(type);
    if (State.selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        State.selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                // Use the global State.currentThickness as the anchor when changing type
                // This prevents infinite growth and ensures predictable UI behavior.
                const widths = getThicknessRange(type, State.currentThickness);
                data[index].minWidth = widths.min;
                data[index].maxWidth = widths.max;
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

    // Restore scale for drawing highlights
    const effectiveScale = ratio;
    sctx.setTransform(effectiveScale, 0, 0, effectiveScale, 0, 0);

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

        // 1. Outer Glow/Halo (Increased visibility)
        const haloWidth = stroke.maxWidth + (16 / zoomScale);
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        sctx.lineWidth = haloWidth;
        sctx.lineCap = 'round';
        sctx.stroke();

        // 2. Selection border indicator (High contrast central line)
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
        sctx.lineWidth = 1.5 / zoomScale;
        sctx.lineCap = 'round';
        sctx.stroke();
    });
}

export function updateStrokePreview() {
    const previewCanvas = document.getElementById('strokePreviewCanvas') as HTMLCanvasElement;
    if (!previewCanvas) return;
    const pctx = previewCanvas.getContext('2d');
    if (!pctx) return;

    const w = previewCanvas.clientWidth;
    const h = previewCanvas.clientHeight;
    previewCanvas.width = w * ratio;
    previewCanvas.height = h * ratio;
    pctx.scale(ratio, ratio);

    pctx.clearRect(0, 0, w, h);
    pctx.strokeStyle = hexToRgba(State.lastBaseColor, State.currentAlpha);
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';

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

    const mainCanvas = canvas;
    const exportCanvas = document.createElement("canvas");
    const baseWidth = container.clientWidth;
    const baseHeight = container.clientHeight;

    // Match logical dimensions from UI (e.g. 836x400)
    const exportRatio = 1;
    exportCanvas.width = baseWidth;
    exportCanvas.height = baseHeight;

    const ectx = exportCanvas.getContext("2d");
    if (!ectx) return mainCanvas;

    // Enable high-quality smoothing for the export buffer
    ectx.imageSmoothingEnabled = true;
    ectx.imageSmoothingQuality = 'high';

    // Use logical coordinates for all drawing operations
    ectx.save();
    ectx.scale(exportRatio, exportRatio);

    const radiusRaw = parseFloat((document.getElementById('radiusSlider') as HTMLInputElement)?.value || "0");
    const radius = currentRadiusUnit === '%' ? (radiusRaw / 100) * Math.min(baseWidth, baseHeight) : radiusRaw;

    const bgColor = container.style.backgroundColor;
    const isTransparent = !bgColor || bgColor === 'transparent' || bgColor.includes('rgba(0, 0, 0, 0)');

    // 1. Prepare Background & Clipping
    if (radius > 0) {
        ectx.beginPath();
        ectx.roundRect(0, 0, baseWidth, baseHeight, radius);
        if (!isTransparent) {
            ectx.fillStyle = bgColor;
            ectx.fill();
        }
        ectx.clip();
    } else if (!isTransparent) {
        ectx.fillStyle = bgColor;
        ectx.fillRect(0, 0, baseWidth, baseHeight);
    }

    // 2. HD Vector Replay: Instead of copying the screen canvas, we "replay" the signature
    // points on this high-res buffer to get perfect, non-pixelated edges.
    const data = signaturePad.toData();
    if (data.length > 0) {
        // We use a temporary SignaturePad logic on the secondary context
        // to ensure identical curve interpolation but at 8x scale.
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportCanvas.width;
        tempCanvas.height = exportCanvas.height;

        // Use a temporary SignaturePad instance to handle the complex Bézier logic
        const tempPad = new SignaturePad(tempCanvas);

        // Adjust widths for the export scale
        const scaledData = data.map(stroke => {
            const clone = JSON.parse(JSON.stringify(stroke));
            clone.minWidth *= exportRatio;
            clone.maxWidth *= exportRatio;
            clone.points.forEach((p: any) => {
                p.x *= exportRatio;
                p.y *= exportRatio;
            });
            return clone;
        });

        tempPad.fromData(scaledData);

        // Draw the high-res result into our export context
        ectx.drawImage(tempCanvas, 0, 0, baseWidth, baseHeight);
        tempPad.off(); // Cleanup
    }

    // 3. Draw Border
    const borderSlider = document.getElementById('borderWidthSlider') as HTMLInputElement;
    const borderWidth = parseFloat(borderSlider?.value || "0");
    const style = currentCanvasBorderStyle;

    if (borderWidth > 0 && style !== 'none') {
        const computedStyle = window.getComputedStyle(container);
        ectx.strokeStyle = container.style.borderColor || computedStyle.borderColor || "rgba(255, 255, 255, 0.08)";
        ectx.lineWidth = borderWidth;

        const dashVal = parseInt((document.getElementById('borderDashSlider') as HTMLInputElement)?.value || '4');

        if (style === 'dashed') ectx.setLineDash([dashVal, dashVal]);
        else if (style === 'dotted') ectx.setLineDash([1, dashVal]);
        else ectx.setLineDash([]);

        const inset = borderWidth / 2;
        const borderRadius = Math.max(0, radius - inset);

        if (radius > 0) {
            ectx.beginPath();
            ectx.roundRect(inset, inset, baseWidth - borderWidth, baseHeight - borderWidth, borderRadius);
            ectx.stroke();
        } else {
            ectx.strokeRect(inset, inset, baseWidth - borderWidth, baseHeight - borderWidth);
        }
    }

    ectx.restore();
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

export function downloadSvg() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }

    // For SVG, we need to wrap signaturePad's SVG output with our background/border
    const originalSvgUrl = signaturePad.toDataURL("image/svg+xml");
    const svgContent = atob(originalSvgUrl.split(',')[1]);

    const canvasContainer = container!;
    const computedStyle = window.getComputedStyle(canvasContainer);
    // Only use inline style for background to support transparency by default/unless selected
    const bgColor = canvasContainer.style.backgroundColor;
    const isTransparent = !bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'rgba(255, 255, 255, 0)';

    const borderRadiusRaw = (document.getElementById('radiusSlider') as HTMLInputElement)?.value || '0';
    const borderRadius = borderRadiusRaw + currentRadiusUnit;
    const borderWidthVal = (document.getElementById('borderWidthSlider') as HTMLInputElement)?.value || '0';
    const borderColor = canvasContainer.style.borderColor || computedStyle.borderColor || "rgba(255, 255, 255, 0.08)";
    const borderStyle = currentCanvasBorderStyle;

    const w = canvasContainer.offsetWidth;
    const h = canvasContainer.offsetHeight;
    const internalScale = (canvas?.width || w) / w;

    let dashAttr = "";
    const dashVal = (document.getElementById('borderDashSlider') as HTMLInputElement)?.value || '4';
    if (borderStyle === 'dashed') dashAttr = `stroke-dasharray="${dashVal}, ${dashVal}"`;
    if (borderStyle === 'dotted') dashAttr = `stroke-dasharray="1, ${dashVal}"`;

    const cleanSignature = svgContent.replace(/<svg[^>]*>/, '').replace('</svg>', '');

    // Wrap the signature paths inside a new SVG with background rect
    const wrappedSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
            ${!isTransparent ? `<rect width="100%" height="100%" fill="${bgColor}" rx="${borderRadius}" ry="${borderRadius}" />` : ''}
            <g transform="scale(${1 / internalScale})">
                ${cleanSignature}
            </g>
            ${borderWidthVal !== '0' && borderStyle !== 'none' ?
            `<rect x="${parseFloat(borderWidthVal) / 2}" y="${parseFloat(borderWidthVal) / 2}" 
                       width="${w - parseFloat(borderWidthVal)}" height="${h - parseFloat(borderWidthVal)}" 
                       fill="none" stroke="${borderColor}" stroke-width="${borderWidthVal}" 
                       rx="${borderRadius}" ry="${borderRadius}" ${dashAttr} />` : ''}
        </svg>
    `;

    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.svg`;
    link.href = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(wrappedSvg)));
    link.click();
    showToast(i18n[State.currentLang as keyof typeof i18n].toastSvgDownloaded);
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

export async function copyBase64() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const exportCanvas = getExportCanvas();
        const dataURL = exportCanvas.toDataURL("image/png");
        await navigator.clipboard.writeText(dataURL);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastPngCopied); // Reuse generic success toast
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
