import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./app.js",
        "./modules/**/*.{js,mjs}",
        "./data/**/*.js",
        "./scripts/**/*.js"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            screens: {
                'xs': '400px',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                primary: 'hsl(var(--primary))',
                'primary-light': 'hsla(var(--primary) / 0.15)',
                secondary: 'hsl(var(--secondary))',
                accent: 'hsl(var(--accent))',
                teal: {
                    400: '#26a69a',
                    500: '#009688',
                    600: '#00897b',
                    900: '#004d40',
                },
                rose: {
                    50: '#fff1f2',
                    100: '#ffe4e6',
                    500: '#f43f5e',
                    600: '#e11d48',
                    700: '#be123c',
                },
                amber: {
                    500: '#f59e0b',
                    600: '#d97706',
                },
                emerald: {
                    500: '#10b981',
                    600: '#059669',
                }
            }
        },
    },
    plugins: [forms, typography],
}
