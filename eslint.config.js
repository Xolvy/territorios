import globals from 'globals';

export default [
  {
    files: [
      'app.js',
      'firebase-config.js',
      'modules/**/*.js',
      'data/**/*.js',
      'public/**/*.js'
    ],
    ignores: ['node_modules/**', 'scripts/**', 'functions/**', 'docs/**', 'scratch/**'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: 'readonly',
        google: 'readonly',
        L: 'readonly',
        Chart: 'readonly',
        VoiceDictationHelper: 'readonly',
        html2canvas: 'readonly',
        UIHelpers: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'warn',
    },
  },
];
