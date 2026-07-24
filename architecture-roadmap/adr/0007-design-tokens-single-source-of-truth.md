# 0007. Design.MD as the single source of truth for design tokens

## Status
Accepted (retroactively documented)

## Context
The UI (dark-by-default glassmorphism aesthetic, `Sansation` typography, an
indigo/amber accent system per `Design.MD`) needs consistent CSS variables
across the app, editable by non-engineers without needing to hand-edit
generated CSS.

## Decision
`Design.MD` documents design tokens as markdown tables (CSS variable | dark
value | light value | description). `scripts/sync-design.js` parses those
tables with a regex and regenerates the corresponding `:root`/`.dark` token
blocks in `app/globals.css`. `next.config.ts` auto-spawns
`sync-design.js --watch` whenever `NODE_ENV === "development"`, so editing
`Design.MD` live-updates styles during `npm run dev`. `npm run sync-design`
runs it once (e.g. for CI/build); `npm run watch-design` runs the watcher
standalone.

## Consequences
- `Design.MD` must be edited, not `app/globals.css`'s generated token blocks —
  direct edits there are overwritten by the next sync.
- The regex-based parser in `scripts/sync-design.js` is coupled to the exact
  markdown table format in `Design.MD`; reformatting the tables (e.g. changing
  column order) silently breaks token generation.
- Non-token styling (component-level Tailwind classes, glassmorphism utility
  patterns) is documented in `Design.MD` prose but not enforced by tooling —
  consistency there relies on developers following the doc, not a linter.
