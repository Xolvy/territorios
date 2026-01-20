import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 3000,
        open: true,
        headers: {
            // Relaxed headers to avoid blocking Firebase/Auth popups
            'Cross-Origin-Opener-Policy': 'unsafe-none',
            'Cross-Origin-Embedder-Policy': 'unsafe-none'
        }
    },
    build: {
        outDir: 'dist',
        target: 'esnext'
    }
});
