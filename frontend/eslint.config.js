import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Module rules of DESIGN.md §12.3. Each block bans one set of imports.
const banImports = (patterns) => ({ "no-restricted-imports": ["error", { patterns }] });

const dbmlOnly = {
  group: ["@dbml/core", "@dbml/core/*"],
  message: "Only src/lib/dbml/ imports @dbml/core.",
};
const canvasOnly = {
  group: ["@xyflow/react", "@xyflow/react/*", "elkjs", "elkjs/*", "html-to-image"],
  message: "Only src/features/editor/canvas/ imports React Flow, elkjs, and html-to-image.",
};
const codeOnly = {
  group: ["@codemirror/*", "codemirror"],
  message: "Only src/features/editor/code/ imports CodeMirror.",
};
const noFeatures = {
  regex: "(^|/)features(/|$)",
  message: "src/ui/ and src/lib/ must not import from src/features/.",
};
// A feature imports another feature only through its index.js. A relative
// path with N "../" steps and a folder name reaches a different feature when N
// is the depth of the file below src/features/<feature>/. The "(?!index\\.js$)"
// part lets the index.js file pass. A name that starts with "." is a "../" step.
const deepImport = (depth) => ({
  regex: `^(\\.\\./){${depth}}[^/.][^/]*/(?!index\\.js$).+`,
  message: "Import a different feature only through its index.js.",
});

// Every source file gets the three bans of the third-party packages. A block
// below replaces the list for a folder that may import one package.
const base = [dbmlOnly, canvasOnly, codeOnly];

export default [
  { ignores: ["dist/", "coverage/", "playwright-report/", "test-results/", "node_modules/"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, __APP_RELEASE__: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "react/no-danger": "error",
    },
  },
  {
    // Config files run in Node.
    files: ["*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // §12.8: no literal text in JSX. Test files may use literals.
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/**/*.test.{js,jsx}", "src/test/**"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ["/", "-", "|", ":", ",", ".", "(", ")", "+", "·", "…"],
        },
      ],
    },
  },
  {
    // §12.3: only src/lib/api/ calls fetch.
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/lib/api/**", "src/**/*.test.{js,jsx}", "src/test/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Only src/lib/api/ calls fetch." },
      ],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    rules: banImports(base),
  },
  {
    files: ["src/lib/**/*.{js,jsx}", "src/ui/**/*.{js,jsx}"],
    rules: banImports([...base, noFeatures]),
  },
  {
    files: ["src/lib/dbml/**/*.{js,jsx}"],
    rules: banImports([canvasOnly, codeOnly, noFeatures]),
  },
  {
    files: ["src/features/*/*.{js,jsx}"],
    rules: banImports([...base, deepImport(1)]),
  },
  {
    files: ["src/features/*/*/*.{js,jsx}"],
    rules: banImports([...base, deepImport(2)]),
  },
  {
    files: ["src/features/*/*/*/**/*.{js,jsx}"],
    rules: banImports([...base, deepImport(3)]),
  },
  {
    files: ["src/features/editor/canvas/**/*.{js,jsx}"],
    rules: banImports([dbmlOnly, codeOnly, deepImport(2), deepImport(3)]),
  },
  {
    files: ["src/features/editor/code/**/*.{js,jsx}"],
    rules: banImports([dbmlOnly, canvasOnly, deepImport(2), deepImport(3)]),
  },
];
