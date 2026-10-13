import { useEffect, useState } from "react";
import { onReleaseMismatch } from "../lib/api/client.js";
import { Banner, Button } from "../ui/index.js";
import { text } from "../text/en.js";

/** Shows a bar when the server has a different release (DESIGN.md §11.5). */
export function ReleaseBanner() {
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => onReleaseMismatch(() => setMismatch(true)), []);

  if (!mismatch) return null;
  return (
    <Banner
      kind="warning"
      actions={
        <Button size="sm" onClick={() => window.location.reload()}>
          {text.app.reload}
        </Button>
      }
    >
      {text.app.releaseBanner}
    </Banner>
  );
}
