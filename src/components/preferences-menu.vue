<script setup>
  import Preference from '@/components/preference'
  import * as preferences from '@/utils/preference'
  import { ref, watch, onBeforeUnmount as before_unmount } from 'vue'

  defineProps({
    icon: {
      type: Boolean,
      default: false
    }
  })

  const { view_3d } = preferences

  const tweakpane_ref = ref(null)
  let pane = null
  let mounting = false

  const dispose_pane = () => {
    if (!pane) return
    pane.dispose()
    pane = null
  }

  const mount_pane = async () => {
    if (!tweakpane_ref.value || pane || mounting || !view_3d.value) return
    mounting = true
    const { Pane } = await import('tweakpane')
    mounting = false
    if (!tweakpane_ref.value || pane || !view_3d.value) return
    const p = preferences
    const settings = {
      mosaic_spread: p.mosaic_spread.value,
      mosaic_opacity: p.mosaic_opacity.value,
      shadow_spread: p.shadow_spread.value,
      shadow_opacity: p.shadow_opacity.value,
      group_gap: p.group_gap.value,
      tilt_amount: p.tilt_amount.value,
      gyro_amount: p.gyro_amount.value,
      atmosphere_enabled: p.atmosphere_enabled.value,
      atmosphere_color: p.atmosphere_color.value,
      atmosphere_density: p.atmosphere_density.value,
      drift_amount: p.drift_amount.value,
      drift_speed: p.drift_speed.value,
      breathing_amount: p.breathing_amount.value,
      breathing_speed: p.breathing_speed.value
    }

    pane = new Pane({ container: tweakpane_ref.value })

    const sync = () => {
      p.mosaic_spread.value = settings.mosaic_spread
      p.mosaic_opacity.value = settings.mosaic_opacity
      p.shadow_spread.value = settings.shadow_spread
      p.shadow_opacity.value = settings.shadow_opacity
      p.group_gap.value = settings.group_gap
      p.tilt_amount.value = settings.tilt_amount
      p.gyro_amount.value = settings.gyro_amount
      p.atmosphere_enabled.value = settings.atmosphere_enabled
      p.atmosphere_color.value = settings.atmosphere_color
      p.atmosphere_density.value = settings.atmosphere_density
      p.drift_amount.value = settings.drift_amount
      p.drift_speed.value = settings.drift_speed
      p.breathing_amount.value = settings.breathing_amount
      p.breathing_speed.value = settings.breathing_speed
    }

    const mosaic_folder = pane.addFolder({ title: 'mosaic' })
    mosaic_folder
      .addBinding(settings, 'mosaic_spread', {
        label: 'spread',
        min: 0,
        max: 0.01,
        step: 0.0001
      })
      .on('change', sync)
    mosaic_folder
      .addBinding(settings, 'mosaic_opacity', {
        label: 'opacity',
        min: 0,
        max: 1,
        step: 0.01
      })
      .on('change', sync)

    const shadow_folder = pane.addFolder({ title: 'shadows' })
    shadow_folder
      .addBinding(settings, 'shadow_spread', {
        label: 'spread',
        min: 0,
        max: 0.03,
        step: 0.0001
      })
      .on('change', sync)
    shadow_folder
      .addBinding(settings, 'shadow_opacity', {
        label: 'opacity',
        min: 0,
        max: 1,
        step: 0.01
      })
      .on('change', sync)
    shadow_folder
      .addBinding(settings, 'group_gap', {
        label: 'group gap',
        min: -0.5,
        max: 1.5,
        step: 0.01
      })
      .on('change', sync)

    const camera_folder = pane.addFolder({ title: 'camera' })
    camera_folder
      .addBinding(settings, 'tilt_amount', {
        label: 'arrow tilt',
        min: 0,
        max: 2.0,
        step: 0.01
      })
      .on('change', sync)
    camera_folder
      .addBinding(settings, 'gyro_amount', {
        label: 'gyro tilt',
        min: 0,
        max: 3.0,
        step: 0.01
      })
      .on('change', sync)

    const atmosphere_folder = pane.addFolder({ title: 'atmosphere' })
    atmosphere_folder
      .addBinding(settings, 'atmosphere_enabled', { label: 'enabled' })
      .on('change', sync)
    atmosphere_folder
      .addBinding(settings, 'atmosphere_color', { label: 'color' })
      .on('change', sync)
    atmosphere_folder
      .addBinding(settings, 'atmosphere_density', {
        label: 'max',
        min: 0,
        max: 0.5,
        step: 0.005
      })
      .on('change', sync)

    const motion_folder = pane.addFolder({ title: 'motion' })
    motion_folder
      .addBinding(settings, 'drift_amount', {
        label: 'drift amount',
        min: 0,
        max: 0.005,
        step: 0.0001
      })
      .on('change', sync)
    motion_folder
      .addBinding(settings, 'drift_speed', {
        label: 'drift speed',
        min: 0,
        max: 0.5,
        step: 0.01
      })
      .on('change', sync)
    motion_folder
      .addBinding(settings, 'breathing_amount', {
        label: 'breath amount',
        min: 0,
        max: 0.05,
        step: 0.001
      })
      .on('change', sync)
    motion_folder
      .addBinding(settings, 'breathing_speed', {
        label: 'breath speed',
        min: 0,
        max: 3,
        step: 0.05
      })
      .on('change', sync)
  }

  watch(
    view_3d,
    val => {
      if (val) mount_pane()
      else if (
        globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      )
        dispose_pane()
    },
    { immediate: true, flush: 'post' }
  )

  const on_slide_transition_end = event => {
    if (event.propertyName !== 'grid-template-rows') return
    if (view_3d.value) return
    dispose_pane()
  }

  before_unmount(dispose_pane)
</script>

<template>
  <menu data-preferences-menu>
    <article>
      <h3 id="preferences-mosaic">Mosaic</h3>
      <preference name="mosaic" />
      <preference name="sediment" />
      <preference name="sand" />
      <preference name="gravel" />
      <preference name="rocks" />
      <preference name="boulders" />
    </article>
    <article>
      <h3 id="preferences-shadow">Shadow</h3>
      <preference name="shadow" />
      <preference name="background" />
      <preference name="light" />
      <preference name="regular" />
      <preference name="medium" />
      <preference name="bold" />
      <preference name="stroke" />
    </article>
    <article>
      <h3 id="preferences-motion">Motion</h3>
      <preference name="drama" />
      <preference :icon="icon" name="animate" />
      <preference name="color_cycle" label="Color cycle" />
      <h3 id="preferences-view">View</h3>
      <preference :icon="icon" name="view_3d" label="3D">
        <div class="tweakpane" @transitionend="on_slide_transition_end">
          <div ref="tweakpane_ref" class="tweakpane__host" />
        </div>
      </preference>
      <preference :icon="icon" name="grid" />
      <preference name="info" />
      <preference name="storytelling" />
      <h3 id="preferences-chrome">Chrome</h3>
      <preference name="menu" label="Island" />
    </article>
  </menu>
</template>

<style lang="stylus">
  menu[data-preferences-menu] {
    display: grid;
    gap: base-line * 1.5;
    grid-template-columns: 1fr;
    margin-inline: auto;
    border: none;
    max-width: support-page-width;
    & > article {
      align-self: start;
      & > h3 {
        color: var(--emphasis);
        margin-top: 0;
        text-transform: capitalize;
        &:not(:first-child) {
          margin-top: base-line * 1.5;
        }
      }
    }
    @media (min-width: pad-begins) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  fieldset[data-preference]:has(input[name='view_3d']) > .tweakpane {
    display: grid;
    grid-template-rows: 0fr;
    margin-top: base-line;
    overflow: hidden;
    transition: grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1);
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
    & > .tweakpane__host {
      min-height: 0;
      overflow: hidden;
      opacity: 0;
      translate: 0 -0.35rem;
      transition: opacity 280ms cubic-bezier(0.22, 1, 0.36, 1),
        translate 280ms cubic-bezier(0.22, 1, 0.36, 1);
      @media (prefers-reduced-motion: reduce) {
        transition: none;
      }
      --tp-base-background-color: var(--basalt);
      --tp-base-shadow-color: transparent;
      --tp-base-border-radius: round((base-line / 3), 2);
      --tp-base-font-family: inherit;
      --tp-container-background-color: unquote('color-mix(in srgb, var(--bone) 4%, transparent)');
      --tp-container-background-color-hover: unquote('color-mix(in srgb, var(--bone) 7%, transparent)');
      --tp-container-background-color-focus: unquote('color-mix(in srgb, var(--bone) 7%, transparent)');
      --tp-container-background-color-active: unquote('color-mix(in srgb, var(--bone) 10%, transparent)');
      --tp-container-foreground-color: var(--bone);
      --tp-input-background-color: unquote('color-mix(in srgb, var(--bone) 6%, transparent)');
      --tp-input-background-color-hover: var(--accent);
      --tp-input-background-color-focus: var(--accent);
      --tp-input-background-color-active: var(--accent);
      --tp-input-foreground-color: var(--bone);
      --tp-label-foreground-color: var(--bone);
      --tp-groove-foreground-color: unquote('color-mix(in srgb, var(--bone) 8%, transparent)');
      --tp-button-background-color: unquote('color-mix(in srgb, var(--bone) 6%, transparent)');
      --tp-button-background-color-hover: var(--accent);
      --tp-button-background-color-focus: var(--accent);
      --tp-button-background-color-active: var(--accent);
      --tp-button-foreground-color: var(--bone);
      --tp-monitor-background-color: unquote('color-mix(in srgb, var(--bone) 4%, transparent)');
      --tp-monitor-foreground-color: var(--bone);
      .tp-dfwv {
        width: 100%;
        position: static;
      }
    }
  }

  fieldset[data-preference]:has(input[name='view_3d']:checked) > .tweakpane {
    grid-template-rows: 1fr;
    & > .tweakpane__host {
      opacity: 1;
      translate: 0 0;
    }
  }
</style>
