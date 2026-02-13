// workspace.js
// Handles workspace transformations (pan, zoom) and canvas resizing.

let resizeTimeout;

function updateWorkspaceTransform() {
    container.style.transform = `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceScale})`;

    // Update zoom label if it exists
    const zoomVal = document.getElementById('zoomVal');
    if (zoomVal) {
        zoomVal.innerText = Math.round(workspaceScale * 100) + '%';
    }

    // Debounce resize to avoid lag during rapid zooming
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 200);
}

function syncSizeValues() {
    const widthVal = document.getElementById('canvasWidthVal');
    const heightVal = document.getElementById('canvasHeightVal');
    const widthSlider = document.getElementById('widthSlider');
    const heightSlider = document.getElementById('heightSlider');

    if (widthVal) widthVal.value = container.offsetWidth;
    if (heightVal) heightVal.value = container.offsetHeight;
    if (widthSlider) widthSlider.value = container.offsetWidth;
    if (heightSlider) heightSlider.value = container.offsetHeight;
}

function resizeCanvas() {
    if (!signaturePad) return;

    const data = signaturePad.toData();
    ratio = Math.max(window.devicePixelRatio || 1, 1);

    // Dynamic resolution scaling for "Vector Quality" at any zoom level
    const effectiveScale = ratio * workspaceScale;

    // Limit max resolution to avoid crashing mobile browsers (e.g., 4k limit approx)
    // 800px * 5 (500%) * 3 (DPI) = 12000px width! Too big.
    // Cap at reasonable max spacing approx 4000-5000px?
    // Let's rely on standard constraints or user sanity mostly, but safety cap is good.
    const newWidth = Math.min(8000, container.offsetWidth * effectiveScale);
    const newHeight = Math.min(8000, container.offsetHeight * effectiveScale);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;

        // SignaturePad v5: Use internal context scaling for layout-coordinate points.
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // We scale the context so that 1 layout unit = effectiveScale pixels
        // But wait, if we cap width, we must adjust scale?
        // If we capped, realScale might differ from effectiveScale.
        const realScaleX = newWidth / container.offsetWidth;
        const realScaleY = newHeight / container.offsetHeight;

        ctx.scale(realScaleX, realScaleY);

        selectionCanvas.width = newWidth;
        selectionCanvas.height = newHeight;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.scale(realScaleX, realScaleY);

        signaturePad.clear();
        if (data.length > 0) {
            signaturePad.fromData(data);
            if (hint) hint.classList.add('hidden');
        } else {
            if (hint) hint.classList.remove('hidden');
        }
        if (typeof drawSelectionHighlights === 'function') drawSelectionHighlights();
    }
}

// Recenter functionality
function recenterCanvas() {
    workspacePan.x = 0;
    workspacePan.y = 0;
    workspaceScale = 1.0;
    updateWorkspaceTransform();
}

function autoAdjustCanvas() {
    const data = signaturePad.toData();
    if (data.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.forEach(stroke => {
        stroke.points.forEach(p => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
    });

    // Add padding in logic pixels
    const padding = 40;
    const contentW = (maxX - minX + padding);
    const contentH = (maxY - minY + padding);

    container.style.width = Math.max(200, contentW) + 'px';
    container.style.height = Math.max(100, contentH) + 'px';

    // Shift all points to top-left
    const dx = -minX + (padding / 2);
    const dy = -minY + (padding / 2);

    data.forEach(stroke => {
        stroke.points.forEach(p => {
            p.x += dx;
            p.y += dy;
        });
    });

    signaturePad.fromData(data);
    resizeCanvas();
    syncSizeValues();
}
