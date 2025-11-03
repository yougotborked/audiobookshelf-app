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
  plugins: ['vue'],
  extends: ['eslint:recommended', 'plugin:vue/base'],
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'off',
    'no-empty': 'off',
    'no-async-promise-executor': 'off',
    'no-prototype-builtins': 'off',
    'no-constant-condition': 'off',
    'no-useless-escape': 'off',
    'no-control-regex': 'off',
    'no-undef': 'off',
    'no-dupe-keys': 'off',
    'vue/no-mutating-props': 'off',
    'vue/no-dupe-keys': 'off'
  }
}
