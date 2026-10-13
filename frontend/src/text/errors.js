import { text } from "./en.js";

/**
 * Give the text for an ApiError. The order is: the text of the code, the
 * message of the server, and then a general message.
 * @param {{ code?: string, message?: string } | null | undefined} error
 * @returns {string}
 */
export function errorMessage(error) {
  if (error?.code && Object.hasOwn(text.errors.byCode, error.code)) {
    return text.errors.byCode[error.code];
  }
  return error?.message || text.errors.general;
}
