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
    email: "Email address",
    password: "Password",
    passwordHint: "Use 10 characters or more. Do not use a common password.",
    newPassword: "New password",
    currentPassword: "Current password",
    login: {
      title: "Log in",
      submit: "Log in",
      toSignup: "Make an account",
      toReset: "Forgot your password?",
      unverified:
        "You did not verify your email address. Open the link in the verification email, then log in again.",
      resetDone: "The system set your new password. Log in with it.",
      accountDeleted: "The system deleted your account.",
    },
    signup: {
      title: "Sign up",
      submit: "Sign up",
      toLogin: "Log in to an existing account",
      sent: "The system sent an email to the address. Open the link in the email to verify your address.",
      closed: "Sign-up is closed. The operator of this system can make accounts for users.",
    },
    verify: {
      title: "Verify your email address",
      working: "The system verifies your email address.",
      done: "Your email address is verified. Log in to continue.",
      invalid: "The link is not correct, or it is old. Log in to ask for a new link.",
      toLogin: "Go to the login page",
    },
    resetRequest: {
      title: "Reset your password",
      submit: "Send the reset email",
      sent: "If an account has this address, the system sent an email. Open the link in the email.",
      toLogin: "Back to the login page",
    },
    reset: {
      title: "Set a new password",
      submit: "Set the password",
      invalid: "The link is not correct, or it is old. Ask for a new email.",
      toRequest: "Ask for a new email",
    },
    settings: {
      title: "Settings",
      emailTitle: "Email address",
      currentEmail: "Your email address is {email}.",
      newEmail: "New email address",
      emailSubmit: "Change the address",
      emailSent:
        "The system sent a verification email to {email}. The address changes after you open the link in the email.",
      passwordTitle: "Password",
      passwordSubmit: "Change the password",
      passwordChanged: "The system changed your password.",
      deleteTitle: "Delete account",
      deleteBody:
        "The system deletes your account and all diagrams in your personal workspace. You cannot undo this action.",
      deleteOpen: "Delete account",
      deleteDialogTitle: "Delete your account?",
      deleteDialogBody:
        "The system deletes all diagrams in your personal workspace. You cannot undo this action. Enter your password to continue.",
      deleteConfirm: "Delete the account",
    },
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

  // Owner: editor canvas (src/features/editor/canvas/)
  editorCanvas: {
    canvasLabel: "Diagram canvas",
    controlsLabel: "Canvas controls",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fitView: "Fit the diagram to the view",
    markPrimaryKey: "PK",
    markNotNull: "NN",
    markUnique: "UQ",
    titlePrimaryKey: "Primary key",
    titleNotNull: "Not null",
    titleUnique: "Unique",
    tableNote: "Note: {note}",
    columnNote: "{name}. Note: {note}",
    // {from} and {to} are table and column names. {kind} is one of the four cardinality texts.
    refTitle: "Ref: {from} to {to} ({kind})",
    cardinality: {
      "1-1": "one to one",
      "1-n": "one to many",
      "n-1": "many to one",
      "n-n": "many to many",
    },
  },

  // Owner: versions (src/features/versions/)
  versions: {},

  // Owner: shares (src/features/shares/)
  shares: {},

  // Owner: import-export (src/features/import-export/)
  importExport: {},
};
