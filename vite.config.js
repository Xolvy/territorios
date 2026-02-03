import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import pkg from './package.json';

export default defineConfig({
    root: '.',
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
        port: 3000,
        open: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'unsafe-none',
            'Cross-Origin-Embedder-Policy': 'unsafe-none'
        }
    },
    build: {
        outDir: 'dist',
        target: 'esnext',
        minify: 'terser',
        cssMinify: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
                    'leaflet-vendor': ['leaflet'],
                    'ui-vendor': ['sweetalert2', 'animejs', 'chart.js'],
                    'utils-vendor': ['xlsx', 'jspdf', 'html2canvas', 'date-fns'],
                    // Separate modules for HMS
                    'mod-admin': ['./modules/admin-dashboard.js'],
                    'mod-conductor': ['./modules/conductor-dashboard.js'],
                    'mod-login': ['./modules/login.js']
                }
            }
        }
    },
    plugins: [
        viteCompression({
            algorithm: 'gzip',
            ext: '.gz',
        }),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
                cleanupOutdatedCaches: true,
                maximumFileSizeToCacheInBytes: 10000000, // Increased for modular assets
                cacheId: 'territorios-shell-v2-4-1-7'
            },
            manifest: {
                name: 'Gestión de Territorios',
                short_name: 'Territorios',
                description: 'Sistema inteligente de gestión de territorios',
                theme_color: '#0d9488',
                icons: [
                    {
                        src: 'icon-192.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml'
                    },
                    {
                        src: 'icon-512.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml'
                    }
                ]
            }
        }),
        ViteImageOptimizer({
            exclude: ['/assets/mapa-general.jpg', '/assets/mapa_territorio.png'],
            svg: {
                multipass: true,
                plugins: [
                    {
                        name: 'preset-default',
                        params: {
                            overrides: {
                                cleanupNumericValues: false,
                            },
                        },
                    },
                ],
            },
        })
    ]
});
