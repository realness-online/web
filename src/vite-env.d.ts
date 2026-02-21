/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '@/*' {
  const component: any
  export default component
}

declare module '*.js'
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'pako' {
  export function deflate(
    data: Uint8Array | string,
    options?: { level?: number }
  ): Uint8Array
  export function inflate(
    data: Uint8Array,
    options?: { to?: 'string' }
  ): Uint8Array | string
  export default { deflate, inflate }
}

declare module 'country-code-emoji' {
  export function countryCodeEmoji(countryCode: string): string
}

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: any) => void
  }
  export function registerSW(
    options?: RegisterSWOptions
  ): (reloadPage?: boolean) => Promise<void>
}
