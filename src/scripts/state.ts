import SignaturePad from 'signature_pad';

// Interfaces
export interface I18nContent {
    [key: string]: {
        [key: string]: string;
    };
}

export interface UIConfig {
    modes: any[];
    tools: any[];
    strokePresets: any[];
    colors: any[];
    canvasPresets: any[];
    languages: any[];
    workspaceShortcuts: any[];
    exportOptions: any[];
    settings: any[];
}

export interface HistoryItem {
    data: any[];
    selection: number[];
}

// Global State
export let currentThickness = 2.5;
export let currentAlpha = 1.0;
export let currentMode = 'draw';
export let currentStrokeType = 'natural';
export let lastBaseColor = '#ffffff';
export let history: HistoryItem[] = [];
export let redoStack: HistoryItem[] = [];
export let selectedStrokeIndices: number[] = [];
export let clipboardStrokes: any[] = [];
export let currentLang = 'es';
export let customColors: Record<string, string> = {
    colorPicker: '',
    canvasBgPicker: '',
    canvasBorderColorPicker: ''
};

const savedFavorites = localStorage.getItem('favoriteColors');
export let favoriteColors: string[] = savedFavorites ? JSON.parse(savedFavorites) : ['#ffffff', '#6366f1', '#06b6d4', '#000000'];

export let isSelecting = false;
export let isMoving = false;
export let isResizing = false;
export let isRotating = false;
export let isPanning = false;

export let workspacePan = { x: 0, y: 0 };
export let workspaceScale = 1.0;
// Super-Sampling Ratio: 2x or 3x is usually the sweet spot for browsers. 
// 4x or higher can sometimes trigger "fast/low-quality" scaling paths in GPUs.
export let ratio = Math.max(window.devicePixelRatio || 1, 2) + 0.5;

// State Mutators (since we can't change exported 'let' from other modules in ESM directly without functions)
// Global State Object for true live bindings across modules
export const State = {
    get currentThickness() { return currentThickness; },
    get currentAlpha() { return currentAlpha; },
    get currentMode() { return currentMode; },
    get currentStrokeType() { return currentStrokeType; },
    get lastBaseColor() { return lastBaseColor; },
    get isSelecting() { return isSelecting; },
    get isMoving() { return isMoving; },
    get isResizing() { return isResizing; },
    get isRotating() { return isRotating; },
    get isPanning() { return isPanning; },
    get workspacePan() { return workspacePan; },
    get workspaceScale() { return workspaceScale; },
    get selectedStrokeIndices() { return selectedStrokeIndices; },
    get currentLang() { return currentLang; },
    get clipboardStrokes() { return clipboardStrokes; },
    get favoriteColors() { return favoriteColors; }
};

export const setThickness = (val: number) => { currentThickness = val; };
export const setAlpha = (val: number) => { currentAlpha = val; };
export const setMode = (val: string) => { currentMode = val; };
export const setStrokeType = (val: string) => { currentStrokeType = val; };
export const setLastColor = (val: string) => { lastBaseColor = val; };
export const setHistory = (val: HistoryItem[]) => { history = val; };
export const setRedoStack = (val: HistoryItem[]) => { redoStack = val; };
export const setSelectedIndices = (val: number[]) => { selectedStrokeIndices = val; };
export const setClipboardStrokes = (val: any[]) => { clipboardStrokes = val; };
export const setLang = (val: string) => { currentLang = val; };
export const setWorkspaceScale = (val: number) => { workspaceScale = val; };
export const setSelecting = (val: boolean) => { isSelecting = val; };
export const setMoving = (val: boolean) => { isMoving = val; };
export const setResizing = (val: boolean) => { isResizing = val; };
export const setRotating = (val: boolean) => { isRotating = val; };
export const setPanning = (val: boolean) => { isPanning = val; };

export const setFavoriteColors = (val: string[]) => {
    favoriteColors = val;
    localStorage.setItem('favoriteColors', JSON.stringify(val));
};


// Export instances that will be initialized in initApp
export let signaturePad: SignaturePad;
export const setSignaturePad = (inst: SignaturePad) => { signaturePad = inst; };

// DOM References (assigned in init)
export let canvas: HTMLCanvasElement;
export let ctx: CanvasRenderingContext2D;
export let selectionCanvas: HTMLCanvasElement;
export let sctx: CanvasRenderingContext2D;
export let container: HTMLElement;
export let workspace: HTMLElement;
export let hint: HTMLElement;
export let selectionBox: HTMLElement;
export let sidePanel: HTMLElement;
export let selectionInfo: HTMLElement;

export const setDomRefs = (refs: any) => {
    canvas = refs.canvas;
    ctx = refs.ctx;
    selectionCanvas = refs.selectionCanvas;
    sctx = refs.sctx;
    container = refs.container;
    workspace = refs.workspace;
    hint = refs.hint;
    selectionBox = refs.selectionBox;
    sidePanel = refs.sidePanel;
    selectionInfo = refs.selectionInfo;
};

// Dynamic references
export let colorDots: NodeListOf<HTMLElement>;
export let strokeTypeBtns: NodeListOf<HTMLElement>;
export let modeBtns: NodeListOf<HTMLElement>;

export const setDynamicRefs = (refs: any) => {
    colorDots = refs.colorDots;
    strokeTypeBtns = refs.strokeTypeBtns;
    modeBtns = refs.modeBtns;
};
