# Design System

Concise standards for UI consistency in the CoralSend web app. Implementation lives in `apps/web/src/app/globals.css` and shared components.

---

## Cursor & interaction

Mouse cursor behaviour follows these rules so the app feels like the web (clear affordance for clickable vs disabled).

| Cursor | Use when | Implementation |
|--------|----------|----------------|
| **pointer** (hand) | Any element that navigates or performs a primary action: links, buttons, icon buttons, clickable cards | Global: `a[href]`, `button:not(:disabled)`, `[role="button"]:not([aria-disabled="true"])` → `cursor: pointer`. Components: `Button`, `ActionButton`, clickable rows/cards use `cursor-pointer` where needed. |
| **not-allowed** | Disabled controls (buttons, switches, toggles) | Global: `button:disabled`, `[role="button"][aria-disabled="true"]` → `cursor: not-allowed`. Components: keep `disabled:cursor-not-allowed` on `Button`, `ActionButton`, `Switch` for clarity. |
| **default** (arrow) | Non-interactive content (body text, static layout, images) | No class; avoid `cursor: pointer` on non-clickable areas. |
| **text** (I-beam) | Text inputs and textareas | Browser default; do not override. |
| **grab** / **grabbing** | Draggable UI (reorder, panels) | Use Tailwind `cursor-grab` and `cursor-grabbing` when implementing drag. |
| **wait** | Optional: blocking loading (e.g. full-page) | Prefer inline spinners; use `cursor-wait` on `body` only when the whole UI is blocked. |

### Rules of thumb

1. **Every navigation or click target** (home, back, links, cards that open a page, primary/secondary buttons) → **pointer**.
2. **Every disabled control** → **not-allowed** (no `cursor-default` on disabled buttons).
3. **Non-clickable areas** → **default** (no hand cursor on plain text or empty space).

These rules are reflected in `globals.css` under the “Cursor (Design System)” comment block.
