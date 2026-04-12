import { vi } from 'vitest'

// App.vue loads these with defineAsyncComponent; VTU stubs do not cancel the
// dynamic import, so chunks can finish after teardown (raw md, stylus, etc.).
// Do not mock as-fps here: tests/components/fps.spec.js mounts the real component.
vi.mock('@/components/profile/as-dialog-preferences.vue', () => ({
  default: {
    name: 'AsDialogPreferences',
    template: '<div class="as-dialog-preferences-stub"></div>',
    methods: { show() {} }
  }
}))
vi.mock('@/components/as-dialog-documentation.vue', () => ({
  default: {
    name: 'AsDialogDocumentation',
    template: '<div class="as-dialog-documentation-stub"></div>',
    methods: { show() {} }
  }
}))

vi.mock('vue-router')
vi.mock('firebase/app')
vi.mock('firebase/auth')
vi.mock('firebase/storage', () => import('./firebase/storage.js'))
vi.mock('idb-keyval')
