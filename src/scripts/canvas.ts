import { State, signaturePad, history, redoStack, setSelectedIndices, setRedoStack, hint, setThickness, setLastColor, sctx, selectionCanvas, setStrokeType, ratio, setClipboardStrokes } from '@/scripts/state';
import { updateSelectedBounds, syncControlsWithSelection, updateTransformPanelState } from '@/scripts/ui_updates';
import { i18n } from '@/scripts/data';

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

        if (lastState.data.length === 0) hint.classList.remove('hidden');
        else hint.classList.add('hidden');

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

        hint.classList.add('hidden');
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
    const finalVal = Math.max(1, Math.min(20, parseFloat(val.toFixed(1))));
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
                const widths = getThicknessRange(State.currentStrokeType, finalVal);
                data[index].minWidth = widths.min;
                data[index].maxWidth = widths.max;
            }
        });
        signaturePad.fromData(data);
        drawSelectionHighlights();
    } else {
        updateStrokeStyles();
    }
    updateStrokePreview();
}

function getThicknessRange(type: string, baseThickness: number) {
    switch (type) {
        case 'marker': return { min: baseThickness, max: baseThickness };
        case 'pen': return { min: baseThickness * 0.3, max: baseThickness * 2.5 };
        case 'brush': return { min: baseThickness * 0.1, max: baseThickness * 4.0 };
        case 'fine': return { min: baseThickness * 0.9, max: baseThickness * 1.1 };
        case 'natural':
        default: return { min: baseThickness * 0.6, max: baseThickness * 1.8 };
    }
}

export function updateStrokeStyles() {
    const widths = getThicknessRange(State.currentStrokeType, State.currentThickness);
    signaturePad.minWidth = widths.min;
    signaturePad.maxWidth = widths.max;

    switch (State.currentStrokeType) {
        case 'marker': signaturePad.velocityFilterWeight = 0; break;
        case 'pen': signaturePad.velocityFilterWeight = 0; break;
        case 'brush': signaturePad.velocityFilterWeight = 0; break;
        case 'fine': signaturePad.velocityFilterWeight = 0; break;
        case 'natural':
        default: signaturePad.velocityFilterWeight = 0; break;
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
                const widths = getThicknessRange(type, State.currentThickness);
                data[index].minWidth = widths.min;
                data[index].maxWidth = widths.max;
            }
        });
        signaturePad.fromData(data);
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
        signaturePad.fromData(data);
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
        sctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((p: any, i: number) => {
            if (i > 0) sctx.lineTo(p.x, p.y);
        });

        // 1. Outer Glow/Halo (Dynamic based on zoom to stay visible)
        const haloWidth = ((stroke.maxWidth + stroke.minWidth) + (14 / zoomScale));
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.18)';
        sctx.lineWidth = haloWidth;
        sctx.stroke();

        // 2. Selection border indicator (professional dash/solid feel)
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        sctx.lineWidth = 1.2 / zoomScale; // Stay thin regardless of zoom
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

export function downloadPng() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    const dataURL = signaturePad.toDataURL("image/png");
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
    const svgData = signaturePad.toDataURL("image/svg+xml");
    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.svg`;
    link.href = svgData;
    link.click();
    showToast(i18n[State.currentLang as keyof typeof i18n].toastSvgDownloaded);
}

export async function copyPngToClipboard() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[State.currentLang as keyof typeof i18n].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const dataURL = signaturePad.toDataURL("image/png");
        const resp = await fetch(dataURL);
        const blob = await resp.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
        showToast(i18n[State.currentLang as keyof typeof i18n].toastPngCopied);
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
    signaturePad.fromData(nextData);

    // Select the new strokes
    const newIndices = newStrokes.map((_: any, i: number) => data.length + i);
    setSelectedIndices(newIndices);

    updateSelectedBounds();
    drawSelectionHighlights();
    syncControlsWithSelection();
    updateTransformPanelState();

    showToast(i18n[State.currentLang as keyof typeof i18n].toastStrokesPasted, "#6366f1");
}

export function deleteSelection() {
    if (State.selectedStrokeIndices.length === 0) return;
    saveState();
    const data = signaturePad.toData();
    const next = data.filter((_, i) => !State.selectedStrokeIndices.includes(i));
    signaturePad.fromData(next);

    setSelectedIndices([]);
    updateSelectedBounds();
    drawSelectionHighlights();
    updateTransformPanelState();

    if (next.length === 0 && hint) hint.classList.remove('hidden');
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

    signaturePad.fromData(data);
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

    signaturePad.fromData(data);
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

    signaturePad.fromData(data);
    updateSelectedBounds();
    drawSelectionHighlights();
}
