/// <reference types="node" />
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'lucide': 'lucide/dist/cjs/lucide.js'
        }
    },
    server: {
        port: 5173,
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: './index.html'
            }
        }
    },
    optimizeDeps: {
        entries: ['./index.html'],
    },
    publicDir: 'public',
});
