import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "out/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/app/layout.tsx"],
    // DESIGN.md keeps the shared font stylesheet in the App Router root layout.
    // This rule expects the Pages Router's pages/_document.js instead.
    rules: { "@next/next/no-page-custom-font": "off" },
  },
];

export default config;
