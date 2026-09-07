---
name: "no-hardcoded-styling"
description: 'Keep all XMS Web styling in Tailwind utilities or the token CSS, never hardcoded in a component. Use when writing or reviewing any .tsx in frontend, when you are about to reach for a style={{ }} prop, an arbitrary Tailwind value (bg-[#...], w-[137px], shadow-[...]), a raw hex, rgb() or px number, styled-components or <style jsx>, or !important inside a component. Also use when the task says "style this", "make it look right", "match the POC", "fix the spacing", or when reviewing a diff for styling drift. Pairs with xms-web-design-system, which covers which token to pick; this skill covers where the style is allowed to live.'
---

# Skill: No Hardcoded Styling

XMS Web styles through two surfaces only: **Tailwind utilities bound to tokens**, and **the CSS in `frontend/styles/tokens/`**. A component says which class applies, never what a color, size, or shadow is. This is what makes dark mode flip, per-account branding work, and the density rules hold in one place instead of hundreds.

Companion skill: `xms-web-design-system` answers "which token is the right one". This skill answers "where is that style allowed to live". When both apply, follow the design system for the value and this skill for the placement.

## Where styling lives

Per `01-architecture/DESIGN-SYSTEM.md` §2, the token package is seeded once into `frontend/styles/tokens/` and then owned by XMS:

| File                                             | Holds                                                                                                                                                  | Editable                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `frontend/styles/tokens/aiinnovation-tokens.css` | Vendored `--aiinds-*` primitives                                                                                                                       | NEVER, a resync clobbers it             |
| `frontend/styles/tokens/house.css`               | House aliases, `--state-*` signal trios, dark flips                                                                                                    | Rarely, house-wide changes only         |
| `frontend/styles/tokens/xms-scope.css`           | `.xms-scope`, the `--xms-*` identity tokens, `.xms-card-shell`, `.xms-section`, `.xms-eyebrow`, `.xms-banner`, `.xms-pill`, the control geometry block | Yes, this is where new XMS styling goes |
| `frontend/styles/tokens/tailwind-preset.js`      | The `xms.*` and `aiinds.*` Tailwind namespaces                                                                                                         | Yes, when a token needs a utility       |

The whole product renders inside `.xms-scope`, so every `--xms-*` token is in scope in every component.

## The ladder (take the first rung that works)

1. **A Tailwind utility bound to a token.** `bg-xms-card`, `text-xms-ink`, `border-xms-line`, `bg-xms-tint`. This is the default and covers most work.
2. **An existing composition class.** `.xms-card-shell`, `.xms-section`, `.xms-eyebrow`, `.xms-banner`, `.xms-pill`. Reach for these before rebuilding a card or a pill out of utilities.
3. **A new class in `xms-scope.css`**, built from `var(--xms-*)`. Do this when a recipe repeats or when Tailwind cannot express it (pseudo-elements, complex selectors, sticky table headers, print rules).
4. **A new token plus its Tailwind namespace entry**, when a genuinely new semantic value is needed. New token first, then use it. Never skip to a literal.

There is no fifth rung. If you are about to hardcode, you have missed a rung.

## Banned inside a component

| Pattern                                                                      | Fix                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style={{ color: '#0c1626' }}`, `style={{ padding: 12 }}`                    | `className="text-xms-ink p-3"`                                                                                                                                                               |
| `bg-[#2e5bff]`, `text-[#0c1626]`, `border-[#dce3ec]`                         | `bg-xms-accent`, `text-xms-ink`, `border-xms-line`                                                                                                                                           |
| `text-gray-500`, `text-slate-400`, `bg-gray-50`                              | `.xms-scope` has a no gray text policy (§3.1): use `text-xms-ink`, or the muted token for de-emphasis only                                                                                   |
| `w-[137px]`, `h-[34px]`, `text-[13.5px]`, `gap-[7px]`                        | Use the scale. Density is fixed in §6: 13.5 to 14px body, 28px page titles, 34px controls, 32px buttons, 4px radii. If your number is not in the scale, question the number before adding it |
| `shadow-[0_1px_2px_rgba(17,17,17,0.04)]`                                     | A shadow token or `.xms-card-shell`                                                                                                                                                          |
| `rgb(...)`, `rgba(...)`, `hsl(...)` literals in TSX                          | The token                                                                                                                                                                                    |
| `!important` in a component `className` or style prop                        | Fix the specificity in `xms-scope.css`                                                                                                                                                       |
| `styled-components`, `<style jsx>`, emotion, a component-local `<style>` tag | Tailwind, or a class in `xms-scope.css`                                                                                                                                                      |
| A second copy of a color in a `const STATE_COLORS = { ... }` map             | The `--state-*` trios (§3.2), which are never re-themed                                                                                                                                      |

## The sanctioned exceptions (do not "fix" these)

Four cases are deliberate. Recognise them so you neither introduce them loosely nor refactor them away.

1. **Raw hex where `var()` breaks Tailwind opacity modifiers.** A known gotcha recorded in §2 and in the token package README. It is confined to the token files and the Tailwind preset. It is never a licence to hardcode in a component.
2. **The `!important` control geometry block** in `xms-scope.css` (34px controls and the rest of the density block). It lives in that one block, carried over from the POC. Do not spread `!important` outward into components.
3. **Runtime values that cannot be enumerated at build time**: the per-account branding accent (§3.3), an SLA burn-down bar width, a virtualised row offset. Set a CSS custom property inline and let CSS consume it, so the _rule_ still lives in CSS:

```tsx
// correct: the component supplies a number, the stylesheet owns the styling
<div className="xms-burndown" style={{ ["--xms-burn-pct" as string]: `${pct}%` }} />
```

```css
/* xms-scope.css */
.xms-burndown::after {
  width: var(--xms-burn-pct);
  background: var(--xms-accent);
}
```

Never smuggle a color or a fixed size through this hatch. Only genuinely computed values.

4. **`aiinnovation-tokens.css` is vendored** and never edited, even to fix something that looks wrong. Override in `house.css` or `xms-scope.css` instead.

## Steps

1. Before styling, check whether an existing composition class or `components/ui/*` primitive already does it. Reuse beats restyle.
2. Pick the token via `xms-web-design-system`. If no token fits, add one to `xms-scope.css` and expose it in `tailwind-preset.js` before using it.
3. Write the markup with token-bound utilities. If the recipe repeats more than twice or Tailwind cannot express it, promote it to a class in `xms-scope.css`.
4. For a computed value, pass a CSS custom property, never a literal style.
5. Audit your own diff before finishing:

```bash
# from frontend/
grep -rnE "style=\{\{|bg-\[#|text-\[#|border-\[#|shadow-\[|w-\[[0-9]|h-\[[0-9]|text-\[[0-9]" app components
grep -rnE "text-gray-|text-slate-|bg-gray-|rgba?\(|!important" app components
```

Every hit must be one of the four sanctioned exceptions or be rewritten.

6. Toggle `.dark` on `<html>` and confirm the new surfaces, text and borders invert. A hardcoded value is usually invisible until dark mode, which is exactly why this rule exists.

## Checkpoints

- Does the diff contain zero `style={{ }}` props that are not a computed CSS custom property?
- Zero arbitrary Tailwind values for color, size, or shadow?
- Zero `text-gray-*` or `text-slate-*`, per the no gray text policy?
- Did every new number come from the density scale in §6 rather than from eyeballing?
- If you added a repeated recipe, did it become a class in `xms-scope.css` instead of being copied?
- Did you leave `aiinnovation-tokens.css` untouched?
- Does the view read correctly with `.dark` on?
