export const ControlsHTML = `
    <div class="header-sub-row controls-header">
        <button class="header-tool-btn" id="workspaceToggle" title="Mostrar/Ocultar Panel de Control">
            <i data-lucide="layout-grid"></i>
        </button>
        <div class="header-sub-separator"></div>
        <div class="tool-group" id="modeToggle"></div>
        <div class="header-sub-separator"></div>
        <button class="header-tool-btn" id="centerCanvasBtn" title="Recentrar Lienzo">
            <i data-lucide="focus"></i>
        </button>
        <div class="header-sub-spacing"></div>
        <div class="tool-separator"></div>
        <div class="tool-group" id="historyTools"></div>
        <div class="tool-separator"></div>
        <button class="btn-primary btn-pill" id="exportMainBtn">
            <i data-lucide="download"></i>
            <span data-i18n="export">EXPORTAR</span>
        </button>
    </div>
`;
