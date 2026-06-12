const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'projects/**',
      'data/**',
      'assets/**',
      'design-systems/**',
      'test-images-codex/**',
      'billy-tests/**',
      'public/vendor/**',
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn',
    },
  },
  {
    files: ['public/scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        Alpine: 'readonly',
      },
    },
  },
  {
    files: ['lib/research.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
];
