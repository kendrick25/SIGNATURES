export const ConverterHTML = `
    <!-- Converter Page -->
    <div class="converter-page" id="converterPage">
        <div class="converter-container">
            <div class="converter-header">
                <h1 data-i18n="convertImages">CONVERTIR IMÁGENES</h1>
            </div>
            
            <div class="converter-content-single">
                <!-- Section 1: Image Upload -->
                <div class="converter-section" id="uploadSection">
                    <div class="section-header">
                        <h2>1. Selecciona las imágenes</h2>
                        <div class="upload-tabs">
                            <button class="upload-tab active" data-tab="files">Imágenes / Archivos</button>
                            <button class="upload-tab" data-tab="url">URL</button>
                            <button class="upload-tab" data-tab="text">Texto Base64</button>
                        </div>
                    </div>
                    
                    <div class="upload-content-wrapper">
                        <!-- File Upload Tab -->
                        <div class="upload-tab-content active" id="filesTab">
                            <div class="upload-area" id="uploadArea">
                                <input type="file" id="imageInput" multiple accept="image/*,.txt,.svg,.ico,.pdf" style="display: none;">
                                <div class="upload-box">
                                    <i data-lucide="upload-cloud" class="upload-icon"></i>
                                    <p data-i18n="dragAndDrop">Arrastra archivos (PNG, JPG, WEBP, BMP, TIFF, SVG, ICO, TXT, PDF) aquí o haz clic para seleccionar</p>
                                </div>
                            </div>
                        </div>

                        <!-- URL Input Tab -->
                        <div class="upload-tab-content" id="urlTab">
                            <div class="url-input-area-wrapper">
                                <div class="url-input-group">
                                    <i data-lucide="link" class="input-icon"></i>
                                    <input type="text" id="imageUrlInput" class="styled-input" placeholder="Pega la URL de la imagen aquí (ej: https://ejemplo.com/imagen.jpg)">
                                </div>
                                <button class="btn-process-url" id="btnProcessUrl">Procesar URL</button>
                            </div>
                        </div>

                        <!-- Text Input Tab -->
                        <div class="upload-tab-content" id="textTab">
                            <div class="base64-text-area-wrapper">
                                <textarea id="base64TextInput" class="styled-textarea" placeholder="Pega aquí el código Base64 (ej: data:image/png;base64,...)"></textarea>
                                <button class="btn-process-text" id="btnProcessText">Procesar Texto</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 2: Gallery & Rename -->
                <div class="converter-section" id="gallerySection">
                    <div class="section-header">
                        <h2>2. Previsualización y renombrado</h2>
                        <div class="filter-toggle-container">
                            <label class="toggle-switch small">
                                <input type="checkbox" id="enableColorFilter">
                                <span class="slider"></span>
                            </label>
                            <span class="filter-label" data-i18n="applyFilter">Habilitar filtro de color</span>
                        </div>
                    </div>

                    <!-- Filter Panel (hidden by default) -->
                    <div class="filter-panel hidden" id="colorFilterPanel">
                        <div class="panel-input-group">
                            <span class="panel-input-label" data-i18n="colorFilter">FILTRO DE COLOR</span>
                            <div class="color-picker" id="converterColorPicker"></div>
                        </div>
                    </div>
                    
                    <div class="mini-gallery" id="miniGallery">
                        <p class="empty-gallery" id="emptyGallery" data-i18n="noImages">No hay imágenes seleccionadas</p>
                    </div>
                </div>

                <!-- Section 3: Format Selection -->
                <div class="converter-section" id="formatSection">
                    <div class="section-header">
                        <h2>3. Selecciona formatos de conversión</h2>
                        <span class="section-status">Elige formatos y imágenes</span>
                    </div>
                    
                    <div class="format-and-images-layout">
                        <!-- Format Selection -->
                        <div class="format-selection-box">
                            <label class="section-label">Formato de salida:</label>
                            <div class="format-options" id="formatOptions">
                                <button class="format-btn" data-format="PNG" data-i18n="png">
                                    <i data-lucide="file-image"></i> PNG
                                </button>
                                <button class="format-btn" data-format="JPG" data-i18n="jpg">
                                    <i data-lucide="image"></i> JPG
                                </button>
                                <button class="format-btn" data-format="WEBP" data-i18n="webp">
                                    <i data-lucide="images"></i> WEBP
                                </button>
                                <button class="format-btn" data-format="BMP" data-i18n="bmp">
                                    <i data-lucide="file-output"></i> BMP
                                </button>
                                <button class="format-btn" data-format="TIFF" data-i18n="tiff">
                                    <i data-lucide="camera"></i> TIFF
                                </button>
                                <button class="format-btn" data-format="SVG" data-i18n="svg">
                                    <i data-lucide="code-2"></i> SVG
                                </button>
                                <button class="format-btn" data-format="ICO" data-i18n="ico">
                                    <i data-lucide="box"></i> ICO
                                </button>
                                <button class="format-btn" data-format="PDF" data-i18n="pdf">
                                    <i data-lucide="file-text"></i> PDF
                                </button>
                                <button class="format-btn" data-format="BASE64" data-i18n="base64">
                                    <i data-lucide="binary"></i> BASE64
                                </button>
                            </div>

                            <!-- Quality Slider for JPG -->
                            <div class="quality-group hidden" id="qualityGroup">
                                <label data-i18n="quality">Calidad JPG</label>
                                <div class="quality-slider">
                                    <input type="range" id="qualitySlider" min="0" max="100" value="85">
                                    <span id="qualityValue">85%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Image Selection -->
                        <div class="image-selection-box">
                            <label class="section-label">Imágenes a convertir:</label>
                            <div class="image-selection-list" id="imageSelectionList">
                                <p class="no-images-hint">Selecciona imágenes primero</p>
                            </div>
                            
                            <button class="btn-add-conversion" id="btnAddConversion" disabled>+ Agregar a conversiones</button>
                        </div>
                    </div>
                </div>

                <!-- Section 4: Conversions Queue -->
                <div class="converter-section" id="conversionsSection">
                    <div class="section-header">
                        <h2>4. Lista de conversiones planificadas</h2>
                    </div>
                    
                    <div class="conversions-list-area">
                        <div class="conversions-list" id="conversionsList">
                            <p class="no-conversions">No hay conversiones planificadas</p>
                        </div>
                        
                        <div class="conversion-list-actions">
                            <button class="btn-add-more-conversion" id="btnAddMoreConversion" disabled>+ Agregar otra conversión</button>
                        </div>
                    </div>
                </div>



                <!-- Actions -->
                <div class="converter-actions">
                    <div class="progress-inline-container" id="progressInlineContainer">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <p id="progressText" class="progress-text">0 / 0 archivos</p>
                    </div>
                    <button class="btn-cancel" id="btnCancel" data-i18n="cancel">CANCELAR</button>
                    <button class="btn-download" id="btnDownload" disabled>
                        <i data-lucide="download"></i> <span data-i18n="download">DESCARGAR</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
