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
                teal: {
                    400: '#26a69a',
                    500: '#009688',
                    600: '#00897b',
                    900: '#004d40',
                }
            }
        },
    },
    plugins: [],
}
