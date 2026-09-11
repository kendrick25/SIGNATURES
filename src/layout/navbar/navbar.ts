export const NavbarHTML = `
    <div class="header-main-row">
        <div class="header-left">
            <div class="app-logo">
                <i data-lucide="feather" class="logo-icon"></i>
                <span class="logo-text">FIRMAS</span>
            </div>
        </div>

        <div class="header-center">
            <!-- Row is cleaner now -->
        </div>

        <div class="header-right">
            <div class="navbar-tools-group">
                <button class="navbar-tool-btn navbar-page-btn active" id="workspaceButton" data-page="workspace" title="Workspace">
                    <i data-lucide="layout-grid"></i>
                </button>
                <button class="navbar-tool-btn navbar-page-btn" id="converterButton" data-page="converter" title="Convertir imágenes">
                    <i data-lucide="image"></i>
                </button>
            </div>
            <button class="navbar-tool-btn" id="settingsToggle" title="Configuración">
                <i data-lucide="settings"></i>
            </button>
        </div>
    </div>
`;
