/**
 * Give a Blob to the browser as a file. The browser shows its own save step.
 * @param {Blob} blob
 * @param {string} fileName
 */
export function saveFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // The download has already started when click returns. Revoke the URL so the Blob can be freed.
  URL.revokeObjectURL(url);
}
