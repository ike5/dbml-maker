// Starts and stops the parse scheduler and the autosave of one open diagram.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { parse } from "../../lib/dbml/index.js";
import { updateDiagram } from "../../lib/api/diagrams.js";
import { createAutosave } from "./autosave.js";
import { createParseScheduler } from "./parse.js";

/**
 * @param {ReturnType<typeof import("./store.js").createEditorStore>} store
 * @param {{ autosave: boolean }} options Autosave is off on the public view page.
 * @returns The autosave object, or null if autosave is off.
 */
export function useEditorRuntime(store, { autosave: withAutosave }) {
  const queryClient = useQueryClient();
  const [autosave] = useState(() =>
    withAutosave
      ? createAutosave({
          store,
          save: updateDiagram,
          onNameSaved: () => queryClient.invalidateQueries({ queryKey: ["diagrams"] }),
        })
      : null,
  );

  useEffect(() => {
    const scheduler = createParseScheduler({ store, parse });
    scheduler.start();
    autosave?.start();
    return () => {
      scheduler.stop();
      autosave?.stop();
    };
  }, [store, autosave]);

  return autosave;
}
