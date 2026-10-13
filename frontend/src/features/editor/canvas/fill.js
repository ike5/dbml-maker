/** Put values into the {name} places of a text from en.js. */
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}
