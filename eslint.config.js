import js from '@eslint/js';
import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint,
      prettier: prettierPlugin,
    },
    rules: {
      // Base recommended rules
      ...tsEslint.configs.recommended.rules,

      // Prettier integration
      'prettier/prettier': 'warn',

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-var-requires': 'error',

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
      'prefer-template': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'warn',
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'generated/',
      'generated-test/',
      'generated-nested/',
      'data/',
      '*.config.js',
      '*.config.ts',
      'build/',
      'out/',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      '*.log',
      '*.generated.*',
      '*.d.ts',
      'tmp/',
      'temp/',
      'example.ts',
      'example-app/',
      'artist-db/',
      'db/',
      'type-safety-demo.ts',
      '*-demo.ts',
    ],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['src/runtime/browser-*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'off', // Allow console in browser runtime for debugging
      '@typescript-eslint/no-explicit-any': 'off', // Relax for browser compatibility
    },
  },
];
