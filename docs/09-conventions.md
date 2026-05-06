# 09 — Conventions

Rules for adding code without breaking the look or the architecture.

## Buttons

Use `<Button variant="primary|secondary|outline|danger" />` from `src/components/ui/button.jsx`. Pass layout / sizing classes through `className` (`w-full`, `mt-3`, `px-4`).

**Never** override `bg-*` or `text-*` on a `<Button>` via `className`. Tailwind class collisions can produce cream-on-cream invisible buttons. If you need a new color treatment, add a variant inside `button.jsx`.

## Headings

Serif heading + one italic-red accent word:

```jsx
<h2 className="font-serif text-4xl font-medium text-ink">
  Templates <em className="italic font-light text-accent">library</em>
</h2>
```

Section / page header sizes:

- `text-5xl` for top-level greetings (Dashboard "Good morning")
- `text-4xl` for view titles (Templates library, Reusable drafts)
- `text-2xl` for inner section headers (Today's schedule)
- `text-xl` for card titles (template name)

## Eyebrows

Mono uppercase, 10px, tracking 0.18em, muted color. Optionally prefixed with a 6px red dash:

```jsx
<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5">
  <span className="w-6 h-px bg-accent" /> Templates
</p>
```

Use on top-level sections; omit the dash for inline metadata captions.

## Status / progress pills

Always: line-bordered paper pill + 1.5px colored dot + mono uppercase 9–10px text.

## Subject badges

Use `<SubjectBadge subject={...} />` from `_shared.jsx`. Don't hand-roll subject tags — keep the color mapping centralized.

## When to use which font

- `font-serif` (Fraunces) — headings, italic accent words, italic links ("Use template →"), card titles.
- `font-mono` (JetBrains Mono) — eyebrows, status pills, tags, metadata, time labels. Always uppercase + tracking.
- `font-sans` (Inter Tight) — body, form labels, table rows, paragraph copy.

If you find yourself reaching for default sans, double-check that mono isn't more correct for the role.

## Colors

Stick to the `@theme` tokens (`bg-paper`, `text-ink`, `bg-accent`, etc.). Don't hardcode hex in JSX.

If a new role appears (e.g. a new subject color), add a token to `src/index.css` first, then use it.

## Forms

- Plain inputs: `className={inputClasses}` from `_shared.jsx`.
- Selects: `className={selectClasses}`.
- Wrap label + input in `<Field label="...">` from `_shared.jsx` for consistent label styling.
- Numbered multi-section forms: wrap each step in `<Section step="Section 2 of 4" title="..." subtitle="...">`.

## Iconography

`lucide-react`. Default size `15` for inline / button icons, `13–14` for tiny accents. Color from text token (`text-muted`, `text-accent`, etc.).

## State management

Local `useState` is fine — no external store. Cross-view navigation goes through `App.jsx`'s helpers (`goLessonPlans`, `goNewTemplate`, etc.). Don't reinvent navigation in a child view; expose an `onSomething` prop and let `App.jsx` decide what happens.

## Comments

Default to no comments. Only add one when the *why* is non-obvious (a hidden constraint, a workaround, a subtle invariant). Don't explain *what* the code does — names should carry that.

## Files

- One view per file in `src/views/`.
- Shared primitives go in `src/views/_shared.jsx`.
- Reusable components (Button, Card, future ones) in `src/components/ui/`.
- Don't create new top-level folders without a reason.

## Reference data (enums)

Allowed values for **majors**, **grade levels**, and **nationality** live in a single file: [`src/lib/enums.js`](../src/lib/enums.js). It exports `MAJORS`, `GRADE_LEVELS`, and `NATIONALITIES`.

Rules:

- **Never hardcode these values** in views, validation, or seed data. Always import from `enums.js`.
- **Never let the user free-type** them. Use a `<select>` or multi-select bound to the enum list. Free text leads to "Biology" vs "biology" vs "bio" rot.
- **Add new values to `enums.js` and re-run `npm run db:init`.** The init script rebuilds the DB `CHECK` constraints from the JS lists, so a new value won't actually be insertable until the constraint is refreshed.
- The DB rejects unknown values via `CHECK` constraints — so a typo in seed data or a future POST handler will surface as a 500 rather than silently corrupt the column.

If you need a new constrained enum (e.g. a fixed list of guardian relationships), add it to `enums.js`, export it, add a CHECK constraint in `db/init.js`, and re-run init.

## Things to avoid

- Don't reintroduce `index.html` marketing scaffolding — `index.html` is the Vite shell only.
- Don't add `react-router-dom` for the current scope — view state in `App.jsx` is enough.
- Don't add an ORM unless the schema grows past 4–5 tables.
- Don't bypass `pg` Pool — share the existing pool in `vite.config.js`.
- Don't commit `.env`.
- Don't hardcode majors / grade levels / nationalities in any file other than `src/lib/enums.js`.
