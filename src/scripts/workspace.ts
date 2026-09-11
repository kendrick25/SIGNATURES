import { container, workspace, workspacePan, workspaceScale, ratio, signaturePad, canvas, sctx, ctx, selectionCanvas, selectedStrokeIndices, CANVAS_MARGIN } from '@/scripts/state';
import { drawSelectionHighlights, updateHintVisibility, safeFromData } from '@/scripts/canvas';
import { updateSelectedBounds } from '@/scripts/ui_updates';



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
    // Balanced adjustment for ultra-smooth curves
    // We delegate logic to ensure consistency, but if we have circular dependency issues, 
    // we'll manually set the most safe defaults here.
    // The actual tool styles are re-applied by the UI interactions.
    signaturePad.throttle = 8;     // Small buffer to smooth out high-frequency sensor noise
    signaturePad.minDistance = 1.0; // Minimal filter to prevent micro-jitter while keeping detail
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

    // We make the canvas HUGE to allow drawing/seeing strokes outside the visible container.
    const margin = CANVAS_MARGIN;
    const canvasW = baseWidth + margin * 2;
    const canvasH = baseHeight + margin * 2;

    // Use Math.round to ensure exact physical pixel mapping
    const newWidth = Math.round(canvasW * effectiveScale);
    const newHeight = Math.round(canvasH * effectiveScale);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;

        // CSS sizing and translation to keep the "logical" (0,0) at the container's top-left
        canvas.style.width = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
        canvas.style.marginLeft = `-${margin}px`;
        canvas.style.marginTop = `-${margin}px`;
        canvas.style.transform = 'translateZ(0)'; // Force GPU layer

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(effectiveScale, effectiveScale);
        ctx.translate(margin, margin); // Offset everything so "logical 0,0" is the page start

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (selectionCanvas && sctx) {
            selectionCanvas.width = newWidth;
            selectionCanvas.height = newHeight;
            selectionCanvas.style.width = canvasW + 'px';
            selectionCanvas.style.height = canvasH + 'px';
            selectionCanvas.style.marginLeft = `-${margin}px`;
            selectionCanvas.style.marginTop = `-${margin}px`;
            selectionCanvas.style.transform = 'translateZ(0)';

            sctx.setTransform(1, 0, 0, 1, 0, 0);
            sctx.scale(effectiveScale, effectiveScale);
            sctx.translate(margin, margin);
            sctx.imageSmoothingEnabled = true;
            sctx.imageSmoothingQuality = 'high';
        }

        // Patch clear to work with huge canvas and transforms
        const originalClear = signaturePad.clear.bind(signaturePad);
        signaturePad.clear = function () {
            // First do the original clear to reset internal library state
            originalClear();

            // Then manually clear the physical canvas areas using identity transforms
            // because SignaturePad's clear() respects current context transformations
            // which might not cover the whole 2000px margin area.
            const pad = signaturePad as any;
            const c = pad.canvas || pad._canvas;
            if (c) {
                const context = c.getContext('2d');
                if (context) {
                    context.save();
                    context.setTransform(1, 0, 0, 1, 0, 0);
                    context.clearRect(0, 0, c.width, c.height);
                    context.restore();
                }
            }

            // Sync selection canvas too
            if (sctx && selectionCanvas) {
                sctx.save();
                sctx.setTransform(1, 0, 0, 1, 0, 0);
                sctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
                sctx.restore();
            }
        };

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

    const padding = 0; // No padding as requested
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

    // Update selection bounds if there are selected strokes
    if (selectedStrokeIndices.length > 0) {
        updateSelectedBounds();
        drawSelectionHighlights();
    }
}
