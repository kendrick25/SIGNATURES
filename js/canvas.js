// Resize Canvas Logic
const observer = new ResizeObserver(() => {
    syncSizeValues();
    resizeCanvas();
});
observer.observe(container);

function syncSizeValues() {
    if (document.activeElement !== canvasWidthVal) canvasWidthVal.value = Math.round(container.offsetWidth);
    if (document.activeElement !== canvasHeightVal) canvasHeightVal.value = Math.round(container.offsetHeight);
}

function resizeCanvas() {
    const data = signaturePad.toData();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    const newWidth = container.offsetWidth * ratio;
    const newHeight = container.offsetHeight * ratio;

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);

        selectionCanvas.width = newWidth;
        selectionCanvas.height = newHeight;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.scale(ratio, ratio);

        signaturePad.clear();
        if (data.length > 0) {
            signaturePad.fromData(data);
            hint.classList.add('hidden');
        } else {
            hint.classList.remove('hidden');
        }
        drawSelectionHighlights();
    }
}

// History System
function saveState() {
    const data = signaturePad.toData();
    const selection = [...selectedStrokeIndices];
    history.push({ data, selection });
    redoStack = [];
    if (history.length > 50) history.shift();
    updateHistoryButtons();
}

function undo() {
    if (history.length > 0) {
        // Current state to redo
        const currentData = signaturePad.toData();
        const currentSelection = [...selectedStrokeIndices];
        redoStack.push({ data: currentData, selection: currentSelection });

        // Restore last state
        const lastState = history.pop();
        signaturePad.fromData(lastState.data);
        selectedStrokeIndices = lastState.selection || []; // Restore selection

        if (lastState.data.length === 0) hint.classList.remove('hidden');
        else hint.classList.add('hidden');

        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection(); // Helper to sync UI
        updateHistoryButtons();
    }
}

function redo() {
    if (redoStack.length > 0) {
        // Current state to history
        const currentData = signaturePad.toData();
        const currentSelection = [...selectedStrokeIndices];
        history.push({ data: currentData, selection: currentSelection });

        // Restore next state
        const nextState = redoStack.pop();
        signaturePad.fromData(nextState.data);
        selectedStrokeIndices = nextState.selection || [];

        hint.classList.add('hidden');
        updateSelectedBounds();
        drawSelectionHighlights();
        syncControlsWithSelection();
        updateHistoryButtons();
    }
}

function updateHistoryButtons() {
    document.getElementById('undoBtn').disabled = history.length === 0;
    document.getElementById('redoBtn').disabled = redoStack.length === 0;
}
