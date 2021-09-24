module.exports = {
  env: {
    browser: true,
    es2020: true,
  },
  ignorePatterns: ['dist/*'],
  extends: [
    'airbnb-base',
  ],
  settings: {
    'import/resolver': {
      node: {
        paths: ['src'],
      },
    },
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module',
  },
  rules: {
    semi: [2, 'never'],
    quotes: [2, 'single'],
    'import/prefer-default-export': [0],
    'linebreak-style': 0,
    'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['Vue'] }],
  },
}
