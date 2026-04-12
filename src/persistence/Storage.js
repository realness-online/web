/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { Storage } from '@/persistence/Repository'
import { Local } from '@/persistence/Local'
import { Large } from '@/persistence/Large'
import { Cloud } from '@/persistence/Cloud'
import { Paged } from '@/persistence/Paged'
import { current_user, me } from '@/utils/serverless'
import { as_type, as_created_at, as_query_id, is_itemid } from '@/utils/itemid'
import { get } from 'idb-keyval'
import { profile_sync_log } from '@/utils/profile-sync-log'

export { Storage }
export { History } from '@/persistence/History'

/**
 * @extends {Storage}
 */
class Cached extends Large(Cloud(Storage)) {
  async save(
    items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined
  ) {
    await super.save(items ?? undefined)
  }
}

/**
 * @extends {Storage}
 */
export class Poster extends Large(Cloud(Storage)) {}

/**
 * @extends {Cached}
 */
export class Cutout extends Cached {}

/**
 * @extends {Cached}
 */
export class Shadow extends Cached {}

/**
 * @extends {Storage}
 */
export class Me extends Cloud(Local(Storage)) {
  constructor() {
    super(localStorage.me)
  }

  async save(
    items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined
  ) {
    if (!current_user.value) return
    const me_val =
      /** @type {{name?: string, visited?: string, avatar?: string} | null | undefined} */ (
        me.value
      )
    if (!me_val) return
    const { name } = me_val
    if (typeof name !== 'string' || name.trim().length < 3) {
      profile_sync_log('me_save_skipped_incomplete_profile', {
        itemid: this.id
      })
      return
    }
    if (!me_val.visited) me_val.visited = new Date().toISOString()
    profile_sync_log('me_save_persist', {
      itemid: this.id,
      name: me_val.name,
      avatar: me_val.avatar,
      visited: me_val.visited
    })
    await super.save(items ?? undefined)
  }
}

/** @extends {Storage} */
export class Relation extends Cloud(Local(Storage)) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/relations`))
  }
}

/** @extends {Storage} */
export class Thought extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/thoughts`))
  }
}

/** @extends {Storage} - Per-statement storage. Saves individual statement divs by itemid. */
export class Statements extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/statements`))
  }

  /**
   * Save a single statement by finding it in the given scope (sync aside)
   * @param {Id} statement_id - e.g. /+me/statements/1234567890
   * @param {Document|Element} [scope] - Container to search within (sync aside)
   */
  save_statement(statement_id, scope = document) {
    const el = scope.querySelector(`[itemid="${statement_id}"]`)
    if (el) {
      localStorage.setItem(statement_id, el.outerHTML)
      return true
    }
    return false
  }
}

/** @extends {Storage} */
export class Event extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/events`))
  }
}

/** @extends {Storage} */
export class Offline extends Cloud(Storage) {
  async save() {
    const outer_html = await get(this.id)
    if (!outer_html) return

    let { id } = this
    if (id.startsWith('/+/'))
      id = /** @type {Id} */ (
        `${localStorage.me}/${as_type(id)}/${as_created_at(id)}`
      )
    if (!is_itemid(id)) {
      console.error('invalid itemid', id)
      return
    }

    const temp_container = document.createElement('div')
    temp_container.innerHTML = outer_html

    const content = temp_container.firstElementChild
    if (content) {
      content.setAttribute('itemid', id)
      content.id = as_query_id(id)
    }

    this.id = id
    await super.save({ outerHTML: temp_container.innerHTML })
  }
}
