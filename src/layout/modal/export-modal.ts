export const ExportModalHTML = `
    <!-- Export Preview & Settings Modal -->
    <div id="exportModal" class="floating-window hidden">
        <div class="window-header" style="cursor: grab;">
            <div class="header-titles">
                <span class="panel-title-text" data-i18n="exportModalTitle">PREVISUALIZACIÓN Y AJUSTES</span>
            </div>
            <div class="header-actions">
                <button class="close-btn" id="closeExportModal">
                    <i data-lucide="x"></i>
                </button>
            </div>
        </div>
        <div class="window-content export-modal-content">
            <div class="export-preview-box">
                <div id="exportPreviewContainer">
                    <!-- High-res preview will be injected here -->
                </div>
                <div class="preview-info">
                    <span id="previewDimensions">836 x 400 PX</span>
                    <span id="previewFormat">PNG</span>
                </div>
            </div>

            <div class="export-settings-panel">
                <div class="export-settings-form">
                    <div class="panel-input-group">
                        <span class="panel-input-label" data-i18n="format">FORMATO</span>
                        <div class="export-format-selector" id="modalFormatSelector">
                            <button class="preset-btn active" data-format="PNG">PNG</button>
                            <button class="preset-btn" data-format="JPG">JPG</button>
                            <button class="preset-btn" data-format="WEBP">WEBP</button>
                            <button class="preset-btn" data-format="SVG">SVG</button>
                            <button class="preset-btn" data-format="BMP">BMP</button>
                            <button class="preset-btn" data-format="TIFF">TIFF</button>
                        </div>
                    </div>

                    <div class="panel-input-group">
                        <span class="panel-input-label" data-i18n="action">ACCIÓN</span>
                        <div class="export-action-selector" id="modalActionSelector">
                            <button class="preset-btn active" data-action="download" data-i18n="download">Descargar</button>
                            <button class="preset-btn" data-action="copy" data-i18n="copyImage">Copiar Imagen</button>
                            <button class="preset-btn" data-action="base64" data-i18n="copyBase64">Copiar Base64</button>
                        </div>
                    </div>

                    <div class="panel-input-group" id="modalQualityGroup">
                        <div class="panel-input-header">
                            <span class="panel-input-label" data-i18n="quality">CALIDAD</span>
                            <span id="modalQualityVal" class="panel-val-text">92%</span>
                        </div>
                        <input type="range" id="modalQualitySlider" min="10" max="100" step="1" value="92"
                            class="canvas-range">
                    </div>

                    <div class="panel-input-group" id="modalDpiGroup">
                        <span class="panel-input-label" data-i18n="dpi">DPI / RESOLUCIÓN</span>
                        <div class="dpi-presets">
                            <button class="preset-btn small-preset active" id="modalDpiDefault">DEFAULT</button>
                            <button class="preset-btn small-preset" data-dpi="CUSTOM" id="modalDpiCustom">EDIT</button>
                            <button class="preset-btn small-preset" data-dpi="HD">HD</button>
                            <button class="preset-btn small-preset" data-dpi="FHD">FHD</button>
                            <button class="preset-btn small-preset" data-dpi="4K">4K</button>
                        </div>
                        <div class="thickness-control" id="dpiControlWrapper" style="margin-top: 8px;">
                            <button class="scrub-btn" id="decModalDpi"><i data-lucide="minus"></i></button>
                            <div class="scrub-area" id="modalDpiScrubArea">
                                <input type="number" class="thickness-input" id="modalDpiVal" value="300" min="72"
                                    max="1200">
                                <span class="zoom-unit">DPI</span>
                            </div>
                            <button class="scrub-btn" id="incModalDpi"><i data-lucide="plus"></i></button>
                        </div>
                    </div>

                    <div class="panel-input-group">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                            <span class="panel-input-label" style="margin: 0;">RECORTAR FUERA DEL LIENZO</span>
                            <label class="switch-small">
                                <input type="checkbox" id="modalClipToggle" checked>
                                <span class="slider-small"></span>
                            </label>
                        </div>
                    </div>

                    <div class="panel-input-group">
                        <div class="panel-input-header">
                            <span class="panel-input-label small">MARGEN DE SEGURIDAD</span>
                            <span id="modalMarginVal" class="panel-val-text small">0px</span>
                        </div>
                        <input type="range" id="modalMarginSlider" min="0" max="200" step="5" value="0"
                            class="canvas-range small">
                    </div>

                    <div class="panel-input-group">
                        <div class="panel-input-header">
                            <span class="panel-input-label">ESCALA EXTRA</span>
                            <span id="modalScaleVal" class="panel-val-text">1x</span>
                        </div>
                        <input type="range" id="modalScaleSlider" min="1" max="10" step="0.5" value="1"
                            class="canvas-range">
                    </div>

                    <div class="panel-input-group" id="base64OutputGroup" style="flex-direction: column; opacity: 0.5;">
                        <span class="panel-input-label">BASE64 OUTPUT</span>
                        <textarea id="base64TextArea" readonly disabled class="base64-textarea" style="width: 100%; height: 100px; margin-top: 8px; font-size: 10px; font-family: monospace; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 6px; color: #fff; resize: none; cursor: not-allowed;"></textarea>
                    </div>
                </div>

                <div class="export-actions">
                    <button id="finalExportBtn" class="apply-btn">
                        <i data-lucide="download"></i>
                        <span id="finalBtnText" data-i18n="confirmExport">EXPORTAR AHORA</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
