import { selectedStrokeIndices, signaturePad, setThickness, setLastColor, setAlpha, setStrokeType, workspaceScale } from '@/scripts/state';

export function updateSelectedBounds() {
    const el = document.getElementById('selectedBounds');
    if (!el) return;

    // Use window.currentMode for consistency with other modules
    const mode = (window as any).currentMode || 'draw';

    if (selectedStrokeIndices.length === 0 || (mode !== 'transform' && mode !== 'select')) {
        el.style.display = 'none'; return;
    }
    const b = getSelectedDataBounds();
    if (b.minX === Infinity) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    el.style.left = b.minX + 'px';
    el.style.top = b.minY + 'px';
    el.style.width = (b.maxX - b.minX) + 'px';
    el.style.height = (b.maxY - b.minY) + 'px';

    if (mode === 'select') {
        el.classList.add('no-handles');
        el.style.border = 'none'; el.style.opacity = '0';
    } else {
        el.classList.remove('no-handles');
        el.style.border = `${1 / workspaceScale}px dashed var(--primary)`; el.style.opacity = '1';
    }

    const handles = el.querySelectorAll('.resize-handle') as NodeListOf<HTMLElement>;
    handles.forEach(h => {
        h.style.transform = `scale(${1 / workspaceScale})`;
    });
}

export function getSelectedDataBounds() {
    const data = signaturePad.toData();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedStrokeIndices.forEach(idx => {
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
    if (selectedStrokeIndices.length === 0) return;
    const data = signaturePad.toData();
    const first = data[selectedStrokeIndices[0]];
    if (!first) return;

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

    const variety = first.maxWidth / first.minWidth;
    let detectedType = 'natural';
    if (variety > 4) detectedType = 'pen';
    else if (variety < 1.1) detectedType = 'marker';
    else detectedType = 'natural';

    setStrokeType(detectedType);
    const strokeBtns = document.querySelectorAll('#strokeTypePresets .preset-btn');
    strokeBtns.forEach(btn => btn.classList.toggle('active', (btn as HTMLElement).dataset.preset === detectedType));

    const thicknessValEl = document.getElementById('thicknessVal') as HTMLInputElement;
    const thicknessSliderEl = document.getElementById('thicknessSlider') as HTMLInputElement;
    if (thicknessValEl) thicknessValEl.value = currentThicknessVal.toFixed(1);
    if (thicknessSliderEl) thicknessSliderEl.value = currentThicknessVal.toString();
}
