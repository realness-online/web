const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

/** Text as markup: the four characters that would break an attribute or a tag. */
export const escape = value => String(value ?? '').replace(/[&<>"]/g, char => ENTITIES[char])
