module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: 'standard-with-typescript',
  overrides: [],
  settings: {
    'import/resolver': {
      node: {
        path: ['.'],
        moduleDirectory: ['node_modules', 'src/'],
        extensions: ['.js', '.ts'],
      },
    },
  },
  parserOptions: {
    project: ['./tsconfig.json'],
    ecmaVersion: 'latest',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'], }],
    'linebreak-style': 0,
    'no-return-await': 'off',
    '@typescript-eslint/return-await': 'off',
    '@typescript-eslint/promise-function-async': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    quotes: [2, 'single'],
    semi: [2, 'never'],
    'comma-dangle': [2, 'always-multiline'],
    '@typescript-eslint/comma-dangle': [2, 'always-multiline'],
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    'import/extensions': ['error', 'always', { js: 'never', ts: 'never' }],
    'operator-linebreak': ['error', 'before'],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/space-before-function-paren': 'off',
  },
}
