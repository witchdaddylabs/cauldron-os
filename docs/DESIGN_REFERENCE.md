# Design System Catalog

The Design Reference Selector reads local `DESIGN.md` files from `design-systems/{handle}/`. Cauldron ships with an imported Open Design catalog indexed by `design-systems/catalog.json`, plus Refero style search for live inspiration.

---

## File Format

Your DESIGN.md should follow the portable `DESIGN.md` pattern used by Open Design and awesome-design-md. Minimal recommended sections:

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
2. **Add an entry** to `design-systems/catalog.json` with `id`, `name`, `path`, and `source`
3. **Validate locally:** `node scripts/validate-design-systems.js`
4. **Test locally** by selecting it from the Cauldron UI dropdown
5. **Verify fetch works:** `curl http://localhost:3000/api/design-reference -X POST -H "Content-Type: application/json" -d '{"system":"{handle}"}'`
6. **Submit PR** with:
   - New folder `design-systems/{handle}/DESIGN.md`
   - Updated `design-systems/catalog.json`
   - Updated tests if the route contract changes

We will review for completeness, clarity, and adherence to spec. Once merged, your design system will be available in the Cauldron UI dropdown for all users.

---

## Guidelines

- **Be specific.** Use exact hex codes, font weights, spacing numbers.
- **Show CSS snippets** where helpful, but keep them concise.
- **Provide rationale** briefly (e.g., "dark mode preferred; preserves eye comfort in long sessions").
- **License:** By submitting, you agree to license your DESIGN.md under MIT (compatible with Cauldron OS's license). You retain copyright.
- **No proprietary assets.** Do not include trademarked logos or proprietary brand assets. Only typography + color + spacing rules.
- Test the fetch with `/api/design-reference`; local catalog entries are read from the checked-out repo, not from a remote raw URL.

---

## Inspiration

See existing brands for structure:

- `design-systems/cursor/DESIGN.md`
- `design-systems/vercel/DESIGN.md`
- `design-systems/lovable/DESIGN.md`
- `design-systems/raycast/DESIGN.md`

*(These are placeholders; populate them with actual brand guidelines when you submit.)*

---

## Questions?

Open an issue at https://github.com/witchdaddylabs/cauldron-os/issues with tag `design-system`.
