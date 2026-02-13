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
    const selectionBox = document.getElementById('selectionBox') as HTMLElement;
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
        velocityFilterWeight: 0.5,
        throttle: 8,
        minDistance: 0.5
    });

    setSignaturePad(pad);
    patchSignaturePad(pad);

    console.log("initApp: Sizing canvas...");
    syncSizeValues();
    resizeCanvas();

    if (containerRef) {
        const observer = new ResizeObserver(() => {
            syncSizeValues();
            resizeCanvas();
        });
        observer.observe(containerRef);
    }
    console.log("initApp: Done.");
}

function patchSignaturePad(pad: any) {
    if (!pad) {
        console.error("patchSignaturePad: pad is null/undefined");
        return;
    }

    let targetMethod = '_createPoint';
    console.log("patchSignaturePad: Searching for coordinate mapping method...");

    // Robust search for the method that handles touches/mouse (calls getBoundingClientRect)
    // This is needed because minified or newer versions might rename internal methods
    if (typeof pad[targetMethod] !== 'function') {
        console.log(`patchSignaturePad: ${targetMethod} not found, searching...`);
        // Try to find it by signature/behavior
        for (const key in pad) {
            if (typeof pad[key] === 'function') {
                const str = pad[key].toString();
                if (str.includes('getBoundingClientRect') && (str.includes('clientX') || str.includes('clientY'))) {
                    targetMethod = key;
                    console.log(`patchSignaturePad: Found target method: ${key}`);
                    break;
                }
            }
        }
    } else {
        console.log(`patchSignaturePad: Found ${targetMethod} directly`);
    }

    if (typeof pad[targetMethod] !== 'function') {
        console.error("patchSignaturePad: Could not find _createPoint or equivalent. Coordinate mapping may be incorrect.");
        console.log("Available methods:", Object.keys(pad).filter(k => typeof pad[k] === 'function'));
        return;
    }

    const original = pad[targetMethod];
    pad[targetMethod] = function (x: number, y: number, pressure: number) {
        const point = original.call(this, x, y, pressure);

        if (point && !isNaN(point.x) && !isNaN(point.y)) {
            const currentScale = (window as any).workspaceScale || 1.0;
            // Calculate the internal ratio SignaturePad applied: internal_px / css_px
            // This accounts for DPI and any resolution scaling we do in resizeCanvas
            const internalRatio = this.canvas.width / this.canvas.offsetWidth;

            point.x = (point.x / internalRatio) / currentScale;
            point.y = (point.y / internalRatio) / currentScale;
        }
        return point;
    };
    console.log("✓ patchSignaturePad: Applied coordinate mapping patch successfully");
}
