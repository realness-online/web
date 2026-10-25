import { product_import } from './product.js'

export const {
  person,
  local_person,
  plans_path,
  plans_ignore,
  sessions_path,
  runtime_sessions_path,
  state_path,
  is_actor,
  harness_root
} = await product_import('harness/settings')
