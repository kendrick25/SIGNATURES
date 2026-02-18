export const LoadingHTML = `
    <div id="splash-screen"
        style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #0f172a; z-index: 9999; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <div class="splash-logo-container">
            <svg class="signature-svg" viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <mask id="text-reveal">
                    <rect class="reveal-rect" x="0" y="0" width="0" height="100%" fill="white" />
                </mask>
                <path class="signature-path" d="M30,40 L30,80 M30,40 L50,40 M30,60 L45,60 M60,40 L60,80 M75,80 L75,40 L95,40 L95,60 L75,60 L95,80 M110,80 L110,40 L125,80 L140,40 L140,80 M155,80 L170,40 L185,80 M160,65 L180,65 M215,40 C195,40 195,60 205,60 C215,60 215,80 195,80" stroke-width="4" stroke-linecap="round" fill="none" mask="url(#text-reveal)" />
            </svg>
            <div class="pen-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                    <line x1="16" y1="8" x2="2" y2="22"></line>
                    <line x1="17.5" y1="15" x2="9" y2="15"></line>
                </svg>
            </div>
        </div>
        <div class="splash-loader">
            <div class="splash-progress"></div>
        </div>
    </div>
`;
