module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  // vue-eslint-parser handles .vue files and delegates <script> blocks to the TypeScript
  // parser. Without this, every `<script setup lang="ts">` block fails to parse and the
  // whole lint run collapses into "Parsing error" noise that hides real findings.
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2022,
    sourceType: 'module',
    extraFileExtensions: ['.vue']
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
  plugins: ['vue', '@typescript-eslint'],
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
    // .prettierrc sets "semi": false, which makes Prettier emit a leading `;(` on lines
    // that start with a parenthesis. eslint:recommended's no-extra-semi flags exactly that,
    // so the two tools would undo each other on every save.
    'no-extra-semi': 'off',
    'vue/no-mutating-props': 'off',
    'vue/no-dupe-keys': 'off'
  }
}
