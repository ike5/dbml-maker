// All UI text of the SPA, in ASD-STE100 (DESIGN.md §12.8).
// Each feature changes only its own section. Keep an empty line between sections.

export const text = {
  // Owner: app (src/app/)
  app: {
    name: "DBML Maker",
    nav: {
      diagrams: "Diagrams",
      trash: "Trash",
      settings: "Settings",
      main: "Main navigation",
    },
    logout: "Log out",
    releaseBanner: "A new release is available. Reload the page.",
    reload: "Reload",
    notFoundTitle: "Page not found",
    notFoundBody: "The page does not exist, or you have no access to it.",
    errorTitle: "An error occurred",
    errorBody: "The page cannot show this content. Reload the page, or go to the start page.",
    goHome: "Go to the start page",
  },

  // Owner: ui (src/ui/)
  common: {
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    loading: "Loading",
    retry: "Try again",
    more: "More actions",
    emptyTitle: "Nothing here",
  },

  // Owner: app (src/text/errors.js). One message for each error code (DESIGN.md §7.11).
  errors: {
    general: "An error occurred. Try again.",
    byCode: {
      network_error: "The server does not answer. Make sure that you are online. Then try again.",
      server_error: "The server had an error. Try again later.",
      validation_failed: "The input is not correct. Examine the fields.",
      invalid_if_match: "The change number is not correct. Reload the page.",
      share_self: "You cannot share a diagram with your own email address.",
      not_authenticated: "You are not logged in. Log in and try again.",
      reauthentication_required: "Enter your password again, then try the action again.",
      permission_denied: "You have no permission for this action.",
      diagram_forbidden: "Your role does not let you do this action.",
      not_found: "The page or the object does not exist.",
      diagram_not_found: "The diagram does not exist, or you have no access to it.",
      version_not_found: "The version does not exist.",
      share_not_found: "The share does not exist.",
      public_link_not_found: "The public link does not exist, or it is off.",
      diagram_not_in_trash: "The diagram must be in the trash before you delete it permanently.",
      share_exists: "The diagram has a share for this email address.",
      share_limit: "The diagram has the maximum number of shares.",
      public_link_off: "The public link is off. Turn it on first.",
      diagram_conflict:
        "Another person changed this diagram. Load the new version, or keep your version.",
      source_too_large: "The source is too large.",
      layout_too_large: "The layout is too large.",
      precondition_required: "The request has no change number. Reload the page.",
      throttled: "There are too many requests. Wait and try again.",
    },
  },

  // Owner: auth (src/features/auth/)
  auth: {
    stubLogin: "Log in",
    stubSignup: "Sign up",
    stubVerifyEmail: "Verify your email address",
    stubResetRequest: "Reset your password",
    stubReset: "Set a new password",
    stubSettings: "Settings",
  },

  // Owner: diagrams (src/features/diagrams/)
  diagrams: {
    title: "Diagrams",
    tabsLabel: "Diagram lists",
    tabMine: "My diagrams",
    tabShared: "Shared with me",
    newDiagram: "New diagram",
    importDiagram: "Import",
    defaultName: "Untitled diagram",
    nameLabel: "Name",
    nameEmpty: "Type a name.",
    nameTooLong: "The name must have 200 characters or fewer.",
    make: "Make",
    rename: "Rename",
    renameTitle: "Rename the diagram",
    open: "Open",
    duplicate: "Duplicate",
    moveToTrash: "Move to trash",
    trashTitle: "Move the diagram to the trash",
    trashBody:
      "The diagram {name} goes to the trash. You can restore it for 30 days. After that, the system deletes it.",
    copyOf: "Copy of {name}",
    duplicated: "The system made a copy of the diagram.",
    openCopy: "Open the copy",
    changedBy: "Changed {time} by {person}",
    changed: "Changed {time}",
    justNow: "just now",
    roleOwner: "Owner",
    roleEditor: "Editor",
    roleViewer: "Viewer",
    actionsFor: "Actions for {name}",
    loadMore: "Load more",
    emptyMine: "You have no diagrams. Make a new diagram, or import a file.",
    emptyShared: "No person shared a diagram with you.",
    trashHeading: "Trash",
    trashEmpty: "The trash is empty.",
    trashedAt: "Moved to trash {time}",
    deletesOn: "The system deletes it on {date}",
    restore: "Restore",
    deletePermanently: "Delete permanently",
    deleteTitle: "Delete the diagram permanently",
    deleteBody: "The system deletes the diagram {name} for ever. You cannot undo this action.",
  },

  // Owner: editor (src/features/editor/)
  editor: {
    stubEditor: "Editor",
    stubPublicView: "Public view",
  },

  // Owner: editor (src/features/editor/code/)
  editorCode: {
    defaultLabel: "DBML source",
  },

  // Owner: versions (src/features/versions/)
  versions: {},

  // Owner: shares (src/features/shares/)
  shares: {},

  // Owner: import-export (src/features/import-export/)
  importExport: {},
};
