import { container, workspace, workspacePan, workspaceScale, ratio, signaturePad, canvas, sctx, ctx, selectionCanvas, selectedStrokeIndices } from '@/scripts/state';
import { drawSelectionHighlights, updateHintVisibility, safeFromData } from '@/scripts/canvas';



export function updateWorkspaceTransform() {
    if (!container) return;

    // Round pan values to avoid sub-pixel rendering artifacts
    const px = Math.round(workspacePan.x);
    const py = Math.round(workspacePan.y);
    const s = parseFloat(workspaceScale.toFixed(4));

    container.style.transform = `translate(${px}px, ${py}px) scale(${s})`;

    // EXCALIDRAW STYLE: Sync the viewport background grid to the workspace pan/zoom
    const mainLayout = document.querySelector('.app-main-layout') as HTMLElement;
    if (mainLayout) {
        const baseGridSize = 20;
        const scaledGridSize = baseGridSize * s;
        mainLayout.style.backgroundSize = `${scaledGridSize}px ${scaledGridSize}px`;

        // Align grid with the canvas physical origin
        const rect = container.getBoundingClientRect();
        mainLayout.style.backgroundPosition = `${Math.round(rect.left)}px ${Math.round(rect.top)}px`;
    }

    // Update global reference
    (window as any).workspaceScale = s;
    updateSignaturePadOptions();
}

export function updateSignaturePadOptions() {
    if (!signaturePad) return;
    // Balanced adjustment: enough points for curves, not too many to cause jitter
    // A small minDistance (0.5 to 1.0) helps significantly with "pixelation" in curves by filtering sensor noise.
    signaturePad.minDistance = 0.2;
    signaturePad.throttle = 0;
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

    // Unified High-Quality Ratio (Super-Sampling)
    const effectiveScale = ratio;

    const baseWidth = container.clientWidth;
    const baseHeight = container.clientHeight;

    // Use Math.round to ensure exact physical pixel mapping
    const newWidth = Math.round(baseWidth * effectiveScale);
    const newHeight = Math.round(baseHeight * effectiveScale);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        canvas.style.width = baseWidth + 'px';
        canvas.style.height = baseHeight + 'px';
        canvas.style.transform = 'translateZ(0)'; // Force GPU layer

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(effectiveScale, effectiveScale);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (selectionCanvas && sctx) {
            selectionCanvas.width = newWidth;
            selectionCanvas.height = newHeight;
            selectionCanvas.style.width = baseWidth + 'px';
            selectionCanvas.style.height = baseHeight + 'px';
            selectionCanvas.style.transform = 'translateZ(0)';

            sctx.setTransform(1, 0, 0, 1, 0, 0);
            sctx.scale(effectiveScale, effectiveScale);
            sctx.imageSmoothingEnabled = true;
            sctx.imageSmoothingQuality = 'high';
        }

        signaturePad.clear();
        if (data.length > 0) {
            safeFromData(data);
        }
        updateHintVisibility();
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
            });
            data[idx].minWidth *= finalScale;
            data[idx].maxWidth *= finalScale;
        }
    });

    safeFromData(data);
    updateHintVisibility();
    drawSelectionHighlights();

    // Reset workspace pan so the centered content is visible
    recenterCanvas();
}

export function recenterCanvas() {
    if (!container || !workspace) return;

    // Get viewport dimensions
    const viewportRect = workspace.getBoundingClientRect();
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // Calculate top-left position to center the SCALED container
    // Since transform-origin is 0 0, the physical space occupied is (originalSize * scale)
    workspacePan.x = (viewportRect.width - containerWidth * workspaceScale) / 2;
    workspacePan.y = (viewportRect.height - containerHeight * workspaceScale) / 2;

    updateWorkspaceTransform();
}
