import { product_import } from './product.js'

export const { person, local_person, plans_path, plans_ignore, sessions_path, runtime_sessions_path } = await product_import('harness/settings')
