# `src/` layout

Where frontend code goes, and the rules that keep it from re-accumulating
7,000-line files. Full rationale: [`docs/11-nextjs-migration.md`](../docs/11-nextjs-migration.md).

```
src/
├── features/     ← real product code, one folder per feature
├── shared/       ← code used by MORE THAN ONE feature
├── config/       ← env + static configuration
├── lib/          ← LEGACY, being emptied into shared/
├── views/        ← LEGACY, being emptied into features/
├── components/   ← LEGACY, being emptied into shared/
└── legacy/       ← migration scaffolding, deleted in Phase 4
```

## Feature modules

Each feature is self-contained and exposes one public surface:

```
src/features/quizzes/
├── components/
│   ├── QuizList.tsx
│   └── QuizList.module.css     ← co-located, scoped styles
├── hooks/useQuizzes.ts
├── api.ts                      ← the ONLY place quizzes touch the network
├── types.ts
└── index.ts                    ← public surface; everything else is private
```

Route segments under `app/` stay thin — resolve params, set metadata, render
one feature component. No business logic in `app/`.

## Import rules (lint-enforced)

| From | May import | May **not** import |
|---|---|---|
| `app/**` | `features`, `shared`, `config` | — |
| `features/a` | `shared`, `config` | `features/b`, `app` |
| `shared` | `shared`, `config` | `features`, `app` |
| `config` | — | everything else |

A feature needing another feature's code is the signal to promote that code
to `shared/` — an explicit, reviewable decision rather than a quiet
cross-dependency.

## Other standing rules

- **Styling:** design tokens and reset in `app/globals.css`; layout, spacing
  and colour via Tailwind utilities; keyframes and complex selectors in a
  co-located `*.module.css`. No new global CSS.
- **Networking:** components never call `fetch`. Only `features/*/api.ts`
  does, through `shared/lib/apiClient`.
- **Env:** never read `process.env` in a component — go through
  `config/env.ts`.
- **File size:** 400 lines warns, 600 errors. Split before you hit it.

## Legacy folders

`lib/`, `views/`, and `components/` predate the migration. They still ship —
the whole pre-migration app renders through `app/[[...slug]]` — but they are
being dismantled route by route. **Don't add to them.** Moving a file out of
one of them is the normal way work happens in Phase 3.
