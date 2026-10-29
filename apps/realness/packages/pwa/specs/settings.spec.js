import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PWA_COLOR,
  profile,
  pwa_manifest,
  pwa_plugin,
  pwa_workbox
} from '../src/index.js'

describe('PWA kit settings', () => {
  it('prompt mode and page claiming are the shared default', () => {
    expect(pwa_plugin.registerType).toBe('prompt')
    expect(pwa_plugin.filename).toBe('service.worker.js')
    expect(pwa_workbox.clientsClaim).toBe(true)
  })

  it('a manifest carries installable traits and versioned icons', () => {
    const manifest = pwa_manifest({
      name: 'Site',
      description: 'A site',
      icon_version: '3.0.0'
    })
    expect(manifest.display).toBe('standalone')
    expect(manifest.scope).toBe('/')
    expect(manifest.theme_color).toBe(PWA_COLOR)
    expect(manifest.icons.map(icon => [icon.src, icon.purpose])).toEqual([
      ['/192.png?v=3.0.0', 'any maskable'],
      ['/512.png?v=3.0.0', 'any maskable']
    ])
    expect(pwa_manifest({ name: 'S', description: '' }).icons[0].src).toBe(
      '/192.png'
    )
  })
})

describe('profiles', () => {
  it('app falls back to its shell for every route', () => {
    expect(profile('app').navigateFallback).toBe('index.html')
    expect(profile('app', { fallback: 'app.html' }).navigateFallback).toBe(
      'app.html'
    )
  })

  it('document fetches pages network first and precaches no HTML', () => {
    const options = profile('document')
    expect(options.navigateFallback).toBeNull()
    expect(options.globPatterns.join()).not.toContain('html')
    const [pages] = options.runtimeCaching
    expect(pages.handler).toBe('NetworkFirst')
    expect(pages.urlPattern({ request: { mode: 'navigate' } })).toBe(true)
    expect(pages.urlPattern({ request: { mode: 'cors' } })).toBe(false)
  })

  it('refuses a profile it does not know', () => {
    expect(() => profile('kiosk')).toThrow('unknown PWA profile')
  })
})

describe('builds use the kit', () => {
  for (const [build, kind] of [
    ['vite.config.js', "profile: 'app'"],
    ['tools/publish/renderer/src/pwa.js', 'profile:']
  ])
    it(`${build} builds through realness_pwa`, () => {
      const text = readFileSync(path.resolve(build), 'utf8')
      expect(text).toContain('realness_pwa(')
      expect(text).toContain(kind)
      expect(text).not.toMatch(/VitePWA|registerType:|clientsClaim:/)
    })
})
