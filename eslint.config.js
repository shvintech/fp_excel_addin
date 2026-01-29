// import js from '@eslint/js'
// import globals from 'globals'
// import reactHooks from 'eslint-plugin-react-hooks'
// import reactRefresh from 'eslint-plugin-react-refresh'
// import { defineConfig, globalIgnores } from 'eslint/config'

// export default defineConfig([
//   globalIgnores(['dist']),
//   {
//   //   files: ['**/*.{ts,tsx}'],
//   //   extends: [
//   //     js.configs.recommended,
//   //     reactHooks.configs['recommended-latest'],
//   //     reactRefresh.configs.vite,
//   //   ],
//   //   languageOptions: {
//   //     ecmaVersion: 2020,
//   //     globals: globals.browser,
//   //     parserOptions: {
//   //       ecmaVersion: 'latest',
//   //       ecmaFeatures: { jsx: true },
//   //       sourceType: 'module',
//   //     },
//   //   },
//   //   rules: {
//   //     'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
//   //   },
//   // },

//   /**
//    * -------------------------
//    * TS / TSX
//    * -------------------------
//    */
//     files: ["**/*.{ts,tsx}"],
//     extends: [
//       js.configs.recommended,
//       ...tseslint.configs.recommended,
//       reactHooks.configs["recommended-latest"],
//       reactRefresh.configs.vite,
//     ],
//     languageOptions: {
//       parser: tseslint.parser,
//       ecmaVersion: "latest",
//       sourceType: "module",
//       globals: globals.browser,
//     },
//     plugins: {
//       react,
//     },
//     rules: {
//       /* React */
//       "react/react-in-jsx-scope": "off",
//       "react/prop-types": "off",
//       "no-unused-vars": "off",
//       "@typescript-eslint/no-unused-vars": "error",
//     },
//   },
// ])

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react"; // ✅ add this
import tseslint from "typescript-eslint"; // ✅ add this
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    plugins: {
      react, // now properly imported
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
    },
  },
]);
