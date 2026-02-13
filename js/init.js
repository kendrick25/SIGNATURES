// init.js
// Global state and DOM references initialization.

// Global DOM references
const canvas = document.getElementById('signatureCanvas');
const container = document.getElementById('canvasContainer');
const hint = document.getElementById('canvasHint');
const workspace = document.getElementById('workspace');
const selectionCanvas = document.getElementById('selectionCanvas');
const selectionBox = document.getElementById('selectionBox');
const selectionInfo = document.getElementById('selectionInfo');
const sidePanel = document.getElementById('sidePanel');
const ctx = canvas.getContext('2d');
const sctx = selectionCanvas.getContext('2d');
const thicknessSlider = document.getElementById('thicknessSlider');
const thicknessVal = document.getElementById('thicknessVal');
const alphaSlider = document.getElementById('alphaSlider');
const alphaVal = document.getElementById('alphaVal');
const resetSizeBtn = document.getElementById('resetSizeBtn');
const centerCanvasBtn = document.getElementById('centerCanvasBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const dockBtn = document.getElementById('dockBtn');
const darkModeToggle = document.getElementById('darkModeToggle');

// Dynamic references (will be updated after rendering)
let colorDots = [];
let strokeTypeBtns = [];
let modeBtns = [];

// Global State
let currentThickness = 2.5;
let currentAlpha = 1.0;
let currentMode = 'draw';
let currentStrokeType = 'natural';
let lastBaseColor = '#ffffff';
let history = [];
let redoStack = [];
let selectedStrokeIndices = [];
let clipboardStrokes = [];
let isSelecting = false, isMoving = false, isResizing = false, isRotating = false, isPanning = false;
let selectStart = { x: 0, y: 0 }, moveStart = { x: 0, y: 0 }, resizeStart = { x: 0, y: 0 };
let rotateStart = { x: 0, y: 0, angle: 0 }, panStart = { x: 0, y: 0 };
let initialTransformData = null;
let transformPivot = { x: 0, y: 0, width: 0, height: 0, minX: 0, minY: 0 };
let workspacePan = { x: 0, y: 0 };
let workspaceScale = 1.0;
let ratio = Math.max(window.devicePixelRatio || 1, 1);
let modeBeforeMiddleClick = null;
let canvasX = 0, canvasY = 0, resizeType = '';

// Initialize Signature Pad
const signaturePad = new SignaturePad(canvas, {
    backgroundColor: 'rgba(0,0,0,0)',
    penColor: lastBaseColor,
    minWidth: 0.8,
    maxWidth: 3.8,
    velocityFilterWeight: 0.5, // More sensitive to speed changes for hand-drawn look
    throttle: 8, // Balanced responsiveness
    minDistance: 0.5 // Maximum precision
});

// Robust Coordinate Mapping Fix for v5.x (including minified versions)
// We look for the internal method that handles coordinate mapping by its signature/logic
(function patchSignaturePad() {
    let targetMethod = '_createPoint'; // Standard name in v5

    // Find the method that calls getBoundingClientRect and uses touch/mouse coordinates
    if (!(targetMethod in signaturePad)) {
        for (let key in signaturePad) {
            if (typeof signaturePad[key] === 'function') {
                const str = signaturePad[key].toString();
                if (str.includes('getBoundingClientRect') && (str.includes('clientX') || str.includes('clientY'))) {
                    targetMethod = key;
                    break;
                }
            }
        }
    }

    if (signaturePad[targetMethod]) {
        const original = signaturePad[targetMethod];
        // SignaturePad v5 _createPoint signature: (x, y, pressure) where x/y are clientX/clientY
        signaturePad[targetMethod] = function (x, y, pressure) {
            const point = original.call(this, x, y, pressure);

            // Correct for workspaceScale. 
            // SignaturePad's default returns relative screen pixels.
            // We need layout pixels for our scaled context.
            if (point && !isNaN(point.x) && !isNaN(point.y)) {
                point.x /= workspaceScale;
                point.y /= workspaceScale;
            }
            return point;
        };
    }
})();

// Observer for container resizing
const observer = new ResizeObserver(() => {
    if (typeof syncSizeValues === 'function') syncSizeValues();
    if (typeof resizeCanvas === 'function') resizeCanvas();
});
observer.observe(container);
