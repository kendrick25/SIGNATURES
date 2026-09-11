import { createIcons, renderColorPicker } from '@/scripts/data';
import JSZip from 'jszip';
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Set up PDF.js worker using unpkg as a more reliable fallback
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

interface SelectedImage {
    file: File;
    preview: string;
    originalPreview?: string;
    appliedFilterColor?: string;
    name: string;
    width: number;
    height: number;
    pageIndex?: number;
    sourceIsPdf?: boolean;
    sourceUrl?: string;
}

interface ConversionJob {
    id: string;
    format: string;
    imageIndices: number[];
    quality?: number;
    width?: number;
    height?: number;
    isProcessing?: boolean;
    progress?: number;
    selected?: boolean;
    pdfOptions?: {
        centerHorizontal: boolean;
        centerVertical: boolean;
        margin: number;
        pageSize: string;
        fitToPage: boolean;
        coverSpace: boolean;
    };
    base64Result?: string;
}

export class ImageConverter {
    private selectedImages: SelectedImage[] = [];
    private conversionJobs: ConversionJob[] = [];
    private quality = 85;
    private currentFormat: string | null = null;
    private conversionJobCounter = 0;
    private selectedImageIndices: Set<number> = new Set();
    private isFilterEnabled = false;
    private filterColor = '#ffffff';

    constructor() {
        this.init();
    }

    private init() {
        this.attachUploadHandlers();
        this.attachTabHandlers();
        this.attachFormatButtons();
        this.attachActionButtons();
        this.attachUrlHandlers();
        this.attachFilterHandlers();
        this.initializeIcons();
    }

    private initializeIcons() {
        setTimeout(() => {
            try {
                createIcons();
            } catch (e) {
                console.warn('Could not initialize icons:', e);
            }
        }, 0);
    }

    // ==================== UPLOAD HANDLERS ====================
    private attachUploadHandlers() {
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput') as HTMLInputElement;

        if (!uploadArea || !imageInput) return;

        uploadArea.addEventListener('click', () => imageInput.click());

        imageInput.addEventListener('change', (e) => {
            const input = e.target as HTMLInputElement;
            const files = Array.from(input.files || []);
            this.handleUploadedFiles(files);
            // Reset value to allow re-uploading the same file
            input.value = '';
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer?.files || []).filter(f =>
                f.type === 'application/pdf' ||
                f.type.startsWith('image/') ||
                f.name.toLowerCase().endsWith('.txt') ||
                f.name.toLowerCase().endsWith('.svg') ||
                f.name.toLowerCase().endsWith('.ico') ||
                f.name.toLowerCase().endsWith('.pdf')
            );
            this.handleUploadedFiles(files);
        });
    }

    private async handleUploadedFiles(files: File[]) {
        const imageFiles = files.filter(f => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.svg'));
        const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
        const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

        // Handle regular images including SVGs
        if (imageFiles.length > 0) {
            this.handleImageFiles(imageFiles);
        }

        // Handle PDF files
        if (pdfFiles.length > 0) {
            this.handlePdfFiles(pdfFiles);
        }

        // Handle text files
        for (const file of txtFiles) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                this.processBase64String(text, file.name.replace('.txt', ''));
            };
            reader.readAsText(file);
        }
    }

    private async processBase64String(base64: string, originalName: string = 'imported-b64') {
        const cleanBase64 = base64.trim();
        if (!cleanBase64) return;

        // Basic validation: check if it looks like a data URL or raw base64
        let dataUrl = cleanBase64;
        if (!cleanBase64.startsWith('data:image/')) {
            // Check if it's SVG XML
            if (cleanBase64.trim().startsWith('<svg')) {
                dataUrl = `data:image/svg+xml;base64,${btoa(cleanBase64)}`;
            } else {
                // Assume it might be raw base64 and try to wrap it (defaulting to PNG if unknown)
                dataUrl = `data:image/png;base64,${cleanBase64}`;
            }
        }

        const img = new Image();
        img.onload = () => {
            // Convert to a File object to keep it consistent with the existing system
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], originalName, { type: blob.type });
                    this.selectedImages.push({
                        file,
                        preview: dataUrl,
                        name: originalName,
                        width: img.width,
                        height: img.height
                    });
                    this.updateGallery();
                    this.updateImageSelectionList();
                });
        };
        img.onerror = () => {
            console.error('Invalid Base64 string');
            alert('El texto Base64 no es válido o no representa una imagen.');
        };
        img.src = dataUrl;
    }

    private attachTabHandlers() {
        const tabs = document.querySelectorAll('.upload-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');

                // Update buttons
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update content
                document.querySelectorAll('.upload-tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                if (targetTab === 'files') {
                    document.getElementById('filesTab')?.classList.add('active');
                } else if (targetTab === 'url') {
                    document.getElementById('urlTab')?.classList.add('active');
                } else {
                    document.getElementById('textTab')?.classList.add('active');
                }
            });
        });

        const btnProcessText = document.getElementById('btnProcessText');
        const textInput = document.getElementById('base64TextInput') as HTMLTextAreaElement;

        if (btnProcessText && textInput) {
            btnProcessText.addEventListener('click', () => {
                const text = textInput.value;
                if (text) {
                    this.processBase64String(text, `text-import-${Date.now()}`);
                    textInput.value = ''; // Clear after processing
                }
            });
        }
    }

    private attachUrlHandlers() {
        const btnProcessUrl = document.getElementById('btnProcessUrl');
        const urlInput = document.getElementById('imageUrlInput') as HTMLInputElement;

        if (btnProcessUrl && urlInput) {
            btnProcessUrl.addEventListener('click', () => {
                const url = urlInput.value.trim();
                if (url) {
                    this.processImageUrl(url);
                    urlInput.value = '';
                }
            });

            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const url = urlInput.value.trim();
                    if (url) {
                        this.processImageUrl(url);
                        urlInput.value = '';
                    }
                }
            });
        }
    }

    private async processImageUrl(url: string) {
        try {
            // Check if it's already a base64/data URL
            if (url.startsWith('data:')) {
                this.processBase64String(url, `url-import-${Date.now()}`);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous'; // Try to handle CORS
            img.onload = () => {
                // To avoid CORS issues when downloading/converting, we draw it to a canvas and get data URL
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    try {
                        const dataUrl = canvas.toDataURL('image/png');
                        const urlFilename = url.split('/').pop()?.split('?')[0] || `url-import-${Date.now()}`;

                        fetch(dataUrl)
                            .then(res => res.blob())
                            .then(blob => {
                                const file = new File([blob], urlFilename, { type: blob.type });
                                this.selectedImages.push({
                                    file,
                                    preview: dataUrl,
                                    name: urlFilename,
                                    width: img.width,
                                    height: img.height,
                                    sourceUrl: url
                                });
                                this.updateGallery();
                                this.updateImageSelectionList();
                            });
                    } catch (e) {
                        console.error('CORS error or invalid image data:', e);
                        alert('No se pudo procesar la imagen de la URL debido a restricciones de seguridad (CORS) o formato inválido.');
                    }
                }
            };
            img.onerror = () => {
                console.error('Failed to load image from URL:', url);
                alert('No se pudo cargar la imagen desde la URL proporcionada. Asegúrate de que la URL sea válida y accesible.');
            };
            img.src = url;
        } catch (err) {
            console.error('Error processing URL:', err);
            alert('Ocurrió un error al procesar la URL.');
        }
    }

    private async handleImageFiles(files: File[]) {
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = e.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    this.selectedImages.push({
                        file,
                        preview,
                        name: file.name,
                        width: img.width,
                        height: img.height
                    });
                    this.updateGallery();
                    this.updateImageSelectionList();
                };
                img.src = preview;
            };
            reader.readAsDataURL(file);
        }
    }

    async handlePdfFiles(files: File[]) {
        for (const file of files) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdfData = new Uint8Array(arrayBuffer);
                const pdf = await getDocument({ data: pdfData }).promise;

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 }); // High quality preview
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d')!;
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    await (page as any).render({ canvasContext: context, viewport }).promise;

                    const preview = canvas.toDataURL('image/png');
                    this.selectedImages.push({
                        file: file, // Keep the original file reference
                        preview,
                        name: pdf.numPages > 1 ? `${file.name} (Pág. ${i})` : file.name,
                        width: canvas.width,
                        height: canvas.height,
                        pageIndex: i - 1,
                        sourceIsPdf: true
                    });
                }
                this.updateGallery();
                this.updateImageSelectionList();
            } catch (err) {
                console.error('Detailed PDF processing error:', err);
                alert(`Error al procesar el PDF: ${file.name}. Ver consola para más detalles.`);
            }
        }
    }

    // ==================== GALLERY ====================
    private updateGallery() {
        const miniGallery = document.getElementById('miniGallery');

        if (!miniGallery) return;

        if (this.selectedImages.length === 0) {
            this.selectedImageIndices.clear();
            miniGallery.innerHTML = '<p class="empty-gallery" id="emptyGallery" data-i18n="noImages">No hay imágenes seleccionadas</p>';
            this.updateAddConversionButton();
            return;
        }

        const allChecked = this.selectedImages.length > 0 && this.selectedImageIndices.size === this.selectedImages.length;
        const hasSelection = this.selectedImageIndices.size > 0;

        let html = `
            <div class="gallery-controls-bar">
                <div class="gallery-select-all">
                    <label class="gallery-check-label">
                        <input type="checkbox" id="gallerySelectAll" class="styled-checkbox" ${allChecked ? 'checked' : ''}>
                        <span>Seleccionar todo</span>
                    </label>
                </div>
                <div class="gallery-bulk-actions">
                    <button id="deleteSelectedBtn" class="btn-bulk-delete ${hasSelection ? '' : 'hidden'}" title="Eliminar seleccionadas">
                        <i data-lucide="trash-2"></i> Eliminar (${this.selectedImageIndices.size})
                    </button>
                </div>
            </div>
            <div class="gallery-grid">
        `;

        html += this.selectedImages.map((img, idx) => {
            const lastDot = img.name.lastIndexOf('.');
            const ext = lastDot > 0 ? img.name.slice(lastDot + 1) : '';
            const base = lastDot > 0 ? img.name.slice(0, lastDot) : img.name;
            const isChecked = this.selectedImageIndices.has(idx);
            return `
            <div class="gallery-item ${isChecked ? 'selected' : ''}">
                <div class="gallery-item-check">
                    <input type="checkbox" class="gallery-image-checkbox styled-checkbox" data-index="${idx}" ${isChecked ? 'checked' : ''}>
                </div>
                <button class="btn-remove-overlay" data-index="${idx}" title="Eliminar">
                    <i data-lucide="trash-2"></i>
                </button>
                <img src="${img.preview}" alt="${img.name}">
                <div class="gallery-info">
                    <div class="gallery-name-section">
                        <input type="text" class="gallery-name-input" data-index="${idx}" data-ext="${ext}" value="${base}" placeholder="Nombre">
                        <span class="gallery-ext">${ext ? '.' + ext : ''}</span>
                    </div>
                </div>
            </div>
        `}).join('');

        html += '</div>';

        miniGallery.innerHTML = html;
        createIcons();

        // Rename listeners (only edit basename; extension kept)
        document.querySelectorAll('.gallery-name-input').forEach(input => {
            (input as HTMLInputElement).addEventListener('change', (e) => {
                const el = e.target as HTMLInputElement;
                const index = parseInt(el.getAttribute('data-index')!);
                const ext = el.getAttribute('data-ext') || '';
                const newBase = el.value.trim();
                if (!newBase || !this.selectedImages[index]) return;

                // Preserve extension and update model
                this.selectedImages[index].name = ext ? `${newBase}.${ext}` : newBase;

                // Keep all UI pieces in sync
                this.updateImageSelectionList();
                this.updateConversionsList();
            });
        });

        // Remove listeners
        document.querySelectorAll('.btn-remove-overlay').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = e.currentTarget as HTMLElement;
                const index = parseInt(target.getAttribute('data-index')!);
                this.selectedImages.splice(index, 1);
                this.selectedImageIndices.delete(index);
                // Adjust remaining indices
                const newIndices = new Set<number>();
                this.selectedImageIndices.forEach(idx => {
                    if (idx < index) newIndices.add(idx);
                    else if (idx > index) newIndices.add(idx - 1);
                });
                this.selectedImageIndices = newIndices;

                this.updateGallery();
                this.updateImageSelectionList();
            });
        });

        // Gallery checkboxes
        document.querySelectorAll('.gallery-image-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const cb = e.target as HTMLInputElement;
                const idx = parseInt(cb.getAttribute('data-index')!);
                if (cb.checked) {
                    this.selectedImageIndices.add(idx);
                } else {
                    this.selectedImageIndices.delete(idx);
                }
                this.updateGallery(); // Re-render to update selected classes
                this.updateImageSelectionList();
                this.updateAddConversionButton();
                this.updateBase64Availability();
            });
        });

        // Gallery Select All
        const selectAll = document.getElementById('gallerySelectAll') as HTMLInputElement;
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                if (selectAll.checked) {
                    this.selectedImages.forEach((_, idx) => this.selectedImageIndices.add(idx));
                } else {
                    this.selectedImageIndices.clear();
                }
                this.updateGallery();
                this.updateImageSelectionList();
                this.updateAddConversionButton();
                this.updateBase64Availability();
            });
        }

        // Delete Selected
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const sortedIndices = Array.from(this.selectedImageIndices).sort((a, b) => b - a);
                sortedIndices.forEach(idx => {
                    this.selectedImages.splice(idx, 1);
                });
                this.selectedImageIndices.clear();
                this.updateGallery();
                this.updateImageSelectionList();
                this.updateAddConversionButton();
                this.updateBase64Availability();
            });
        }
    }

    private attachFilterHandlers() {
        const toggle = document.getElementById('enableColorFilter') as HTMLInputElement;
        const panel = document.getElementById('colorFilterPanel');

        if (toggle && panel) {
            toggle.addEventListener('change', () => {
                this.isFilterEnabled = toggle.checked;
                panel.classList.toggle('hidden', !this.isFilterEnabled);

                if (this.isFilterEnabled) {
                    renderColorPicker('converterColorPicker');
                    this.refreshAllFilters();
                } else {
                    this.resetImagesToOriginal();
                }
            });
        }
    }

    public updateFilterColor(color: string) {
        this.filterColor = color;
        // Only apply to selected if filter is enabled
        if (this.isFilterEnabled) {
            this.applyFilterToSelected();
        }
    }

    private async refreshAllFilters() {
        if (!this.isFilterEnabled) return;
        
        let changed = false;
        for (const img of this.selectedImages) {
            if (img.appliedFilterColor) {
                if (!img.originalPreview) img.originalPreview = img.preview;
                img.preview = await this.applyColorFilter(img.originalPreview!, img.appliedFilterColor);
                changed = true;
            }
        }
        if (changed) {
            this.updateGallery();
        }
    }

    private async applyFilterToSelected() {
        if (!this.isFilterEnabled) return;

        const indicesToFilter = this.selectedImageIndices.size > 0 
            ? Array.from(this.selectedImageIndices) 
            : [];

        if (indicesToFilter.length === 0) return;

        for (const idx of indicesToFilter) {
            const img = this.selectedImages[idx];
            if (!img) continue;

            if (!img.originalPreview) {
                img.originalPreview = img.preview;
            }
            img.appliedFilterColor = this.filterColor;
            img.preview = await this.applyColorFilter(img.originalPreview!, this.filterColor);
        }
        this.updateGallery();
    }

    private resetImagesToOriginal() {
        for (const img of this.selectedImages) {
            if (img.originalPreview) {
                img.preview = img.originalPreview;
            }
        }
        this.updateGallery();
    }

    private applyColorFilter(dataUrl: string, color: string): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(dataUrl);
                    return;
                }

                ctx.drawImage(img, 0, 0);

                // Tint logic
                ctx.globalCompositeOperation = 'source-in';
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    // ==================== FORMAT SELECTION ====================
    private attachFormatButtons() {
        const formatBtns = document.querySelectorAll('#formatOptions .format-btn');
        formatBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const format = (e.target as HTMLElement).getAttribute('data-format');
                if (format) {
                    this.selectFormat(format);
                }
            });
        });
    }

    private selectFormat(format: string) {
        // Update UI
        document.querySelectorAll('#formatOptions .format-btn').forEach(btn => {
            btn.classList.remove('selected', 'active');
        });

        const selectedBtn = document.querySelector(`#formatOptions .format-btn[data-format="${format}"]`);
        if (selectedBtn) selectedBtn.classList.add('selected', 'active');

        this.currentFormat = format;

        // Show/hide quality slider
        const qualityGroup = document.getElementById('qualityGroup');
        if (qualityGroup) {
            qualityGroup.classList.toggle('hidden', format !== 'JPG');
        }

        this.updateImageSelectionList();
        this.updateAddConversionButton();
    }

    private updateImageSelectionList() {
        const listContainer = document.getElementById('imageSelectionList');
        if (!listContainer) return;
        // If no images are loaded, ensure BASE64 state is updated and exit
        if (this.selectedImages.length === 0) {
            this.updateBase64Availability();
            listContainer.innerHTML = '<p class="no-images-hint">Selecciona imágenes primero</p>';
            return;
        }

        const allChecked = this.selectedImageIndices.size === this.selectedImages.length;

        let html = `
            <div class="selection-header-all">
                <label class="image-selection-item select-all-label">
                    <input type="checkbox" id="selectAllImages" class="styled-checkbox" ${allChecked ? 'checked' : ''}>
                    <span class="select-all-text">Seleccionar todo (${this.selectedImages.length})</span>
                </label>
            </div>
            <div class="selection-items-scroll">
        `;

        html += this.selectedImages.map((img, idx) => {
            const lastDot = img.name.lastIndexOf('.');
            const ext = lastDot > 0 ? img.name.slice(lastDot + 1) : '';
            const base = lastDot > 0 ? img.name.slice(0, lastDot) : img.name;
            const isChecked = this.selectedImageIndices.has(idx);
            return `
            <label class="image-selection-item">
                <input type="checkbox" class="image-checkbox styled-checkbox" data-index="${idx}" ${isChecked ? 'checked' : ''}>
                <div class="input-group-row" style="display: flex; align-items: center; flex: 1; gap: 8px;">
                    <input type="text" class="selection-name-input styled-input" data-index="${idx}" data-ext="${ext}" value="${base}" style="flex: 1;">
                    <span class="selection-ext">${ext ? '.' + ext : ''}</span>
                </div>
            </label>
        `}).join('');

        html += '</div>';

        listContainer.innerHTML = html;

        // Select All handler
        const selectAllCb = document.getElementById('selectAllImages') as HTMLInputElement;
        if (selectAllCb) {
            selectAllCb.addEventListener('change', () => {
                const checked = selectAllCb.checked;
                if (checked) {
                    this.selectedImages.forEach((_, idx) => this.selectedImageIndices.add(idx));
                } else {
                    this.selectedImageIndices.clear();
                }
                this.updateImageSelectionList();
                this.updateAddConversionButton();
                this.updateBase64Availability();
            });
        }

        // checkboxes: enable/disable add button and update BASE64 availability
        document.querySelectorAll('.image-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const cb = e.target as HTMLInputElement;
                const idx = parseInt(cb.getAttribute('data-index')!);
                if (cb.checked) {
                    this.selectedImageIndices.add(idx);
                } else {
                    this.selectedImageIndices.delete(idx);
                }

                // Update Select All checkbox state without re-rendering everything
                if (selectAllCb) {
                    selectAllCb.checked = this.selectedImageIndices.size === this.selectedImages.length;
                    document.querySelector('.select-all-text')!.textContent = `Seleccionar todo (${this.selectedImages.length})`;
                }

                this.updateAddConversionButton();
                this.updateBase64Availability();
            });
        });

        // allow rename from the selection list too (preserve extension)
        document.querySelectorAll('.selection-name-input').forEach(input => {
            (input as HTMLInputElement).addEventListener('change', (e) => {
                const el = e.target as HTMLInputElement;
                const idx = parseInt(el.getAttribute('data-index')!);
                const ext = el.getAttribute('data-ext') || '';
                const base = el.value.trim();
                if (!base || !this.selectedImages[idx]) return;
                this.selectedImages[idx].name = ext ? `${base}.${ext}` : base;
                // sync UI
                this.updateGallery();
                this.updateConversionsList();
            });
        });

        // Make sure BASE64 button state reflects current selection
        this.updateBase64Availability();
    }

    private updateAddConversionButton() {
        const btn = document.getElementById('btnAddConversion') as HTMLButtonElement;
        if (!btn) return;

        const hasFormat = !!this.currentFormat;
        const selectedImages = this.selectedImageIndices.size > 0;

        btn.disabled = !(hasFormat && selectedImages);
    }

    // Disable/enable the BASE64 format button depending on how many images are selected
    private updateBase64Availability() {
        const base64Btn = document.querySelector('#formatOptions .format-btn[data-format="BASE64"]') as HTMLButtonElement | null;
        if (!base64Btn) return;

        // Removed restriction: BASE64 now allows multiple images by creating individual jobs
        base64Btn.disabled = false;
    }

    // ==================== CONVERSION JOBS ====================
    private addConversionJob() {
        if (!this.currentFormat) {
            alert('Selecciona un formato');
            return;
        }

        const selectedIndices = Array.from(this.selectedImageIndices).sort((a, b) => a - b);

        if (selectedIndices.length === 0) {
            alert('Selecciona al menos una imagen');
            return;
        }

        if (this.currentFormat === 'BASE64') {
            // Create a separate job for each selected image
            selectedIndices.forEach(idx => {
                const jobId = `job-${++this.conversionJobCounter}`;
                const job: ConversionJob = {
                    id: jobId,
                    format: 'BASE64',
                    imageIndices: [idx],
                    isProcessing: true,
                    progress: 0,
                    selected: true
                };
                this.conversionJobs.push(job);
                this.generateBase64Data(jobId);
            });
        } else {
            // Normal behavior for other formats (one job for multiple images)
            const jobId = `job-${++this.conversionJobCounter}`;
            const firstImg = this.selectedImages[selectedIndices[0]];
            const job: ConversionJob = {
                id: jobId,
                format: this.currentFormat,
                imageIndices: selectedIndices,
                quality: this.currentFormat === 'JPG' ? this.quality : undefined,
                width: firstImg?.width,
                height: firstImg?.height,
                selected: true,
                pdfOptions: this.currentFormat === 'PDF' ? {
                    pageSize: (firstImg?.sourceIsPdf) ? 'Original' : 'A4',
                    margin: (firstImg?.sourceIsPdf) ? 0 : 20,
                    centerHorizontal: !(firstImg?.sourceIsPdf),
                    centerVertical: !(firstImg?.sourceIsPdf),
                    fitToPage: !(firstImg?.sourceIsPdf),
                    coverSpace: false
                } : undefined
            };
            this.conversionJobs.push(job);
        }

        this.selectedImageIndices.clear();
        this.updateConversionsList();

        // Reset format selection
        this.currentFormat = null;
        document.querySelectorAll('#formatOptions .format-btn').forEach(btn => {
            btn.classList.remove('selected', 'active');
        });

        document.getElementById('qualityGroup')?.classList.add('hidden');
        this.updateImageSelectionList();
    }

    private async getBase64Data(image: SelectedImage): Promise<string> {
        try {
            // If it's a PDF, extract exactly that page as its own PDF
            if (image.sourceIsPdf) {
                const pdfBytes = await image.file.arrayBuffer();
                const srcDoc = await PDFDocument.load(pdfBytes);
                const singlePageDoc = await PDFDocument.create();

                const pageIdx = image.pageIndex !== undefined ? image.pageIndex : 0;
                const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [pageIdx]);
                singlePageDoc.addPage(copiedPage);

                return await singlePageDoc.saveAsBase64({ dataUri: true });
            }

            // Regular image or already a data URL
            if (image.preview.startsWith('data:')) {
                return image.preview;
            } else {
                // Convert blob URL to data URL
                const response = await fetch(image.preview);
                const blob = await response.blob();
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }
        } catch (err) {
            console.error('Error in getBase64Data:', err);
            return image.preview; // Fallback
        }
    }

    private async generateBase64Data(jobId: string) {
        const job = this.conversionJobs.find(j => j.id === jobId);
        if (!job) return;

        const results: string[] = [];
        for (const idx of job.imageIndices) {
            const img = this.selectedImages[idx];
            if (!img) continue;

            try {
                const b64 = await this.getBase64Data(img);
                results.push(b64);

                // Update progress incrementally
                const currentIdx = job.imageIndices.indexOf(idx);
                job.progress = ((currentIdx + 1) / job.imageIndices.length) * 100;
                this.updateConversionsList();
            } catch (err) {
                console.error('Error al generar Base64:', err);
                results.push('Error al generar Base64');
            }
        }

        job.base64Result = results.join('\n\n---\n\n');
        job.progress = 100;
        job.isProcessing = false;
        this.updateConversionsList();
    }

    private updateConversionsList() {
        const conversionsList = document.getElementById('conversionsList');
        if (!conversionsList) return;

        if (this.conversionJobs.length === 0) {
            conversionsList.innerHTML = '<p class="no-conversions">No hay conversiones planificadas</p>';
            (document.getElementById('btnDownload') as HTMLButtonElement).disabled = true;
            return;
        }

        const allSelected = this.conversionJobs.every(j => j.selected);
        const headerHtml = `
            <div class="conversions-header-selection">
                <label class="custom-checkbox selection-checkbox">
                    <input type="checkbox" id="selectAllConversions" ${allSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <span class="selection-text">Seleccionar todo (Planificadas)</span>
            </div>
        `;

        const listHtml = this.conversionJobs.map((job) => {
            const isBase64 = job.format === 'BASE64';
            const isSVG = job.format === 'SVG';
            let base64Content = '';
            if (isBase64) {
                base64Content = job.base64Result || '';
                // Fallback while generating if not available yet but single image
                if (!base64Content && job.imageIndices.length === 1) {
                    const img = this.selectedImages[job.imageIndices[0]];
                    if (img) base64Content = img.preview;
                }
            }

            return `
            <div class="conversion-item ${job.selected ? 'selected' : ''}">
                <div class="conversion-item-header">
                    <label class="custom-checkbox item-selection-checkbox">
                        <input type="checkbox" class="job-checkbox" data-job-id="${job.id}" ${job.selected ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                    <span class="conversion-format">${job.format}</span>
                    <span class="conversion-count">${job.imageIndices.length} imagen(es)</span>
                    <button class="btn-remove-conversion" data-job-id="${job.id}">✕</button>
                </div>
                <div class="conversion-item-images">
                    ${job.imageIndices.map(idx => `<span>${this.selectedImages[idx]?.name || '—'}</span>`).join(', ')}
                </div>
                ${!isBase64 && !isSVG && job.format !== 'PDF' ? `
                <div class="conversion-item-dimensions">
                    <div class="dimension-input-group">
                        <label>Ancho:</label>
                        <input type="number" class="dimension-input width-input" data-job-id="${job.id}" value="${job.width || ''}" placeholder="Ancho">
                    </div>
                    <div class="dimension-input-group">
                        <label>Alto:</label>
                        <input type="number" class="dimension-input height-input" data-job-id="${job.id}" value="${job.height || ''}" placeholder="Alto">
                    </div>
                    <span class="dimension-hint">px</span>
                </div>
                ` : ''}
                ${job.format === 'PDF' && job.pdfOptions ? `
                <div class="conversion-item-pdf-options">
                    <div class="pdf-options-row">
                        <div class="pdf-option-group">
                            <label>Tamaño:</label>
                            <select class="pdf-select page-size-select" data-job-id="${job.id}">
                                <option value="A4" ${job.pdfOptions.pageSize === 'A4' ? 'selected' : ''}>A4</option>
                                <option value="Letter" ${job.pdfOptions.pageSize === 'Letter' ? 'selected' : ''}>Carta (Letter)</option>
                                <option value="Legal" ${job.pdfOptions.pageSize === 'Legal' ? 'selected' : ''}>Legal</option>
                                <option value="Original" ${job.pdfOptions.pageSize === 'Original' ? 'selected' : ''}>Original (DPI)</option>
                            </select>
                        </div>
                        <div class="pdf-option-group">
                            <label>Margen:</label>
                            <input type="number" class="pdf-input margin-input" data-job-id="${job.id}" value="${job.pdfOptions.margin}" min="0" max="100">
                        </div>
                    </div>
                    <div class="pdf-options-row wrap">
                        <label class="pdf-check-label" title="Centrar horizontalmente">
                            <input type="checkbox" class="pdf-checkbox center-h-check" data-job-id="${job.id}" ${job.pdfOptions.centerHorizontal ? 'checked' : ''}>
                            <i data-lucide="align-center-horizontal"></i> <span>H</span>
                        </label>
                        <label class="pdf-check-label" title="Centrar verticalmente">
                            <input type="checkbox" class="pdf-checkbox center-v-check" data-job-id="${job.id}" ${job.pdfOptions.centerVertical ? 'checked' : ''}>
                            <i data-lucide="align-center-vertical"></i> <span>V</span>
                        </label>
                        <label class="pdf-check-label" title="Redimensionar para ajustar">
                            <input type="checkbox" class="pdf-checkbox fit-check" data-job-id="${job.id}" ${job.pdfOptions.fitToPage ? 'checked' : ''}>
                            <i data-lucide="maximize-2"></i> <span>Ajustar</span>
                        </label>
                        <label class="pdf-check-label" title="Abarcar todo el espacio">
                            <input type="checkbox" class="pdf-checkbox cover-check" data-job-id="${job.id}" ${job.pdfOptions.coverSpace ? 'checked' : ''}>
                            <i data-lucide="copy"></i> <span>Cubrir</span>
                        </label>
                    </div>
                </div>
                ` : ''}
                ${isBase64 ? (job.isProcessing ? `
                <div class="conversion-progress-inline">
                    <div class="progress-bar-small">
                        <div class="progress-fill" style="width: ${job.progress || 0}%"></div>
                    </div>
                    <span class="processing-text">Generando Base64... ${Math.round(job.progress || 0)}%</span>
                </div>
                ` : `
                <div class="conversion-base64-area">
                    <textarea class="inline-base64-textarea" readonly>${base64Content}</textarea>
                    <button class="btn-copy-inline">
                        <i data-lucide="copy"></i> Copiar Base64
                    </button>
                </div>
                `) : ''}
            </div>
        `}).join('');

        conversionsList.innerHTML = headerHtml + '<div class="conversions-items-container">' + listHtml + '</div>';
        createIcons();

        // Update progress bar preview based ONLY on selected jobs
        const selectedJobs = this.conversionJobs.filter(j => j.selected);
        const totalItems = selectedJobs.reduce((acc, job) => acc + job.imageIndices.length, 0);
        const progressText = document.getElementById('progressText');
        const progressFill = document.getElementById('progressFill') as HTMLElement;
        if (progressText) {
            progressText.textContent = `${totalItems} / ${totalItems} archivos`;
        }
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        // Update Download button state
        (document.getElementById('btnDownload') as HTMLButtonElement).disabled = selectedJobs.length === 0;

        // Select All listener
        const selectAllCb = document.getElementById('selectAllConversions') as HTMLInputElement;
        if (selectAllCb) {
            selectAllCb.addEventListener('change', () => {
                const checked = selectAllCb.checked;
                this.conversionJobs.forEach(j => j.selected = checked);
                this.updateConversionsList();
            });
        }

        // Individual job checkbox listeners
        document.querySelectorAll('.job-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const el = e.target as HTMLInputElement;
                const jobId = el.getAttribute('data-job-id');
                const job = this.conversionJobs.find(j => j.id === jobId);
                if (job) {
                    job.selected = el.checked;
                    this.updateConversionsList();
                }
            });
        });

        document.querySelectorAll('.btn-remove-conversion').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = (e.currentTarget as HTMLElement).getAttribute('data-job-id');
                this.conversionJobs = this.conversionJobs.filter(j => j.id !== jobId);
                this.updateConversionsList();
            });
        });

        // Dimension inputs listeners
        document.querySelectorAll('.dimension-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const el = e.target as HTMLInputElement;
                const jobId = el.getAttribute('data-job-id');
                let value = parseInt(el.value);
                const job = this.conversionJobs.find(j => j.id === jobId);

                if (job) {
                    const firstImg = this.selectedImages[job.imageIndices[0]];
                    if (el.classList.contains('width-input')) {
                        if (isNaN(value) || value <= 0) {
                            value = firstImg?.width || 0;
                            el.value = value.toString();
                        }
                        job.width = value;
                    } else {
                        if (isNaN(value) || value <= 0) {
                            value = firstImg?.height || 0;
                            el.value = value.toString();
                        }
                        job.height = value;
                    }
                }
            });
        });

        // PDF inputs listeners
        document.querySelectorAll('.pdf-checkbox, .pdf-select, .pdf-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const el = e.target as HTMLInputElement | HTMLSelectElement;
                const jobId = el.getAttribute('data-job-id');
                const job = this.conversionJobs.find(j => j.id === jobId);
                if (job && job.pdfOptions) {
                    if (el.classList.contains('center-h-check')) job.pdfOptions.centerHorizontal = (el as HTMLInputElement).checked;
                    else if (el.classList.contains('center-v-check')) job.pdfOptions.centerVertical = (el as HTMLInputElement).checked;
                    else if (el.classList.contains('fit-check')) job.pdfOptions.fitToPage = (el as HTMLInputElement).checked;
                    else if (el.classList.contains('cover-check')) job.pdfOptions.coverSpace = (el as HTMLInputElement).checked;
                    else if (el.classList.contains('margin-input')) job.pdfOptions.margin = parseInt(el.value) || 0;
                    else if (el.classList.contains('page-size-select')) job.pdfOptions.pageSize = el.value;

                    this.updateConversionsList();
                }
            });
        });

        // Copy BASE64 for a specific conversion job (inline)
        document.querySelectorAll('.btn-copy-inline').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget as HTMLButtonElement;
                const area = button.closest('.conversion-base64-area');
                const textArea = area?.querySelector('textarea') as HTMLTextAreaElement;
                if (!textArea) return;

                const base64Output = textArea.value;

                try {
                    await navigator.clipboard.writeText(base64Output);
                    const originalHTML = button.innerHTML;
                    button.innerHTML = '<i data-lucide="check"></i> COPIADO';
                    createIcons();
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                        createIcons();
                    }, 2000);
                } catch (err) {
                    console.error(err);
                    textArea.select();
                }
            });
        });

        (document.getElementById('btnDownload') as HTMLButtonElement).disabled = this.conversionJobs.length === 0;
    }

    // ==================== EXECUTION ====================
    private async executeConversions() {
        if (this.conversionJobs.length === 0) {
            alert('No hay conversiones para ejecutar');
            return;
        }

        const selectedJobs = this.conversionJobs.filter(j => j.selected);
        if (selectedJobs.length === 0) {
            alert('Por favor, selecciona al menos una conversión de la lista');
            return;
        }

        const zip = new JSZip();
        const downloadedFiles: { name: string; blob: Blob }[] = [];

        // Count total individual images across all SELECTED jobs for progress tracking
        const totalItems = selectedJobs.reduce((acc, job) => acc + job.imageIndices.length, 0);
        let processedCount = 0;

        for (const job of selectedJobs) {
            job.isProcessing = true;
            job.progress = 0;
            this.updateConversionsList();

            for (const imgIdx of job.imageIndices) {
                const image = this.selectedImages[imgIdx];
                if (!image) {
                    processedCount++;
                    continue;
                }

                const filename = image.name.split('.')[0];

                if (job.format === 'BASE64') {
                    // Handle BASE64 as .txt file
                    const b64Data = job.base64Result || await this.getBase64Data(image);
                    const blob = new Blob([b64Data], { type: 'text/plain' });
                    downloadedFiles.push({
                        name: `${filename}.txt`,
                        blob
                    });
                } else if (job.format === 'SVG') {
                    // Handle SVG export
                    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${image.file.size}" height="${image.file.size}" viewBox="0 0 100 100">
                        <image href="${image.preview}" width="100%" height="100%" />
                    </svg>`;
                    const blob = new Blob([svgString], { type: 'image/svg+xml' });
                    downloadedFiles.push({
                        name: `${filename}.svg`,
                        blob
                    });
                } else if (job.format === 'PDF') {
                    // Handle PDF export
                    const pdfDoc = await PDFDocument.create();
                    const options = job.pdfOptions || {
                        centerHorizontal: true,
                        centerVertical: true,
                        margin: 20,
                        pageSize: 'A4',
                        fitToPage: true,
                        coverSpace: false
                    };

                    const isPdf = !!image.sourceIsPdf;
                    let imgBytes;
                    let pdfObject: any;

                    if (isPdf) {
                        imgBytes = await image.file.arrayBuffer();
                        const pageIdx = image.pageIndex !== undefined ? image.pageIndex : 0;
                        const [embeddedPage] = await pdfDoc.embedPdf(imgBytes, [pageIdx]);
                        pdfObject = embeddedPage;
                    } else {
                        imgBytes = await image.file.arrayBuffer();
                        const isJpg = image.file.type === 'image/jpeg' || image.name.toLowerCase().endsWith('.jpg') || image.name.toLowerCase().endsWith('.jpeg');

                        try {
                            if (this.isFilterEnabled) {
                                // If filter is enabled, embed the filtered preview (PNG)
                                const response = await fetch(image.preview);
                                const filteredBytes = await response.arrayBuffer();
                                pdfObject = await pdfDoc.embedPng(filteredBytes);
                            } else if (isJpg) {
                                pdfObject = await pdfDoc.embedJpg(imgBytes);
                            } else {
                                // Try PNG, if fail try JPG (sometimes extensions are wrong)
                                try {
                                    pdfObject = await pdfDoc.embedPng(imgBytes);
                                } catch {
                                    pdfObject = await pdfDoc.embedJpg(imgBytes);
                                }
                            }
                        } catch (e) {
                            console.error('Error embedding image in PDF:', e);
                            // Fallback: draw to canvas and then embed
                            const canvas = await this.imageToCanvas(image.file, undefined, undefined, (isPdf || this.isFilterEnabled) ? image.preview : undefined);
                            const dataUrl = canvas.toDataURL('image/png');
                            const fallbackBytes = await (await fetch(dataUrl)).arrayBuffer();
                            pdfObject = await pdfDoc.embedPng(fallbackBytes);
                        }
                    }

                    // Define page sizes in points (72 points per inch)
                    const pageSizes: { [key: string]: [number, number] } = {
                        'A4': [595.28, 841.89],
                        'Letter': [612, 792],
                        'Legal': [612, 1008]
                    };

                    let pageWidth, pageHeight;
                    if (options.pageSize === 'Original') {
                        // Assuming 72 DPI if we can't detect it, or use image size
                        pageWidth = pdfObject.width;
                        pageHeight = pdfObject.height;
                    } else {
                        [pageWidth, pageHeight] = pageSizes[options.pageSize] || pageSizes['A4'];
                    }

                    const page = pdfDoc.addPage([pageWidth, pageHeight]);

                    const dpi = isPdf ? 72 : this.getImageDPI(imgBytes, image.file.type);
                    const scaleFactor = 72 / dpi;

                    let imgWidth = pdfObject.width * scaleFactor;
                    let imgHeight = pdfObject.height * scaleFactor;

                    if (options.coverSpace) {
                        const scale = Math.max(pageWidth / imgWidth, pageHeight / imgHeight);
                        imgWidth *= scale;
                        imgHeight *= scale;
                    } else if (options.fitToPage) {
                        const maxWidth = pageWidth - (options.margin * 2);
                        const maxHeight = pageHeight - (options.margin * 2);
                        const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
                        imgWidth *= scale;
                        imgHeight *= scale;
                    }

                    let x = options.margin;
                    let y = pageHeight - imgHeight - options.margin;

                    if (options.centerHorizontal) {
                        x = (pageWidth - imgWidth) / 2;
                    }
                    if (options.centerVertical) {
                        y = (pageHeight - imgHeight) / 2;
                    }

                    if (isPdf) {
                        page.drawPage(pdfObject, {
                            x, y,
                            width: imgWidth,
                            height: imgHeight,
                        });
                    } else {
                        page.drawImage(pdfObject, {
                            x, y,
                            width: imgWidth,
                            height: imgHeight,
                        });
                    }

                    const pdfBytes = await pdfDoc.save();
                    const blob = new Blob([pdfBytes.buffer as any], { type: 'application/pdf' });
                    downloadedFiles.push({
                        name: `${filename}.pdf`,
                        blob
                    });
                } else {
                    // Handle regular formats via canvas
                    const isPdfInput = !!image.sourceIsPdf;
                    const usePreview = isPdfInput || this.isFilterEnabled;
                    const canvas = await this.imageToCanvas(image.file, job.width, job.height, usePreview ? image.preview : undefined);
                    const newFileName = this.getFileName(filename, job.format);
                    const mimeType = this.getMimeType(job.format);

                    try {
                        let exportCanvasForBlob: HTMLCanvasElement = canvas;
                        if (mimeType === 'image/jpeg') {
                            const tmp = document.createElement('canvas');
                            tmp.width = canvas.width;
                            tmp.height = canvas.height;
                            const tctx = tmp.getContext('2d')!;
                            tctx.fillStyle = '#fff';
                            tctx.fillRect(0, 0, tmp.width, tmp.height);
                            tctx.drawImage(canvas, 0, 0);
                            exportCanvasForBlob = tmp;
                        }

                        const blob = await new Promise<Blob>((resolve) => {
                            exportCanvasForBlob.toBlob((blobData) => {
                                resolve(blobData!);
                            }, mimeType, job.quality ? job.quality / 100 : undefined);
                        });

                        downloadedFiles.push({ name: newFileName, blob });
                    } catch (error) {
                        console.error('Error converting:', error);
                    }
                }

                processedCount++;

                // Update global progress bar
                const progressFill = document.getElementById('progressFill') as HTMLElement;
                const progressText = document.getElementById('progressText');
                if (progressFill && progressText) {
                    const percentage = (processedCount / totalItems) * 100;
                    progressFill.style.width = `${percentage}%`;
                    const remaining = totalItems - processedCount;
                    progressText.textContent = `${remaining} / ${totalItems} archivos`;
                }

                // Update job progress if needed (optional)
                job.progress = (job.imageIndices.indexOf(imgIdx) + 1) / job.imageIndices.length * 100;

                // Small delay to make the process visible
                await new Promise(r => setTimeout(r, 40));
            }

            job.isProcessing = false;
            this.updateConversionsList();
        }

        // Final Download Logic
        if (downloadedFiles.length > 1) {
            for (const file of downloadedFiles) {
                // Handle duplicate names in zip
                let finalName = file.name;
                let counter = 1;
                while (zip.file(finalName)) {
                    const parts = file.name.split('.');
                    const ext = parts.pop();
                    finalName = `${parts.join('.')}_(${counter}).${ext}`;
                    counter++;
                }
                zip.file(finalName, file.blob);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            this.downloadFile(zipBlob, 'conversiones.zip');
        } else if (downloadedFiles.length === 1) {
            this.downloadFile(downloadedFiles[0].blob, downloadedFiles[0].name);
        }

        // Reset for next time after a short delay
        setTimeout(() => {
            const progressFill = document.getElementById('progressFill') as HTMLElement;
            const progressText = document.getElementById('progressText');
            if (progressFill) progressFill.style.width = '0%';
            if (progressText) progressText.textContent = '0 / 0 archivos';
        }, 1500);
    }



    private downloadFile(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private async imageToCanvas(file: File, targetWidth?: number, targetHeight?: number, dataUrl?: string): Promise<HTMLCanvasElement> {
        return new Promise((resolve, reject) => {
            const src = dataUrl || null;

            const handleImage = (imageUrl: string) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const width = targetWidth || img.width;
                    const height = targetHeight || img.height;
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas);
                };
                img.onerror = () => reject(new Error('Error al cargar la imagen'));
                img.src = imageUrl;
            };

            if (src) {
                handleImage(src);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => handleImage(e.target?.result as string);
                reader.onerror = () => reject(new Error('Error al leer el archivo'));
                reader.readAsDataURL(file);
            }
        });
    }

    private getMimeType(format: string): string {
        const mimeTypes: { [key: string]: string } = {
            PNG: 'image/png',
            JPG: 'image/jpeg',
            WEBP: 'image/webp',
            BMP: 'image/bmp',
            TIFF: 'image/tiff',
            SVG: 'image/svg+xml',
            ICO: 'image/x-icon'
        };
        return mimeTypes[format] || 'image/png';
    }

    private getFileName(baseName: string, format: string): string {
        const extensions: { [key: string]: string } = {
            PNG: 'png',
            JPG: 'jpg',
            WEBP: 'webp',
            BMP: 'bmp',
            TIFF: 'tiff',
            SVG: 'svg',
            ICO: 'ico'
        };
        return `${baseName}.${extensions[format] || format.toLowerCase()}`;
    }

    private getImageDPI(buffer: ArrayBuffer, type: string): number {
        const view = new DataView(buffer);
        if (type === 'image/jpeg' || type === 'image/jpg') {
            // Check JFIF APP0
            for (let i = 0; i < view.byteLength - 16; i++) {
                if (view.getUint8(i) === 0xFF && view.getUint8(i + 1) === 0xE0) {
                    const unit = view.getUint8(i + 13);
                    const x = view.getUint16(i + 14);
                    if (unit === 1) return x; // pixels per inch
                    if (unit === 2) return Math.round(x * 2.54); // pixels per cm to inch
                }
            }
        } else if (type === 'image/png') {
            // Check pHYs chunk
            for (let i = 0; i < view.byteLength - 20; i++) {
                if (view.getUint8(i) === 0x70 && view.getUint8(i + 1) === 0x48 && view.getUint8(i + 2) === 0x79 && view.getUint8(i + 3) === 0x53) {
                    const x = view.getUint32(i + 4);
                    const unit = view.getUint8(i + 12);
                    if (unit === 1) return Math.round(x * 0.0254); // pixels per meter to inch
                }
            }
        }
        return 72; // Default
    }

    // ==================== BUTTONS ====================
    private attachActionButtons() {
        const btnAddConversion = document.getElementById('btnAddConversion');
        if (btnAddConversion) {
            btnAddConversion.addEventListener('click', () => this.addConversionJob());
        }

        const btnDownload = document.getElementById('btnDownload');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.executeConversions());
        }

        const btnCancel = document.getElementById('btnCancel');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                window.location.pathname = '/Workspace';
            });
        }

        const qualitySlider = document.getElementById('qualitySlider') as HTMLInputElement;
        if (qualitySlider) {
            qualitySlider.addEventListener('input', (e) => {
                this.quality = parseInt((e.target as HTMLInputElement).value);
                const qualityValue = document.getElementById('qualityValue');
                if (qualityValue) qualityValue.textContent = `${this.quality}%`;
            });
        }
    }
}
