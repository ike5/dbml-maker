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
    stubList: "My diagrams",
    stubTrash: "Trash",
    copyOf: "Copy of {name}",
  },

  // Owner: editor (src/features/editor/)
  editor: {
    stubEditor: "Editor",
    stubPublicView: "Public view",
  },

  // Owner: versions (src/features/versions/)
  versions: {},

  // Owner: shares (src/features/shares/)
  shares: {},

  // Owner: import-export (src/features/import-export/)
  importExport: {},
};
