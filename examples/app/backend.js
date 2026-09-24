// The dev Backend: the store's writable seam over the Vite file API. g5 puts the
// same endpoints on the host, after auth; the shape does not change.
// Relative to the app's own base, so a published /s/<id>/ app calls /s/<id>/api.
const API = `${import.meta.env.BASE_URL}api`

const json = async response => {
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
  return response.json()
}

export const backend = {
  upload: async (path, body) => json(await fetch(`${API}/file/${path}`, { method: 'PUT', body })),

  remove: async path => {
    await fetch(`${API}/file/${path}`, { method: 'DELETE' })
  },

  move: async (from, to) => {
    const response = await fetch(`${API}/move`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from, to })
    })
    return response.ok
  },

  url: path => Promise.resolve(`${API}/file/${path}`),

  directory: async path => json(await fetch(`${API}/dir/${path}`)),

  online: () => navigator.onLine,
  signed_in: () => true,
  can_read: () => true
}