import SignaturePad from 'signature_pad';
import { setDomRefs, setSignaturePad, lastBaseColor } from '@/scripts/state';
import { renderUIComponents, updateGlobalReferences } from '@/scripts/data';
import { syncSizeValues, resizeCanvas } from '@/scripts/workspace';

export function initApp() {
    console.log("initApp: Starting...");
    const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement;
    const containerRef = document.getElementById('canvasContainer') as HTMLElement;
    const hint = document.getElementById('canvasHint') as HTMLElement;
    const workspace = document.getElementById('workspace') as HTMLElement;
    const selectionCanvas = document.getElementById('selectionCanvas') as HTMLCanvasElement;
    const selectionBox = document.getElementById('dragSelection') as HTMLElement;
    const selectionInfo = document.getElementById('selectionInfo') as HTMLElement;
    const sidePanel = document.getElementById('sidePanel') as HTMLElement;

    if (!canvas || !containerRef) {
        throw new Error("Critical DOM elements missing: signatureCanvas or canvasContainer");
    }

    const ctx = canvas.getContext('2d');
    const sctx = selectionCanvas?.getContext('2d');

    if (!ctx) throw new Error("Could not get 2D context for signatureCanvas");

    setDomRefs({
        canvas,
        container: containerRef,
        hint,
        workspace,
        selectionCanvas,
        selectionBox,
        selectionInfo,
        sidePanel,
        ctx,
        sctx
    });

    console.log("initApp: Rendering UI...");
    try {
        renderUIComponents();
        updateGlobalReferences();
    } catch (e) {
        console.error("renderUIComponents failed", e);
    }

    console.log("initApp: Initializing SignaturePad...");

    // Initialize window.workspaceScale before patching
    (window as any).workspaceScale = 1.0;

    const pad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(0,0,0,0)',
        penColor: lastBaseColor,
        minWidth: 0.8,
        maxWidth: 3.8,
        velocityFilterWeight: 0.7, // Smoother path interpolation for vector feel
        throttle: 0,               // Max precision for fast movements
        minDistance: 0             // No dead-zone for start of strokes
    });

    setSignaturePad(pad);

    console.log("initApp: Sizing canvas...");
    // Initial explicit size for container to prevent growth loop
    if (containerRef) {
        containerRef.style.width = '836px';
        containerRef.style.height = '400px';
    }
    syncSizeValues();
    resizeCanvas();

    console.log("initApp: Done.");
}
