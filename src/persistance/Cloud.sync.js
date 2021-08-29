import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import hash from 'object-hash'
import { get, del, set, keys } from 'idb-keyval'
import { as_filename, as_author, list } from '@/helpers/itemid'
import { Offline } from '@/persistance/Storage'

export const three_minutes = 180000
export const one_hour = 3600000
export const timeouts = []
export const hash_options = { encoding: 'base64', algorithm: 'md5' }
export const does_not_exist = { updated: null, customMetadata: { md5: null } } // Explicitly setting null to indicate that this file doesn't exist

export async function sync_later (id, action) {
  const offline = (await get('sync:offline')) || []
  offline.push({
    id,
    action
  })
  await set('sync:offline', offline)
}
export async function is_stranger (id) {
  const relations = await list(`${localStorage.me}/relations`)
  relations.push({
    id: localStorage.me,
    type: 'person'
  })
  const is_friend = relations.some(relation => {
    if (relation.id === id) return true
    else return false
  })
  return !is_friend
}
export async function sync_offline_actions () {
  if (navigator.onLine) {
    const offline = await get('sync:offline')
    if (!offline) return
    while (offline.length) {
      const item = offline.pop()
      if (item.action === 'save') await new Offline(item.id).save()
      else if (item.action === 'delete') await new Offline(item.id).delete()
      else console.info('weird:unknown-offline-action', item.action, item.id)
    }
    await del('sync:offline')
  }
}
export async function prune () {
  console.log('prune')
  const relations = await list(`${localStorage.me}/relations`)
  const everything = await keys()
  everything.forEach(async itemid => {
    if (!as_author(itemid)) return // items have authors
    if (await is_stranger(as_author(itemid), relations)) await del(itemid)
    if (await itemid.endsWith('/')) await del(itemid) // is a directory
    else {
      const network = await fresh_metadata(itemid)
      if (!network || !network.customMetadata) return null
      const md5 = await local_md5(itemid)
      if (network.customMetadata.md5 !== md5) {
        console.log('outdated', itemid)
        await del(itemid)
      }
    }
  })
}
export async function local_md5 (itemid) { // always checks the network
  const local = await get(itemid)
  if (!local) return null
  return hash(local, hash_options)
}
export async function fresh_metadata (itemid) {
  const index = (await get('sync:index')) || {}
  const path = firebase.storage().ref().child(as_filename(itemid))
  let network
  try {
    // console.info('request:metadata', itemid)
    network = await path.getMetadata()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      network = does_not_exist
    } else throw e
  }
  if (!network) throw new Error(`Unable to create metadata for ${itemid}`)
  index[itemid] = network
  await set('sync:index', index)
  return network
}
export function visit_interval () {
  return (Date.now() - one_hour)
}
