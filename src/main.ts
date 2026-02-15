import '@/styles/style.scss';
import { initApp } from '@/scripts/init';
import { initAppLogic } from '@/scripts/main';

// Initialize the application
const init = () => {
    try {
        console.log("Initializing App...");
        initApp();
        console.log("Initializing Logic...");
        initAppLogic();
        console.log("App Ready.");

        // Reveal the application with a small delay for smoothness
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.opacity = '0';
                splash.style.visibility = 'hidden';

                // Stop any running animations to save resources
                const progress = splash.querySelector('.splash-progress');
                const logo = splash.querySelector('.splash-logo');
                if (progress) (progress as HTMLElement).style.animation = 'none';
                if (logo) (logo as HTMLElement).style.animation = 'none';

                // Completely remove from DOM after transition
                setTimeout(() => splash.remove(), 600);
            }
            document.body.classList.add('ready');
        }, 100);
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
