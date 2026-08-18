import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["**/node_modules/**", "**/.next/**", "**/.expo/**", "**/dist/**", "**/coverage/**", "**/convex/_generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.es2024 } },
    rules: { "@typescript-eslint/no-explicit-any": "error" }
  }
];
