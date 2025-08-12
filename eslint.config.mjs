import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly'
      }
    },
    rules: {
      // Error prevention
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',

      // Best practices
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-magic-numbers': [
        'warn',
        {
          ignore: [-1, 0, 1, 2, 24, 60, 100, 1000, 1024, 5000],
          ignoreArrayIndexes: true,
          detectObjects: false
        }
      ],

      // Code style (let Prettier handle indentation)
      // indent: ['error', 2],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],

      // Node.js specific
      'no-process-exit': 'warn',
      'no-sync': 'warn'
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        // Vitest globals
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly'
      }
    },
    rules: {
      'no-magic-numbers': 'off' // Tests often use magic numbers
    }
  },
  {
    files: ['examples/**/*.js'],
    rules: {
      'no-process-exit': 'off', // Examples may use process.exit
      'no-magic-numbers': 'off', // Examples use magic numbers for demonstration
      'no-sync': 'off' // Examples may use sync operations for simplicity
    }
  },
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', '*.min.js']
  }
];
