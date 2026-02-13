import '@/styles/style.scss';
import { initApp } from '@/scripts/init';
import { initAppLogic } from '@/scripts/main';

// Initialize the application
window.addEventListener('load', () => {
    try {
        console.log("Initializing App...");
        initApp();
        console.log("Initializing Logic...");
        initAppLogic();
        console.log("App Ready.");
    } catch (err) {
        console.error("Initialization failed:", err);
        // Show a visible error on the page for the user
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div style="padding: 2rem; color: #ef4444; background: #1e293b; height: 100vh; font-family: sans-serif;">
                    <h1>Error de Inicialización</h1>
                    <p>La aplicación no pudo iniciarse correctamente.</p>
                    <pre style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; overflow: auto;">${err}</pre>
                </div>
            `;
        }
    }
});
