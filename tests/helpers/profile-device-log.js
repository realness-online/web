import { profile_sync_log } from '@/utils/profile-sync-log'

/**
 * @param {string} simulated_device
 * @param {string} event
 * @param {object} [detail]
 */
export const log_as_device = (simulated_device, event, detail = {}) => {
  profile_sync_log(event, { ...detail, simulated_device })
}
