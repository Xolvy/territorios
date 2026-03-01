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
            input: {
                main: './index.html'
            },
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                manualChunks: {
                    'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
                    'leaflet-vendor': ['leaflet'],
                    'ui-vendor': ['sweetalert2', 'animejs', 'chart.js'],
                    'utils-vendor': ['xlsx', 'jspdf', 'html2canvas', 'date-fns']
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
                cacheId: `territorios-shell-${pkg.version.replace(/\./g, '-')}`
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
