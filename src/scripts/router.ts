import { ImageConverter } from '@/scripts/converter';
import { setWorkspaceActive, signaturePad } from '@/scripts/state';

type PageType = 'workspace' | 'converter';

export class PageRouter {
    private currentPage: PageType = 'workspace';
    private converterInstance: ImageConverter | null = null;

    constructor() {
        this.init();
    }

    private init() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.updatePage();
        });

        // Handle initial route
        this.updatePage();
    }

    public navigateTo(path: string) {
        const route = this.getPageFromPath(path);
        window.history.pushState({ page: route }, '', path);
        this.renderPage(route);
    }

    private updatePage() {
        const path = window.location.pathname;

        // Redirect root or lowercase workspace to /Workspace
        if (path === '/' || path === '' || path.toLowerCase() === '/workspace') {
            if (path !== '/Workspace') {
                window.history.replaceState({ page: 'workspace' }, '', '/Workspace');
            }
            this.renderPage('workspace');
            return;
        }

        const route = this.getPageFromPath(path);
        this.renderPage(route);
    }

    private getPageFromPath(path: string): PageType {
        if (path.includes('/Convertir') || path === '/Convertir') {
            return 'converter';
        }
        return 'workspace';
    }

    private renderPage(page: PageType) {
        const converterPage = document.getElementById('converterPage') as HTMLElement;
        const appMainLayout = document.querySelector('.app-main-layout') as HTMLElement;

        if (page === 'converter') {
            // Show converter page and hide workspace layout
            if (appMainLayout) appMainLayout.style.display = 'none';
            if (converterPage) converterPage.style.display = 'flex';

            setWorkspaceActive(false);

            // Disable signaturePad to prevent drawing on hidden canvas
            if (signaturePad) {
                signaturePad.off();
            }

            document.body.style.cursor = 'default';
            // Clear all workspace-related body classes
            document.body.classList.remove('is-moving', 'is-panning', 'is-rotating', 'is-resizing-r', 'is-resizing-b', 'is-resizing-br');


            // Initialize converter if not already done
            if (!this.converterInstance) {
                this.converterInstance = new ImageConverter();
            }

            this.currentPage = 'converter';
            this.updateNavbarState('converter');
        } else {
            // Show workspace and hide converter
            if (appMainLayout) appMainLayout.style.display = 'flex';
            if (converterPage) converterPage.style.display = 'none';

            setWorkspaceActive(true);

            // Re-enable and refresh workspace
            if (signaturePad) {
                signaturePad.on();
                // Trigger a resize event to ensure the canvas adapts to being visible again
                window.dispatchEvent(new Event('resize'));
            }

            this.currentPage = 'workspace';
            this.updateNavbarState('workspace');
        }
    }

    private updateNavbarState(page: string) {
        // Update navbar buttons - remove active from all
        document.querySelectorAll('.navbar-page-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active to current page button
        if (page === 'converter') {
            const btn = document.getElementById('converterButton');
            if (btn) btn.classList.add('active');
        } else {
            const btn = document.getElementById('workspaceButton');
            if (btn) btn.classList.add('active');
        }

        // Hide controls header in converter page
        const controlsHeader = document.querySelector('.controls-header') as HTMLElement;
        if (controlsHeader) {
            controlsHeader.style.display = page === 'converter' ? 'none' : 'flex';
        }
    }

    public getCurrentPage(): PageType {
        return this.currentPage;
    }

    public getConverterInstance(): ImageConverter | null {
        return this.converterInstance;
    }
}

export let pageRouter: PageRouter;

export function initPageRouter() {
    pageRouter = new PageRouter();
    return pageRouter;
}
