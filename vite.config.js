import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 3000,
        open: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
            'Cross-Origin-Embedder-Policy': 'credentialless'
        }
    },
    build: {
        outDir: 'dist',
        target: 'esnext'
    }
});
