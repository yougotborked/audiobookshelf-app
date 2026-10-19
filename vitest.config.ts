import { fileURLToPath } from 'node:url'
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
      '~/plugins/capacitor': capacitorStub,
      '~': fileURLToPath(new URL('./', import.meta.url))
    }
  }
})
