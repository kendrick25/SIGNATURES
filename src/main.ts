import '@/styles/style.scss';
import { assembleFullLayout } from '@/layout/main-layout';
import { initApp } from '@/scripts/init';
import { initAppLogic } from '@/scripts/main';
import { initPageRouter } from '@/scripts/router';

// Initialize the application
const init = () => {
    try {
        console.log("Assembling Layout...");
        assembleFullLayout();

        console.log("Initializing Router...");
        const pageRouter = initPageRouter();

        console.log("Initializing App...");
        initApp();
        console.log("Initializing Logic...");
        initAppLogic();
        console.log("App Ready.");

        // Attach navbar event listeners
        attachNavbarListeners(pageRouter);

        // Wait for the signature animation loop to complete for a premium feel
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.opacity = '0';
                splash.style.visibility = 'hidden';

                // Freeze animations at their current (final) state before fading
                const progress = splash.querySelector('.splash-progress');
                const sigPath = splash.querySelector('.signature-path');
                const revealRect = splash.querySelector('.reveal-rect');
                const pen = splash.querySelector('.pen-icon');

                if (progress) (progress as HTMLElement).style.animationPlayState = 'paused';
                if (sigPath) (sigPath as HTMLElement).style.animationPlayState = 'paused';
                if (revealRect) (revealRect as HTMLElement).style.animationPlayState = 'paused';
                if (pen) (pen as HTMLElement).style.animationPlayState = 'paused';

                // Completely remove from DOM after transition
                setTimeout(() => splash.remove(), 600);
            }
            document.body.classList.add('ready');
            window.dispatchEvent(new Event('resize'));
        }, 4000);
    } catch (err) {
        console.error("Initialization failed:", err);
        document.body.classList.add('ready');
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';

        const app = document.querySelector('.main-app-container');
        if (app) {
            (app as HTMLElement).innerHTML = `
                <div style="padding: 2rem; color: #ef4444; background: #1e293b; height: 100vh; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                    <h1 style="-webkit-text-fill-color: #ef4444;">Error de Inicialización</h1>
                    <p>La aplicación no pudo iniciarse correctamente.</p>
                    <pre style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; overflow: auto; max-width: 80%; margin-top: 1rem; text-align: left;">${err}</pre>
                </div>
            `;
        }
    }
};

function attachNavbarListeners(pageRouter: any) {
    const pageButtons = document.querySelectorAll('.navbar-page-btn');

    pageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            if (page === 'converter') {
                pageRouter.navigateTo('/Convertir');
            } else if (page === 'workspace') {
                pageRouter.navigateTo('/Workspace');
            }
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
