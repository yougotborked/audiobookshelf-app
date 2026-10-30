import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Unit tests for the pure logic under composables/ and constants/.
//
// These run in plain Node — no Nuxt, no browser, no device. Composables that reach for
// Capacitor are aliased to a stub so a module can be imported for the pure functions it
// exports without dragging in a native bridge that cannot exist here.
//
// This is deliberately not a component test setup. The bugs worth catching in this repo have
// been in decision logic — what counts as finished, whether a request reached the server,
// how long to wait before retrying — not in rendering.
const capacitorStub = fileURLToPath(new URL('./test/stubs/capacitor.ts', import.meta.url))

export default defineConfig({
  // Lets a test import a .vue file for the plain functions on its `methods` object. This is not
  // a component harness - nothing is mounted and `setup()` never runs - but it does let a
  // control-flow bug inside a method be pinned down, which is what a stuck loading flag is.
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    reporters: ['default']
  },
  resolve: {
    alias: {
      '@capacitor/core': capacitorStub,
      '@capacitor/status-bar': capacitorStub,
      '@capacitor/clipboard': capacitorStub,
      '@capacitor/filesystem': capacitorStub,
      '@capacitor/share': capacitorStub,
      '@capacitor/dialog': capacitorStub,
      // Both import prefixes are in use across the components.
      '~/plugins/capacitor': capacitorStub,
      '@/plugins/capacitor': capacitorStub,
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url))
    }
  }
})
