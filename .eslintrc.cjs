module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  ignorePatterns: [
    'node_modules/',
    '.nuxt/',
    'dist/',
    '.output/',
    'android/',
    'ios/',
    'static/',
    'assets/ebooks/**',
    'strings/generated/**'
  ],
  extends: [],
  rules: {}
}
