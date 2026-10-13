// The parse result is the only shape that the rest of the app sees (DESIGN.md §13.2).
// It has plain JSON values only, because it goes through postMessage.

/**
 * @typedef {object} Column
 * @property {string} name
 * @property {string} type The full type text, for example `varchar(255)`.
 * @property {boolean} pk
 * @property {boolean} notNull
 * @property {boolean} unique
 * @property {boolean} increment
 * @property {string | null} default A short text, for example `now()`, `'active'`, or `0`.
 * @property {string | null} note
 */

/**
 * @typedef {object} Index
 * @property {string[]} columns Column names or expression texts.
 * @property {boolean} unique
 * @property {boolean} pk
 * @property {string | null} name
 * @property {string | null} type
 * @property {string | null} note
 */

/**
 * @typedef {object} Table
 * @property {string} key `<schema>.<name>`
 * @property {string} schema
 * @property {string} name
 * @property {string | null} alias
 * @property {string | null} note
 * @property {string | null} headerColor
 * @property {Column[]} columns
 * @property {Index[]} indexes
 */

/**
 * @typedef {object} RefEnd
 * @property {string} tableKey
 * @property {string[]} columns
 */

/**
 * @typedef {object} Ref
 * @property {string} key The name of the ref, or a text made from the two ends.
 * @property {RefEnd} from
 * @property {RefEnd} to
 * @property {"1-1" | "1-n" | "n-1" | "n-n"} cardinality
 * @property {string | null} onDelete
 * @property {string | null} onUpdate
 */

/**
 * @typedef {object} Enum
 * @property {string} key `<schema>.<name>`
 * @property {string} schema
 * @property {string} name
 * @property {{ name: string, note: string | null }[]} values
 */

/**
 * @typedef {object} Group
 * @property {string} name
 * @property {string[]} tableKeys
 * @property {string | null} color
 */

/**
 * @typedef {object} ParseResult
 * @property {{ name: string | null, note: string | null } | null} project
 * @property {Table[]} tables
 * @property {Ref[]} refs
 * @property {Enum[]} enums
 * @property {Group[]} groups
 */
