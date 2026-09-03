import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

// The architectural rules from docs/11-nextjs-migration.md §6, made
// mechanical. Convention that isn't enforced is convention that erodes —
// this codebase already grew a 7,266-line component and a 2,018-line
// dictionary under a "keep files small" comment.
//
// Next 16 removed `next lint`, so this runs as its own CI step
// (npm run lint) rather than during `next build`.

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      // backend/ is explicitly out of scope for the Next.js migration
      // (docs/11-nextjs-migration.md §9). It's Node/Express, not browser
      // code, and linting it here would mean adopting a second set of
      // environment globals and a backlog of pre-existing findings that
      // nobody on this workstream is going to action. Give it its own
      // config when the backend gets its own modernisation project.
      "backend/**",
      // Vendored by `ruflo init` — its hook scripts, agent definitions and
      // helpers are third-party Node CJS, not project code. Linting them
      // against this config's browser globals produced 61 errors (47 of them
      // no-undef on `require`/`module`/`__dirname`) and turned `npm run lint`
      // red the moment the harness was installed. The directory is gitignored;
      // ruflo owns what is in it.
      ".claude/**",
      ".claude-flow/**",
      ".agents/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // `files` is REQUIRED here. ESLint flat config's implicit default covers
    // .js/.mjs/.cjs (plus .ts/.tsx via typescript-eslint) but NOT .jsx — so
    // without this every legacy view silently reported "File ignored because
    // no matching configuration was supplied" and 61 files went unlinted.
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        alert: "readonly",
        HTMLElement: "readonly",
        PopStateEvent: "readonly",
        AbortSignal: "readonly",
        React: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        Image: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        AbortController: "readonly",
        performance: "readonly",
        crypto: "readonly",
        structuredClone: "readonly",
        getComputedStyle: "readonly",
        matchMedia: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        SpeechSynthesisUtterance: "readonly",
        speechSynthesis: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        Node: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        DOMParser: "readonly",
        XMLHttpRequest: "readonly",
        HTMLImageElement: "readonly",
        HTMLCanvasElement: "readonly",
        SVGElement: "readonly",
        MediaRecorder: "readonly",
        requestIdleCallback: "readonly",
        Worker: "readonly",
        createImageBitmap: "readonly",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Unused vars are warnings, not errors — the legacy tree has many and
      // they must not block CI while it's being dismantled.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `any` is tolerated during the migration; Phase 5 tightens it with
      // strict mode.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // ── Next.js rules ──────────────────────────────────────────────────
  //
  // The tree already contained `eslint-disable-next-line @next/next/...`
  // comments while the plugin was not installed. ESLint reports a disable
  // comment for an unknown rule as an error on the comment itself, so the
  // suppressions were producing the very errors they looked like they were
  // silencing. Installing the plugin makes them mean what their authors
  // intended, and turns on the rest of the Next.js checks as a bonus.
  //
  // Note: `eslint-plugin-react` and `eslint-plugin-jsx-a11y` cannot join
  // them yet — both still cap their peer range at ESLint 9 and this repo is
  // on ESLint 10. The three `react/no-danger` and `jsx-a11y/*` disables are
  // written as plain comments until those plugins ship ESLint 10 support.
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    plugins: nextPlugin.configs["core-web-vitals"].plugins,
    rules: nextPlugin.configs["core-web-vitals"].rules,
  },

  // ── Module boundaries ──────────────────────────────────────────────
  //
  // A feature that needs another feature's code is the signal to promote
  // that code to shared/ — an explicit, reviewable decision instead of a
  // quiet cross-dependency that makes both features unmovable.
  {
    files: ["src/features/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*", "../*/features/*", "../../features/*"],
              message:
                "Features must not import each other's internals. Promote the shared code to src/shared/, or import the other feature's public index.",
            },
            {
              group: ["@app/*", "../../../app/*"],
              message:
                "Features must not import from app/ — dependencies point inward, toward shared/.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "../features/*", "../../features/*"],
              message:
                "shared/ must not depend on features/ — that inverts the dependency direction and creates a cycle.",
            },
            {
              group: ["@app/*"],
              message: "shared/ must not import from app/.",
            },
          ],
        },
      ],
    },
  },

  // ── File size budget ───────────────────────────────────────────────
  //
  // Applies to NEW code only. The legacy tree is exempted below — turning
  // this on globally would emit ~30 errors for files nobody is touching yet
  // and train everyone to ignore the linter.
  {
    files: ["src/features/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        { max: 600, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  // The same budget for feature code that is still .jsx.
  //
  // Scoping the rule above to {ts,tsx} left a hole exactly where the
  // problem is worst: StudioChat.jsx is 3,669 lines and was invisible to
  // the linter, while StudioShell.tsx was correctly failing at 611. Six
  // .jsx files under src/features/ are over budget.
  //
  // These are WARNINGS, not errors, for the reason given above — none of
  // them is being touched right now and a red CI on untouched files trains
  // everyone to ignore the linter. Each becomes an error for free when the
  // file is peeled to .tsx, because the block above already covers it.
  {
    files: ["src/features/**/*.jsx", "src/shared/**/*.jsx"],
    rules: {
      "max-lines": [
        "warn",
        { max: 600, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  // ── Legacy carve-outs ──────────────────────────────────────────────
  //
  // src/views, src/lib, src/components and src/legacy predate the
  // migration and are being dismantled route by route (Phase 3). They are
  // held to the language rules but not the architectural ones.
  {
    files: [
      "src/views/**",
      "src/lib/**",
      "src/components/**",
      "src/legacy/**",
    ],
    rules: {
      "max-lines": "off",
      "react-hooks/exhaustive-deps": "off",
      "no-empty": "off",
      // src/views is being dismantled route by route. A full-reload <a> in a
      // view that is scheduled for deletion is not worth converting to <Link>;
      // the equivalents under src/features/ were converted.
      "@next/next/no-html-link-for-pages": "warn",
      // Real smells, but in code that is being deleted route by route.
      // Warn so they're visible without failing CI on untouched files.
      "no-useless-escape": "warn",
      "no-useless-assignment": "warn",
      "preserve-caught-error": "warn",
      // Extending lint to .jsx surfaced ~110 pre-existing react-hooks
      // findings across the legacy views. They are genuine (stale closures,
      // components redefined per render, refs read during render) but they
      // predate the migration and none is a live crash — the two that were,
      // an unimported BrandLoader and an undefined setNewPopupOpen, are
      // fixed. Kept visible as warnings so CI isn't red on untouched files;
      // each converts as its view is decomposed.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/unsupported-syntax": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-irregular-whitespace": "warn",
    },
  },

  // The i18n dictionaries are data, not code — a 950-line key/value map is
  // the correct shape for them.
  {
    files: ["src/shared/i18n/en.ts", "src/shared/i18n/ar.ts"],
    rules: { "max-lines": "off" },
  },

  // Test and config files run in Node.
  {
    files: ["tests/**", "*.config.{ts,mjs,js}", "playwright.config.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "max-lines": "off",
    },
  }
);
