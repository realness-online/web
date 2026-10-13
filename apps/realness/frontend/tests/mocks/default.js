import { vi } from 'vite-plus/test'

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
vi.mock('@/components/profile/as-notification-prompt.vue', () => ({
  default: {
    name: 'AsNotificationPrompt',
    template: '<div class="as-notification-prompt-stub"></div>'
  }
}))

vi.mock('vue-router')
vi.mock('firebase/app')
vi.mock('firebase/auth')
vi.mock('firebase/storage', () => import('./firebase/storage.js'))
vi.mock('idb-keyval')
