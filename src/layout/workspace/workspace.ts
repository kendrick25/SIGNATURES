export const WorkspaceHTML = `
    <!-- Workspace Area -->
    <div class="workspace" id="workspace">
        <div class="canvas-view-port">
            <div class="canvas-container" id="canvasContainer">
                <div class="canvas-hint" id="canvasHint">
                    <i data-lucide="pen-tool" class="hint-icon"></i>
                    <span data-i18n="canvasHint">Dibuja tu firma aquí</span><br>
                    <span class="hint-subtext" data-i18n="canvasHintSub">(Compatible con tabletas
                        digitales)</span>
                </div>
                <div id="selectedBounds" class="selected-bounds">
                    <div class="resize-handle handle-r" id="resizeHandleR" data-type="r"></div>
                    <div class="resize-handle handle-b" id="resizeHandleB" data-type="b"></div>
                    <div class="resize-handle handle-br" id="resizeHandleBR" data-type="br"></div>
                    <div class="resize-handle handle-rotate" id="rotateHandle" data-type="rotate" title="Rotar">
                    </div>
                </div>
                <div class="selection-box" id="dragSelection"></div>
                <div class="selected-stroke-info" id="selectionInfo">Trazos Seleccionados: 0</div>
                <canvas id="signatureCanvas"></canvas>
                <canvas id="selectionCanvas" class="selection-canvas-layer"></canvas>
            </div>
        </div>
    </div>
`;
