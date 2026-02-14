import { container, workspacePan, workspaceScale, signaturePad, ratio, canvas, sctx, ctx, selectionCanvas, hint, selectedStrokeIndices } from '@/scripts/state';
import { drawSelectionHighlights } from '@/scripts/canvas';



export function updateWorkspaceTransform() {
    if (!container) return;
    container.style.transform = `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceScale})`;

    // Update global reference
    (window as any).workspaceScale = workspaceScale;
    updateSignaturePadOptions();
}

export function updateSignaturePadOptions() {
    if (!signaturePad) return;
    // Dynamic adjustment: More points when zoomed in, more filtering when zoomed out
    signaturePad.minDistance = 0.5 / Math.max(0.1, workspaceScale);
    signaturePad.throttle = Math.max(0, Math.floor(8 / Math.max(0.1, workspaceScale)));
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

    // Use a stable ratio for internal resolution to prevent coordinate drift on zoom
    const effectiveScale = ratio;

    // Use clientWidth to avoid border-induced growth loops
    const baseWidth = Math.floor(container.clientWidth);
    const baseHeight = Math.floor(container.clientHeight);

    const newWidth = Math.floor(baseWidth * effectiveScale);
    const newHeight = Math.floor(baseHeight * effectiveScale);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        // Essential: Set internal resolution
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Essential: Set CSS size to match container's LOGICAL size
        canvas.style.width = baseWidth + 'px';
        canvas.style.height = baseHeight + 'px';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(effectiveScale, effectiveScale);

        if (selectionCanvas && sctx) {
            selectionCanvas.width = newWidth;
            selectionCanvas.height = newHeight;
            selectionCanvas.style.width = baseWidth + 'px';
            selectionCanvas.style.height = baseHeight + 'px';
            sctx.setTransform(1, 0, 0, 1, 0, 0);
            sctx.scale(effectiveScale, effectiveScale);
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

    const indicesToFit = selectedStrokeIndices.length > 0
        ? selectedStrokeIndices
        : data.map((_, i) => i);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    indicesToFit.forEach(idx => {
        if (data[idx]) {
            data[idx].points.forEach((p: any) => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        }
    });

    if (minX === Infinity) return; // Should not happen with data

    const currentW = maxX - minX;
    const currentH = maxY - minY;

    const padding = 60; // Comfortable padding
    const availableW = Math.max(100, container.offsetWidth - padding);
    const availableH = Math.max(100, container.offsetHeight - padding);

    // Calculate scale to FIT
    const scaleX = availableW / currentW;
    const scaleY = availableH / currentH;
    // scale variable removed
    const finalScale = Math.min(scaleX, scaleY);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const targetCx = container.offsetWidth / 2;
    const targetCy = container.offsetHeight / 2;

    // Apply transform: Scale around center, then Translate to center
    // We modify points directly
    indicesToFit.forEach(idx => {
        if (data[idx]) {
            data[idx].points.forEach((p: any) => {
                // 1. Center at origin (relative to bounding box center)
                let x = p.x - cx;
                let y = p.y - cy;

                // 2. Scale
                x *= finalScale;
                y *= finalScale;

                // 3. Move to target center
                p.x = x + targetCx;
                p.y = y + targetCy;

                // Scale width
                p.pressure *= finalScale; // Optional: scale pressure/width too to match?
            });
            data[idx].minWidth *= finalScale;
            data[idx].maxWidth *= finalScale;
        }
    });

    signaturePad.fromData(data);
    drawSelectionHighlights();

    // Reset workspace pan so the centered content is visible
    recenterCanvas();
}

export function recenterCanvas() {
    workspacePan.x = 0;
    workspacePan.y = 0;
    // We don't necessarily want to reset scale on recenter according to original js
    // But we'll keep it consistent with the user's previous experience
    updateWorkspaceTransform();
}
