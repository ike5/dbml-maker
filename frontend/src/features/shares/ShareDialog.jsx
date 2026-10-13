import { Button, Dialog } from "../../ui/index.js";
import { text } from "../../text/en.js";
import { format } from "../../text/format.js";
import { PeopleSection } from "./PeopleSection.jsx";
import { PublicLinkSection } from "./PublicLinkSection.jsx";
import "./shares.css";

/**
 * The dialog to share a diagram (DESIGN.md §12.10). Only an owner opens it.
 * @param {object} props
 * @param {string} props.diagramId
 * @param {string} props.diagramName
 * @param {() => void} props.onClose
 */
export function ShareDialog({ diagramId, diagramName, onClose }) {
  return (
    <Dialog
      title={format(text.shares.title, { name: diagramName })}
      onClose={onClose}
      footer={<Button onClick={onClose}>{text.common.close}</Button>}
    >
      <PeopleSection diagramId={diagramId} />
      <PublicLinkSection diagramId={diagramId} />
    </Dialog>
  );
}
