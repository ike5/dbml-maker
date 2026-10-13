/**
 * Replace each {name} token in a template with a value.
 * A token without a value stays in the text, so that a defect is easy to see.
 * @param {string} template
 * @param {Record<string, string | number>} [values]
 * @returns {string}
 */
export function format(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (token, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : token,
  );
}
