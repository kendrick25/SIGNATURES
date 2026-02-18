export const PanelHTML = `
    <!-- Left Side Control Panel -->
    <div class="side-panel docked minimized" id="sidePanel" data-stored-width="320">
        <div class="side-panel-main">
            <div class="side-panel-header">
                <div class="panel-header-controls">
                    <div class="panel-title">
                        <span class="panel-title-text" data-i18n="panelTitle">PANEL DE CONTROL</span>
                    </div>
                </div>
                <div class="panel-header-spacing"></div>
            </div>

            <div class="side-panel-content">
                <div class="side-panel-scroll-container" id="sidePanelContent">
                    <!-- Group TRAZO -->
                    <div class="panel-group" id="groupStroke">
                        <div class="panel-row-header">
                            <span class="panel-group-title" data-i18n="stroke">TRAZO</span>
                            <div class="panel-group-actions">
                            </div>
                        </div>
                        <div class="panel-sub-group">
                            <div class="stroke-presets-container" id="strokeTypePresets"></div>
                            <div class="stroke-preview-container">
                                <span class="preview-label" data-i18n="preview">PREVISUALIZACIÓN</span>
                                <canvas id="strokePreviewCanvas"></canvas>
                            </div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="color">COLOR</span>
                                <div class="color-picker" id="colorPicker"></div>
                            </div>
                            <div class="panel-input-group">
                                <div
                                    style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                    <span class="panel-input-label" data-i18n="uniform" style="margin: 0;">TRAZO
                                        UNIFORME</span>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="uniformToggle">
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="panel-input-group">
                                <div class="panel-input-header">
                                    <span class="panel-input-label" data-i18n="smoothing">SUAVIZADO DE
                                        CURVAS</span>
                                    <span id="smoothingVal" class="panel-val-text">60%</span>
                                </div>
                                <input type="range" id="smoothingSlider" min="0" max="1" step="0.05" value="0.6"
                                    class="alpha-slider">
                            </div>
                            <div class="panel-input-group">
                                <div class="panel-input-header">
                                    <span class="panel-input-label" data-i18n="colorQuality">INTENSIDAD DE
                                        COLOR</span>
                                    <span id="colorQualityVal" class="panel-val-text">100%</span>
                                </div>
                                <input type="range" id="colorQualitySlider" min="0.5" max="2.0" step="0.1"
                                    value="1.0" class="alpha-slider">
                            </div>
                            <div class="panel-input-group">
                                <div class="panel-input-header">
                                    <span class="panel-input-label" data-i18n="opacity">OPACIDAD</span>
                                    <span id="alphaVal" class="panel-val-text">100%</span>
                                </div>
                                <input type="range" id="alphaSlider" min="0.1" max="1.0" step="0.05" value="1.0"
                                    class="alpha-slider">
                            </div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="thickness">GROSOR</span>
                                <div class="thickness-control">
                                    <button class="scrub-btn" id="decWidth"><i data-lucide="minus"></i></button>
                                    <div class="scrub-area" id="thicknessScrubArea">
                                        <input type="number" class="thickness-input" id="thicknessVal"
                                            value="2.5" step="0.1" min="0.1" max="20">
                                    </div>
                                    <button class="scrub-btn" id="incWidth"><i data-lucide="plus"></i></button>
                                </div>
                                <input type="range" id="thicknessSlider" min="0.1" max="20" step="0.1"
                                    value="2.5" class="thickness-slider">
                            </div>
                        </div>
                    </div>

                    <!-- Group TRANSFORMACIÓN -->
                    <div class="panel-group" id="groupTransform">
                        <div class="panel-row-header">
                            <span class="panel-group-title" data-i18n="transformation">TRANSFORMACIÓN</span>
                            <div class="panel-group-actions">
                            </div>
                        </div>
                        <div class="panel-sub-group">
                            <div class="transform-controls-grid">
                                <button class="btn-secondary btn-tool-square" id="rotateLeftBtn"
                                    title="Girar Izquierda" data-i18n-title="rotateL">
                                    <i data-lucide="rotate-ccw"></i>
                                </button>
                                <button class="btn-secondary btn-tool-square" id="rotateRightBtn"
                                    title="Girar Derecha" data-i18n-title="rotateR">
                                    <i data-lucide="rotate-cw"></i>
                                </button>
                                <button class="btn-secondary btn-tool-square" id="flipHBtn"
                                    title="Reflejo Horizontal" data-i18n-title="flipH">
                                    <i data-lucide="flip-horizontal"></i>
                                </button>
                                <button class="btn-secondary btn-tool-square" id="flipVBtn"
                                    title="Reflejo Vertical" data-i18n-title="flipV">
                                    <i data-lucide="flip-vertical"></i>
                                </button>
                            </div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="scale">ESCALAR</span>
                                <div class="thickness-control">
                                    <button class="scrub-btn" id="decScale"><i data-lucide="minus"></i></button>
                                    <div class="scrub-area" id="scaleScrubArea">
                                        <input type="number" class="thickness-input" id="scaleVal" value="100"
                                            step="1">
                                        <span class="zoom-unit">%</span>
                                    </div>
                                    <button class="scrub-btn" id="incScale"><i data-lucide="plus"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Group LIENZO -->
                    <div class="panel-group" id="groupCanvas">
                        <div class="panel-row-header">
                            <span class="panel-group-title" data-i18n="canvas">LIENZO</span>
                            <div class="panel-group-actions">
                            </div>
                        </div>
                        <div class="panel-sub-group">
                            <div class="panel-input-group">
                                <div
                                    style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                    <span class="panel-input-label" data-i18n="viewClipOutOfBounds"
                                        style="margin: 0;">RECORTAR FUERA DEL LIENZO</span>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="viewClipToggle" checked>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="panel-input-group">
                                <div
                                    style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                    <span class="panel-input-label" data-i18n="showGrid"
                                        style="margin: 0;">VER CUADRÍCULA</span>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gridToggle" checked>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="stroke-presets-container" id="canvasSizePresets"></div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="width">ANCHO</span>
                                <div class="thickness-control">
                                    <button class="scrub-btn" id="decCanvasWidth"><i
                                            data-lucide="minus"></i></button>
                                    <div class="scrub-area" id="widthScrubArea">
                                        <input type="number" class="thickness-input" id="canvasWidthVal"
                                            value="836" min="20">
                                    </div>
                                    <button class="scrub-btn" id="incCanvasWidth"><i
                                            data-lucide="plus"></i></button>
                                </div>
                                <input type="range" id="widthSlider" min="20" max="2000" step="10" value="836"
                                    class="canvas-range">
                            </div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="height">ALTO</span>
                                <div class="thickness-control">
                                    <button class="scrub-btn" id="decCanvasHeight"><i
                                            data-lucide="minus"></i></button>
                                    <div class="scrub-area" id="heightScrubArea">
                                        <input type="number" class="thickness-input" id="canvasHeightVal"
                                            value="400" min="20">
                                    </div>
                                    <button class="scrub-btn" id="incCanvasHeight"><i
                                            data-lucide="plus"></i></button>
                                </div>
                                <input type="range" id="heightSlider" min="20" max="1000" step="10" value="400"
                                    class="canvas-range">
                            </div>

                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="zoom">ZOOM</span>
                                <div class="thickness-control">
                                    <button class="scrub-btn" id="decZoom"><i data-lucide="minus"></i></button>
                                    <div class="scrub-area" id="zoomScrubArea">
                                        <input type="number" class="thickness-input" id="zoomVal" value="100"
                                            step="1" min="10" max="500">
                                        <span class="zoom-unit">%</span>
                                    </div>
                                    <button class="scrub-btn" id="incZoom"><i data-lucide="plus"></i></button>
                                </div>
                                <input type="range" id="zoomSlider" min="10" max="500" step="1" value="100"
                                    class="canvas-range">
                            </div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="backgroundColor">COLOR DE
                                    FONDO</span>
                                <div class="color-picker-container">
                                    <div class="color-picker" id="canvasBgPicker"></div>
                                    <div class="opacity-control">
                                        <span class="panel-input-label small">OPACIDAD</span>
                                        <input type="range" id="bgOpacitySlider" min="0" max="100" step="1"
                                            value="100" class="canvas-range small">
                                        <span id="bgOpacityVal" class="panel-val-text small">100%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="borderType">TIPO DE BORDE</span>
                                <div class="stroke-presets-container" id="borderTypePresets">
                                    <button class="preset-btn" data-border-type="solid"
                                        data-i18n="solid">Sólido</button>
                                    <button class="preset-btn" data-border-type="dashed"
                                        data-i18n="dashed">Guiones</button>
                                    <button class="preset-btn" data-border-type="dotted"
                                        data-i18n="dotted">Puntos</button>
                                    <button class="preset-btn active" data-border-type="none">None</button>
                                </div>
                            </div>
                            <div class="panel-input-group">
                                <span class="panel-input-label" data-i18n="borderColor">COLOR DE BORDE</span>
                                <div class="color-picker-container">
                                    <div class="color-picker" id="canvasBorderColorPicker"></div>
                                    <div class="opacity-control">
                                        <span class="panel-input-label small">OPACIDAD</span>
                                        <input type="range" id="borderOpacitySlider" min="0" max="100" step="1"
                                            value="100" class="canvas-range small">
                                        <span id="borderOpacityVal" class="panel-val-text small">100%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="panel-input-group">
                                <div class="panel-input-header">
                                    <span class="panel-input-label" data-i18n="borderRadius">RADIO DE
                                        BORDE</span>
                                    <div class="radius-unit-toggle">
                                        <span id="radiusVal" class="panel-val-text">0px</span>
                                        <div class="unit-btns" id="radiusUnitToggle">
                                            <button class="unit-btn active" data-unit="px">px</button>
                                            <button class="unit-btn" data-unit="%">%</button>
                                        </div>
                                    </div>
                                </div>
                                <input type="range" id="radiusSlider" min="0" max="100" step="1" value="0"
                                    class="canvas-range">
                            </div>
                            <div class="panel-input-group">
                                <div class="panel-input-header">
                                    <span class="panel-input-label" data-i18n="borderWidth">GROSOR DE
                                        BORDE</span>
                                    <span id="borderWidthVal" class="panel-val-text">1px</span>
                                </div>
                                <input type="range" id="borderWidthSlider" min="0" max="20" step="1" value="1"
                                    class="canvas-range">
                            </div>
                            <div class="panel-input-group" id="borderDashGroup">
                                <div class="panel-input-header">
                                    <span class="panel-input-label" data-i18n="borderSpacing">ESPACIADO DE
                                        BORDE</span>
                                    <span id="borderDashVal" class="panel-val-text">4px</span>
                                </div>
                                <input type="range" id="borderDashSlider" min="1" max="50" step="1" value="4"
                                    class="canvas-range" disabled>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Left Sidebar Resizer on its RIGHT -->
        <div class="panel-resizer" id="sidePanelResizer"></div>
    </div>
`;
