import { LoadingHTML } from './loading/loading';
import { NavbarHTML } from './navbar/navbar';
import { ControlsHTML } from './controls/controls';
import { PanelHTML } from './panel/panel';
import { WorkspaceHTML } from './workspace/workspace';
import { ExportModalHTML } from './modal/export-modal';
import { OverlaysHTML } from './shared/overlays';
import { ConverterHTML } from './converter/converter';

export function assembleFullLayout() {
    const appHTML = `
        ${LoadingHTML}
        
        <div class="main-app-container">
            <header class="app-header">
                ${NavbarHTML}
                ${ControlsHTML}
            </header>

            <div class="main-content-area">
                <div class="app-main-layout">
                    ${PanelHTML}
                    ${WorkspaceHTML}
                </div>

                ${ConverterHTML}
            </div>
        </div>

        ${OverlaysHTML}
        ${ExportModalHTML}
    `;

    document.body.insertAdjacentHTML('afterbegin', appHTML);
}
