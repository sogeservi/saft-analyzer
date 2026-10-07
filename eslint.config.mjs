import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/api/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "fs", message: "API routes must not access the filesystem." },
            { name: "node:fs", message: "API routes must not access the filesystem." },
            { name: "fs/promises", message: "API routes must not access the filesystem." },
            { name: "node:fs/promises", message: "API routes must not access the filesystem." },
          ],
          patterns: [
            { group: ["fs/*", "node:fs/*"], message: "API routes must not access the filesystem." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
