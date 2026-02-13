import { signaturePad, selectedStrokeIndices, history, redoStack, currentThickness, currentStrokeType, lastBaseColor, currentAlpha, setSelectedIndices, setRedoStack, hint, setThickness, setLastColor, sctx, selectionCanvas, setStrokeType, currentLang, ratio, clipboardStrokes, setClipboardStrokes } from '@/scripts/state';
import { updateSelectedBounds, syncControlsWithSelection } from '@/scripts/ui_updates';
import { i18n } from '@/scripts/data';

export function saveState() {
    const data = JSON.parse(JSON.stringify(signaturePad.toData()));
    const selection = [...selectedStrokeIndices];
    history.push({ data, selection });
    setRedoStack([]);
    if (history.length > 50) history.shift();
    updateHistoryButtons();
}

export function undo() {
    if (history.length > 0) {
        const currentData = JSON.parse(JSON.stringify(signaturePad.toData()));
        const currentSelection = [...selectedStrokeIndices];
        redoStack.push({ data: currentData, selection: currentSelection });

        const lastState = history.pop()!;
        signaturePad.fromData(lastState.data);
        setSelectedIndices(lastState.selection || []);

        if (lastState.data.length === 0) hint.classList.remove('hidden');
        else hint.classList.add('hidden');

        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateHistoryButtons();
        updateStrokePreview();
    }
}

export function redo() {
    if (redoStack.length > 0) {
        const currentData = JSON.parse(JSON.stringify(signaturePad.toData()));
        const currentSelection = [...selectedStrokeIndices];
        history.push({ data: currentData, selection: currentSelection });

        const nextState = redoStack.pop()!;
        signaturePad.fromData(nextState.data);
        setSelectedIndices(nextState.selection || []);

        hint.classList.add('hidden');
        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
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
    if (selectedStrokeIndices.length > 0) {
        saveState();
        selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                const widths = getThicknessRange(currentStrokeType, finalVal);
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
    const widths = getThicknessRange(currentStrokeType, currentThickness);
    signaturePad.minWidth = widths.min;
    signaturePad.maxWidth = widths.max;

    switch (currentStrokeType) {
        case 'marker': signaturePad.velocityFilterWeight = 1; break;
        case 'pen': signaturePad.velocityFilterWeight = 0.45; break;
        case 'brush': signaturePad.velocityFilterWeight = 0.5; break;
        case 'fine': signaturePad.velocityFilterWeight = 0.8; break;
        case 'natural':
        default: signaturePad.velocityFilterWeight = 0.65; break;
    }
    updateStrokePreview();
}

export function applyStrokeType(type: string) {
    setStrokeType(type);
    if (selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        selectedStrokeIndices.forEach(index => {
            if (data[index]) {
                const widths = getThicknessRange(type, currentThickness);
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
    const finalColor = hexToRgba(colorHex, currentAlpha);
    signaturePad.penColor = finalColor;

    if (selectedStrokeIndices.length > 0) {
        saveState();
        const data = signaturePad.toData();
        selectedStrokeIndices.forEach(index => {
            if (data[index]) data[index].penColor = finalColor;
        });
        signaturePad.fromData(data);
    }

    updateSelectedBounds();
    drawSelectionHighlights();
    updateStrokePreview();
}

export function drawSelectionHighlights() {
    if (!sctx || !selectionCanvas) return;
    sctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    const mode = (window as any).currentMode || 'draw';
    if (selectedStrokeIndices.length === 0 || (mode !== 'select' && mode !== 'transform')) return;

    const data = signaturePad.toData();
    sctx.lineCap = 'round'; sctx.lineJoin = 'round';
    selectedStrokeIndices.forEach(idx => {
        const stroke = data[idx];
        if (!stroke || stroke.points.length < 2) return;
        sctx.beginPath();
        sctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((p: any, i: number) => { if (i > 0) sctx.lineTo(p.x, p.y); });
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        sctx.lineWidth = (stroke.maxWidth + stroke.minWidth) + 10;
        sctx.stroke();
        sctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        sctx.lineWidth = 2;
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
    pctx.strokeStyle = hexToRgba(lastBaseColor, currentAlpha);
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';

    const centerY = h / 2;
    const startX = w * 0.15;
    const endX = w * 0.85;

    const range = getThicknessRange(currentStrokeType, currentThickness);
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
        showToast(i18n[currentLang].toastSignFirst, "#ef4444");
        return;
    }
    const dataURL = signaturePad.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    showToast(i18n[currentLang].toastPngDownloaded);
}

export function downloadSvg() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[currentLang].toastSignFirst, "#ef4444");
        return;
    }
    const svgData = signaturePad.toDataURL("image/svg+xml");
    const link = document.createElement("a");
    link.download = `firma-${Date.now()}.svg`;
    link.href = svgData;
    link.click();
    showToast(i18n[currentLang].toastSvgDownloaded);
}

export async function copyPngToClipboard() {
    if (signaturePad.isEmpty()) {
        showToast(i18n[currentLang].toastSignFirst, "#ef4444");
        return;
    }
    try {
        const dataURL = signaturePad.toDataURL("image/png");
        const resp = await fetch(dataURL);
        const blob = await resp.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
        showToast(i18n[currentLang].toastPngCopied);
    } catch (err) {
        console.error(err);
        showToast(i18n[currentLang].toastError, "#ef4444");
    }
}
export function copySelection() {
    if (selectedStrokeIndices.length === 0) return;
    const data = signaturePad.toData();
    const strokes = selectedStrokeIndices.map(idx => JSON.parse(JSON.stringify(data[idx])));
    setClipboardStrokes(strokes);
    showToast(i18n[currentLang as keyof typeof i18n].toastStrokesCopied, "#6366f1");
}

export function pasteSelection() {
    if (clipboardStrokes.length === 0) return;
    saveState();
    const data = signaturePad.toData();
    const offset = 20;
    const newStrokes = clipboardStrokes.map((s: any) => {
        const clone = JSON.parse(JSON.stringify(s));
        clone.points.forEach((p: any) => { p.x += offset; p.y += offset; });
        return clone;
    });

    // Append new strokes
    const nextData = [...data, ...newStrokes];
    signaturePad.fromData(nextData);

    // Select the new strokes
    const newIndices = newStrokes.map((_, i) => data.length + i);
    setSelectedIndices(newIndices);

    updateSelectedBounds();
    drawSelectionHighlights();
    syncControlsWithSelection();

    showToast(i18n[currentLang as keyof typeof i18n].toastStrokesPasted, "#6366f1");
}

export function deleteSelection() {
    if (selectedStrokeIndices.length === 0) return;
    saveState();
    const data = signaturePad.toData();
    const next = data.filter((_, i) => !selectedStrokeIndices.includes(i));
    signaturePad.fromData(next);

    setSelectedIndices([]);
    updateSelectedBounds();
    drawSelectionHighlights();

    if (next.length === 0 && hint) hint.classList.remove('hidden');
}
