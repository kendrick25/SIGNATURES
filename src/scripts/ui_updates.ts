import { State, signaturePad, setThickness, setLastColor, setAlpha, setStrokeType } from '@/scripts/state';

export function updateSelectedBounds(customData: any = null) {
    const el = document.getElementById('selectedBounds');
    if (!el) return;

    const mode = State.currentMode;

    // Show bounding box ONLY in transform mode. In select mode, we only want the stroke highlight (drawing canvas)
    if (State.selectedStrokeIndices.length === 0 || mode !== 'transform') {
        el.style.display = 'none'; return;
    }
    const b = getSelectedDataBounds(customData);
    if (b.minX === Infinity) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    el.style.left = (b.minX - 4) + 'px';
    el.style.top = (b.minY - 4) + 'px';
    el.style.width = (b.maxX - b.minX + 8) + 'px';
    el.style.height = (b.maxY - b.minY + 8) + 'px';

    const zoom = State.workspaceScale;

    // Bounding box only exists in transform mode
    el.classList.remove('no-handles');
    el.style.border = `${1 / zoom}px dashed var(--primary)`;
    el.style.background = 'rgba(99, 102, 241, 0.02)'; // Subtle area tint
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';

    const handles = el.querySelectorAll('.resize-handle') as NodeListOf<HTMLElement>;
    handles.forEach(h => {
        const scaleVal = 1 / zoom;
        h.style.transform = `translate(-50%, -50%) scale(${scaleVal})`;
        h.style.pointerEvents = 'auto';
        h.style.display = 'block';
    });
}

export function getSelectedDataBounds(customData: any = null) {
    const data = customData || signaturePad.toData();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    State.selectedStrokeIndices.forEach(idx => {
        if (data[idx]) {
            data[idx].points.forEach((p: any) => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        }
    });
    return { minX, minY, maxX, maxY };
}

export function syncControlsWithSelection() {
    if (State.selectedStrokeIndices.length === 0) return;
    const data = signaturePad.toData();
    const first = data[State.selectedStrokeIndices[0]];
    if (!first || typeof first.maxWidth === 'undefined' || typeof first.minWidth === 'undefined') return;

    const currentThicknessVal = (first.maxWidth + first.minWidth) / 2;
    const strokeColor = first.penColor || '#ffffff';
    let base = '#ffffff', alpha = 1.0;

    if (strokeColor.startsWith('rgba')) {
        const m = strokeColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (m) {
            base = `#${[m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('')}`;
            alpha = parseFloat(m[4]);
        }
    } else if (strokeColor.startsWith('#')) base = strokeColor;

    setLastColor(base);
    setAlpha(alpha);
    setThickness(currentThicknessVal);

    // Update UI
    const alphaSlider = document.getElementById('alphaSlider') as HTMLInputElement;
    const alphaVal = document.getElementById('alphaVal');
    if (alphaSlider) alphaSlider.value = alpha.toString();
    if (alphaVal) alphaVal.innerText = Math.round(alpha * 100) + '%';

    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-color')?.toLowerCase() === base.toLowerCase());
    });

    const s = first as any;
    let detectedType = s.strokeType || 'natural';

    // If no explicit type stored, fallback to detection by variety
    if (!s.strokeType) {
        const variety = (s.maxWidth || 0) / (s.minWidth || 0.1);
        if (variety >= 7) detectedType = 'brush';
        else if (variety >= 3) detectedType = 'pen';
        else if (variety < 1.1) detectedType = 'marker';
        else detectedType = 'natural';
    }

    setStrokeType(detectedType);
    const strokeBtns = document.querySelectorAll('#strokeTypePresets .preset-btn');
    strokeBtns.forEach(btn => btn.classList.toggle('active', (btn as HTMLElement).dataset.preset === detectedType));

    const thicknessValEl = document.getElementById('thicknessVal') as HTMLInputElement;
    const thicknessSliderEl = document.getElementById('thicknessSlider') as HTMLInputElement;
    if (thicknessValEl) thicknessValEl.value = currentThicknessVal.toFixed(1);
    if (thicknessSliderEl) thicknessSliderEl.value = currentThicknessVal.toString();
}

export function updateTransformPanelState() {
    const hasSelection = State.selectedStrokeIndices.length > 0;
    const transformPanel = document.getElementById('groupTransform');
    if (!transformPanel) return;

    // Enable/Disable all interactive elements within the panel (buttons, inputs)
    const interactives = transformPanel.querySelectorAll('button, input');
    interactives.forEach(el => {
        (el as HTMLButtonElement | HTMLInputElement).disabled = !hasSelection;
    });

    // Add a visual visual hint for the disabled state
    transformPanel.style.opacity = hasSelection ? '1' : '0.4';
    transformPanel.style.pointerEvents = hasSelection ? 'auto' : 'none';
}
