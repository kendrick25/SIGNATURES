// Initialize Lucide icons
lucide.createIcons();

// DOM Elements
const canvas = document.getElementById('signatureCanvas');
const container = document.getElementById('canvasContainer');
const hint = document.getElementById('canvasHint');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const copySvgBtn = document.getElementById('copySvgBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const colorDots = document.querySelectorAll('.color-dot');
const toast = document.getElementById('toast');
const thicknessVal = document.getElementById('thicknessVal');
const thicknessSlider = document.getElementById('thicknessSlider');
const decWidth = document.getElementById('decWidth');
const incWidth = document.getElementById('incWidth');
const thicknessScrubArea = document.getElementById('thicknessScrubArea');
const cropBtn = document.getElementById('cropBtn');

const canvasWidthVal = document.getElementById('canvasWidthVal');
const widthScrubArea = document.getElementById('widthScrubArea');
const canvasHeightVal = document.getElementById('canvasHeightVal');
const heightScrubArea = document.getElementById('heightScrubArea');
const widthSlider = document.getElementById('widthSlider');
const heightSlider = document.getElementById('heightSlider');

const presetBtns = document.querySelectorAll('.preset-btn');
const resetSizeBtn = document.getElementById('resetSizeBtn');
const centerCanvasBtn = document.getElementById('centerCanvasBtn');
const workspace = document.getElementById('workspace');
const modeBtns = document.querySelectorAll('#modeToggle .preset-btn');
const selectionInfo = document.getElementById('selectionInfo');

const ctx = canvas.getContext('2d');
const selectionCanvas = document.getElementById('selectionCanvas');
const sctx = selectionCanvas.getContext('2d');

// State Variables
let currentThickness = 2.5;
let history = []; // Stack of full states
let redoStack = [];
let currentMode = 'draw'; // 'draw', 'select', 'pan', 'transform'
let currentStrokeType = 'natural';
let currentAlpha = 1.0;
let selectedStrokeIndices = [];
let isSelecting = false;
let isMoving = false;
let isResizing = false;
let isPanning = false;
let selectStart = { x: 0, y: 0 };
let moveStart = { x: 0, y: 0 };
let resizeStart = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };
let workspacePan = { x: 0, y: 0 };
let workspaceScale = 1.0;
let modeBeforeMiddleClick = null;
let lastBaseColor = "#ffffff";
let clipboardStrokes = [];

// Setup Signature Pad
const signaturePad = new SignaturePad(canvas, {
    backgroundColor: 'rgba(0,0,0,0)',
    penColor: '#ffffff',
    minWidth: 1.5,
    maxWidth: 4.5,
    velocityFilterWeight: 0.7
});
