# Contributing a Design System to Cauldron OS

The Design Reference Selector fetches brand DNA from the `awesome-design-md` collection. You can add your own brand's design system by creating a `DESIGN.md` file and including it in the repository under `design-systems/{handle}/`.

---

## File Format

Your DESIGN.md must follow the [awesome-design-md spec](https://github.com/VoltAgent/awesome-design-md). Minimal required sections:

```markdown
---
name: Brand Name
summary: One-line tagline describing the aesthetic
version: 1.0.0
style: [dark|light|adaptive]
---

## Typography

**Primary Font:** [Font name](link-to-font)
- Headings: weight 600–700, scale 1.2–1.5
- Body: weight 400–500, line-height 1.6
- Mono: [font name] for code

## Color Palette

| Role | Hex | RGB |
|------|-----|-----|
| Background | `#0a0a0a` | rgb(10, 10, 10) |
| Surface | `#1a1a1d` | rgb(26, 26, 29) |
| Border | `rgba(255,255,255,0.1)` | — |
| Primary | `#b794f6` | rgb(183, 148, 246) |
| Secondary | `#34d399` | rgb(52, 211, 153) |

## Spacing

- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Container max-width: 1200px
- Sidebar: 280px

## Border & Radius

- Border width: 1px solid with 0.1 opacity on surfaces
- Radius: 2px (standard), 4px (cards), 8px (modals)
- Focus ring: 2px offset with 0.5 opacity primary

## Component States

| Element | Hover | Focus | Active | Disabled |
|---------|-------|-------|--------|----------|
| Button  | border lighten + shadow | ring + offset | scale 0.98 | opacity 0.4 |
| Input   | border accent | ring accent | — | opacity 0.5 |
| Card    | border glow + lift | — | — | desaturate |

## Brand Voice (optional)

Sounds: confident, modern, minimal, precise
Tone: helpful, uncluttered, premium

## Examples (optional)

Include 1–2 code snippets:
```css
.button {
  background: linear-gradient(135deg, #1a1a1d, #2f2f33);
  border: 1px solid rgba(183,148,246,0.3);
  color: #b794f6;
}
```

```

---

## Submission Process

1. **Create your DESIGN.md** in a local branch under `design-systems/{handle}/`
2. **Test locally** by selecting it from the Cauldron UI dropdown (you may need to add your brand to the `DESIGN_SYSTEMS` mapping in `server.js`)
3. **Verify fetch works:** `curl http://localhost:3000/api/design-reference -X POST -H "Content-Type: application/json" -d '{"system":"{handle}"}'`
4. **Submit PR** with:
   - New folder `design-systems/{handle}/DESIGN.md`
   - (Optional) Example `examples/brand-blueprint.md` showing output
   - Updated `server.js` (DESIGN_SYSTEMS entry) and `public/index.html` (option)

We will review for completeness, clarity, and adherence to spec. Once merged, your design system will be available in the Cauldron UI dropdown for all users.

---

## Guidelines

- **Be specific.** Use exact hex codes, font weights, spacing numbers.
- **Show CSS snippets** where helpful, but keep them concise.
- **Provide rationale** briefly (e.g., "dark mode preferred; preserves eye comfort in long sessions").
- **License:** By submitting, you agree to license your DESIGN.md under MIT (compatible with Cauldron OS's license). You retain copyright.
- **No proprietary assets.** Do not include trademarked logos or proprietary brand assets. Only typography + color + spacing rules.
- **Test the fetch** — ensure raw GitHub URL resolves correctly: `https://raw.githubusercontent.com/witch-daddy-labs/cauldron-os/main/design-systems/{handle}/DESIGN.md`

---

## Inspiration

See existing brands for structure:

- `design-systems/cursor/DESIGN.md` (not yet in repo — be the first!)
- `design-systems/vercel/DESIGN.md`
- `design-systems/lovable/DESIGN.md`
- `design-systems/raycast/DESIGN.md`

*(These are placeholders; populate them with actual brand guidelines when you submit.)*

---

## Questions?

Open an issue at https://github.com/witch-daddy-labs/cauldron-os/issues with tag `design-system`.
