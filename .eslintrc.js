module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'prettier', 'plugin:prettier/recommended'],
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  rules: {
    // Prettier integration
    'prettier/prettier': 'error',

    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-var-requires': 'error',

    // General JavaScript/TypeScript rules
    'no-console': 'off', // CLI tool needs console output
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': 'off', // Use TypeScript version instead

    // Code style
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always'],
    'prefer-template': 'error',
    'object-shorthand': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '__tests__/**/*'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-unused-vars': 'off',
      },
    },
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js',
    '!.eslintrc.js',
    '!jest.config.js',
  ],
};
