import { expect } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

/**
 * Wait for the newest email to an address. Poll for up to 20 seconds.
 * @param {string} address
 * @returns {Promise<{ subject: string, text: string }>}
 */
export async function waitForEmail(address) {
  let found = null;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
        );
        const { messages = [] } = await search.json();
        if (messages.length === 0) return false;
        // Mailpit lists the newest message first.
        const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
        const data = await message.json();
        found = { subject: data.Subject, text: data.Text };
        return true;
      },
      { timeout: 20_000, message: `No email arrived for ${address}.` },
    )
    .toBe(true);
  return found;
}

/**
 * Find the first link in a text that contains a path.
 * @param {string} text
 * @param {string} path For example "/verify-email/".
 * @returns {string}
 */
export function linkWithPath(text, path) {
  const match = text.match(new RegExp(`https?://[^\\s<>"]*${path}[^\\s<>"]*`));
  if (!match) throw new Error(`No link with ${path} in the email.`);
  return match[0];
}
