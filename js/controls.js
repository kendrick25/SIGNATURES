// Scrubbing Base Logic
function setupScrubber(element, onUpdate, getStartVal, step = 0.1) {
    let scrubbing = false;
    let startPos = 0;
    let currentStartVal = 0;
    let moved = false;

    element.addEventListener('mousedown', (e) => {
        scrubbing = true;
        startPos = e.clientX;
        currentStartVal = getStartVal();
        moved = false;
        document.body.style.cursor = 'ew-resize';
    });

    window.addEventListener('mousemove', (e) => {
        if (!scrubbing) return;

        const deltaX = e.clientX - startPos;
        if (Math.abs(deltaX) > 4) {
            moved = true;
            // Prevent text selection while scrubbing
            window.getSelection().removeAllRanges();
            const delta = deltaX * step;
            onUpdate(currentStartVal + delta);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (!scrubbing) return;
        scrubbing = false;
        document.body.style.cursor = 'default';

        // Only if it was a click (not a move) and target is input, focus/select it
        if (!moved && e.target.tagName === 'INPUT') {
            e.target.focus();
            e.target.select();
        }
    });
}

// Long Press / Repeat Logic
function setupLongPress(btn, action) {
    let timer;
    let interval;
    const start = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        action();
        timer = setTimeout(() => {
            interval = setInterval(action, 80);
        }, 400);
    };
    const stop = () => {
        clearTimeout(timer);
        clearInterval(interval);
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    btn.addEventListener('touchend', stop);
}

function centerCanvas() {
    workspacePan = { x: 0, y: 0 };
    workspaceScale = 1.0;
    updateWorkspaceTransform();
}

function updateWorkspaceTransform() {
    container.style.transform = `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceScale})`;
    // Sync UI controls
    const zoomPercent = Math.round(workspaceScale * 100);
    document.getElementById('zoomVal').value = zoomPercent;
    document.getElementById('zoomSlider').value = zoomPercent;
}
