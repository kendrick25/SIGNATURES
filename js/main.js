// ===========================
// MAIN.JS - Core Initialization & Utilities
// ===========================

// Initialize Lucide icons
lucide.createIcons();

// DOM Elements - Core
const toast = document.getElementById('toast');
const exportDropdown = document.getElementById('exportDropdown');
const exportMainBtn = document.getElementById('exportMainBtn');

// ===========================
// TOAST NOTIFICATIONS
// ===========================
function showToast(message, color = "#10b981") {
    toast.innerText = message;
    toast.style.background = color;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===========================
// DROPDOWN LOGIC
// ===========================
exportMainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('active');
});

document.addEventListener('click', () => {
    exportDropdown.classList.remove('active');
});

// Close when clicking items
document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
        exportDropdown.classList.remove('active');
    });
});

// ===========================
// UTILITY FUNCTIONS
// ===========================
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ===========================
// LONG PRESS / REPEAT LOGIC
// ===========================
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

// ===========================
// SCRUBBING BASE LOGIC
// ===========================
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
            window.getSelection().removeAllRanges();
            const delta = deltaX * step;
            onUpdate(currentStartVal + delta);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (!scrubbing) return;
        scrubbing = false;
        document.body.style.cursor = 'default';

        if (!moved && e.target.tagName === 'INPUT') {
            e.target.focus();
            e.target.select();
        }
    });
}

// Export functions for use in other modules
window.showToast = showToast;
window.hexToRgba = hexToRgba;
window.setupLongPress = setupLongPress;
window.setupScrubber = setupScrubber;
