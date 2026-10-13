/**
 * A layer key only ever changes its own layer. With the group off there is
 * nothing on screen to change, so the key means "show me this one": the group
 * comes on carrying that layer alone, rather than every layer whose preference
 * happened to be left on.
 *
 * Its own module, and pure over the refs it is handed: `preference.js` reaches
 * storage, which a test that only wants this rule should not have to stand up.
 *
 * @param {import('vue').Ref<boolean>} layer
 * @param {import('vue').Ref<boolean>} group
 * @param {Record<string, import('vue').Ref<boolean>>} siblings
 */
export const toggle_layer = (layer, group, siblings) => {
  if (group.value) {
    layer.value = !layer.value
    return
  }
  for (const sibling of Object.values(siblings))
    sibling.value = sibling === layer
  group.value = true
}
