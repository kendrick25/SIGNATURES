import { container, workspacePan, workspaceScale, signaturePad, ratio, canvas, sctx, ctx, selectionCanvas, hint } from '@/scripts/state';
import { drawSelectionHighlights } from '@/scripts/canvas';

let resizeTimeout: any;

export function updateWorkspaceTransform() {
    if (!container) return;
    container.style.transform = `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceScale})`;

    // Update global reference for other scripts if they need it
    (window as any).workspaceScale = workspaceScale;

    // Debounce resize to avoid lag during rapid zooming
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 200);
}

export function syncSizeValues() {
    const wVal = document.getElementById('canvasWidthVal') as HTMLInputElement;
    const hVal = document.getElementById('canvasHeightVal') as HTMLInputElement;
    const wSlider = document.getElementById('widthSlider') as HTMLInputElement;
    const hSlider = document.getElementById('heightSlider') as HTMLInputElement;

    if (wVal) wVal.value = container.offsetWidth.toString();
    if (hVal) hVal.value = container.offsetHeight.toString();
    if (wSlider) wSlider.value = container.offsetWidth.toString();
    if (hSlider) hSlider.value = container.offsetHeight.toString();
}

export function resizeCanvas() {
    if (!signaturePad || !canvas || !ctx || !container) return;

    // Store data to restore after resize
    const data = signaturePad.toData();

    // Dynamic resolution scaling for "Vector Quality" at any zoom level
    const effectiveScale = ratio * workspaceScale;

    const newWidth = Math.min(8000, container.offsetWidth * effectiveScale);
    const newHeight = Math.min(8000, container.offsetHeight * effectiveScale);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const realScaleX = newWidth / container.offsetWidth;
        const realScaleY = newHeight / container.offsetHeight;
        ctx.scale(realScaleX, realScaleY);

        if (selectionCanvas && sctx) {
            selectionCanvas.width = newWidth;
            selectionCanvas.height = newHeight;
            sctx.setTransform(1, 0, 0, 1, 0, 0);
            sctx.scale(realScaleX, realScaleY);
        }

        signaturePad.clear();
        if (data.length > 0) {
            signaturePad.fromData(data);
            if (hint) hint.classList.add('hidden');
        } else {
            if (hint) hint.classList.remove('hidden');
        }
        drawSelectionHighlights();
    }
}

export function autoAdjustCanvas() {
    const data = signaturePad.toData();
    if (data.length === 0) {
        recenterCanvas();
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.forEach(stroke => {
        stroke.points.forEach((p: any) => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
    });

    const padding = 40;
    const contentW = maxX - minX + padding;
    const contentH = maxY - minY + padding;

    // Update container size
    container.style.width = Math.max(200, contentW) + 'px';
    container.style.height = Math.max(100, contentH) + 'px';

    // Shift all points to top-left to properly fit and then recenter
    const dx = -minX + (padding / 2);
    const dy = -minY + (padding / 2);
    data.forEach(stroke => {
        stroke.points.forEach((p: any) => {
            p.x += dx; p.y += dy;
        });
    });
    signaturePad.fromData(data);

    syncSizeValues();
    resizeCanvas();
    recenterCanvas();
}

export function recenterCanvas() {
    workspacePan.x = 0;
    workspacePan.y = 0;
    // We don't necessarily want to reset scale on recenter according to original js
    // But we'll keep it consistent with the user's previous experience
    updateWorkspaceTransform();
}
