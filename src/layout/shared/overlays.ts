export const OverlaysHTML = `
    <!-- Dropdowns & Overlays -->
    <div class="settings-dropdown" id="settingsMenu">
        <div class="settings-header">CONFIGURACIÓN</div>
        <div class="panel-config-group" id="config-group"></div>
    </div>

    <div class="toast" id="toast">Firma copiada al portapapeles</div>

    <!-- Floating Advanced Color Picker -->
    <div id="advancedColorPicker" class="floating-window hidden">
        <div class="window-header">
            <span>Selector de Color Avanzado</span>
            <div class="header-actions">
                <button class="icon-btn" id="addFavoriteBtn" title="Añadir a favoritos">
                    <i data-lucide="star"></i>
                </button>
                <button class="close-btn" id="closeAdvancedPicker">
                    <i data-lucide="x"></i>
                </button>
            </div>
        </div>
        <div class="window-content">
            <div class="picker-main">
                <canvas id="colorCanvas" width="200" height="200"></canvas>
                <div id="colorCursor"></div>
            </div>
            <div class="picker-controls">
                <div class="hue-slider-container">
                    <input type="range" id="hueSlider" min="0" max="360" step="1" value="0">
                </div>

                <div class="favorites-section">
                    <span class="section-label">FAVORITOS</span>
                    <div id="advancedFavorites" class="favorites-grid">
                        <!-- Favorites dots injected here -->
                    </div>
                </div>

                <div class="rgb-inputs">
                    <div class="rgb-field">
                        <span>R</span>
                        <div class="custom-number-input">
                            <input type="number" id="rInput" min="0" max="255" value="255">
                            <div class="input-arrows">
                                <button class="arrow-up"><i data-lucide="chevron-up"></i></button>
                                <button class="arrow-down"><i data-lucide="chevron-down"></i></button>
                            </div>
                        </div>
                    </div>
                    <div class="rgb-field">
                        <span>G</span>
                        <div class="custom-number-input">
                            <input type="number" id="gInput" min="0" max="255" value="0">
                            <div class="input-arrows">
                                <button class="arrow-up"><i data-lucide="chevron-up"></i></button>
                                <button class="arrow-down"><i data-lucide="chevron-down"></i></button>
                            </div>
                        </div>
                    </div>
                    <div class="rgb-field">
                        <span>B</span>
                        <div class="custom-number-input">
                            <input type="number" id="bInput" min="0" max="255" value="0">
                            <div class="input-arrows">
                                <button class="arrow-up"><i data-lucide="chevron-up"></i></button>
                                <button class="arrow-down"><i data-lucide="chevron-down"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="hex-input-group">
                    <span>HEX</span>
                    <input type="text" id="hexInput" value="#FF0000">
                    <div id="currentColorPreview"></div>
                </div>
                <button id="applyAdvancedColor" class="apply-btn">Aplicar Color</button>
            </div>
        </div>
    </div>
`;
