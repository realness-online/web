<script setup>
  import AsNotifications from '@/components/account/as-notifications'
  import Preference from '@/components/preference'
  import { use_instance_capabilities } from '@/use/instance-capabilities'
  import { use_push } from '@/use/push'
  import {
    sync_folder_supported,
    use as use_sync_folder
  } from '@/use/sync-folder'
  import * as preferences from '@/utils/preference'
  import { computed, ref, watch, onBeforeUnmount } from 'vue'

  defineProps({
    icon: {
      type: Boolean,
      default: false
    }
  })

  const sync_folder_supported_value = sync_folder_supported()
  const { sync_folder, sync_folder_name } = use_sync_folder()
  const { view_3d } = preferences
  const { ready, push: push_available } = use_instance_capabilities()
  const { status: push_status } = use_push()

  const show_account_services = computed(
    () =>
      sync_folder_supported_value ||
      (ready.value &&
        push_available.value &&
        push_status.value !== 'unsupported')
  )

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

  onBeforeUnmount(dispose_pane)
</script>

<template>
  <menu class="preferences-menu">
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
      <h3 id="preferences-view">View</h3>
      <preference :icon="icon" name="view_3d" label="3D">
        <div
          class="tweakpane-slide"
          :class="{ open: view_3d }"
          @transitionend="on_slide_transition_end">
          <div class="tweakpane-slide-inner">
            <div ref="tweakpane_ref" class="tweakpane-3d" />
          </div>
        </div>
      </preference>
      <preference :icon="icon" name="grid" />
      <preference name="info" />
      <preference name="storytelling" />
      <h3 id="preferences-chrome">Chrome</h3>
      <preference name="menu" label="Island" />
    </article>
    <article v-if="show_account_services">
      <h3 id="preferences-account">Account</h3>
      <as-notifications />
      <preference
        v-if="sync_folder_supported_value"
        name="sync_folder"
        title="Export output to a folder">
        <p v-if="sync_folder_name">
          Export output to
          <span class="location">{{ sync_folder_name }}</span>
        </p>
        <button type="button" @click="sync_folder">Choose folder</button>
      </preference>
    </article>
  </menu>
</template>

<style lang="stylus">
  menu.preferences-menu {
    display: grid;
    gap: base-line * 1.5;
    grid-template-columns: 1fr;
    margin: 0 auto;
    padding: 0;
    border: none;
    max-width: base-line * 52;
    & > article {
      align-self: start;
      & > h3 {
        color: var(--emphasis);
        margin: 0 0 base-line;
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

  fieldset.preference .tweakpane-slide {
    display: grid;
    grid-template-rows: 0fr;
    margin-top: base-line;
    overflow: hidden;
    transition: grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1);
    &.open {
      grid-template-rows: 1fr;
    }
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
    .tweakpane-slide-inner {
      min-height: 0;
      overflow: hidden;
      opacity: 0;
      translate: 0 -0.35rem;
      transition: opacity 280ms cubic-bezier(0.22, 1, 0.36, 1),
        translate 280ms cubic-bezier(0.22, 1, 0.36, 1);
      @media (prefers-reduced-motion: reduce) {
        transition: none;
      }
    }
    &.open .tweakpane-slide-inner {
      opacity: 1;
      translate: 0 0;
    }
  }

  fieldset.preference .tweakpane-3d {
    --tp-base-background-color: var(--basalt);
    --tp-base-shadow-color: transparent;
    --tp-base-border-radius: round((base-line / 3), 2);
    --tp-base-font-family: inherit;
    --tp-container-background-color: alpha(white, 0.04);
    --tp-container-background-color-hover: alpha(white, 0.07);
    --tp-container-background-color-focus: alpha(white, 0.07);
    --tp-container-background-color-active: alpha(white, 0.10);
    --tp-container-foreground-color: var(--white-text);
    --tp-input-background-color: alpha(white, 0.06);
    --tp-input-background-color-hover: var(--accent);
    --tp-input-background-color-focus: var(--accent);
    --tp-input-background-color-active: var(--accent);
    --tp-input-foreground-color: var(--white-text);
    --tp-label-foreground-color: var(--white-text);
    --tp-groove-foreground-color: alpha(white, 0.08);
    --tp-button-background-color: alpha(white, 0.06);
    --tp-button-background-color-hover: var(--accent);
    --tp-button-background-color-focus: var(--accent);
    --tp-button-background-color-active: var(--accent);
    --tp-button-foreground-color: var(--white-text);
    --tp-monitor-background-color: alpha(white, 0.04);
    --tp-monitor-foreground-color: var(--white-text);
    .tp-dfwv {
      width: 100%;
      position: static;
    }
  }
</style>
