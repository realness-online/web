/**
 * lc1: where this Mac keeps the local stack's secrets and sign-in store.
 * Under the harness's `.pi/agent/`, which git ignores, sync never carries,
 * and the artifacts prune never reaches. A halo VM gets its copies under
 * `/etc/realness/`, never through a shared folder.
 */
import { join } from 'node:path'
import { project_root } from './layout.js'

const agent = (root = join(project_root, '..', '..')) =>
  join(root, '.pi', 'agent')

/** One secret file: `halo-pass-secret`, `model-pass-secret`, `openrouter-key`. */
export const secret_path = (name, root) => join(agent(root), 'secrets', name)

/** The local sign-in store: its signing key and sessions. */
export const sign_in_dir = root => join(agent(root), 'state', 'sign-in')

/** Where a halo VM keeps the same secrets. */
export const GUEST_SECRETS = '/etc/realness'
