# DESIGN.md library

Local copies of real DESIGN.md files from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (content fetched via `npx getdesign@latest add <brand>`). Each folder contains one `DESIGN.md` capturing color palette, typography, components, spacing and tone of a reference brand.

## Always-on defaults for CRES-CA

Read these before touching UI. Visual direction is already set by memory (`feedback_design_vision.md`): Instagram-like client, Linear-like dashboard, framer-motion everywhere.

| Context | Primary reference | Secondary |
|---|---|---|
| **Dashboard (master/salon)** | `linear.app/DESIGN.md` | `notion/DESIGN.md` |
| **Mini App / client feed** | `pinterest/DESIGN.md` | `spotify/DESIGN.md` |
| **Marketing / landing** | `stripe/DESIGN.md` | `airbnb/DESIGN.md` |
| **Forms & settings** | `supabase/DESIGN.md` | `linear.app/DESIGN.md` |
| **Command palette / focused UI** | `raycast/DESIGN.md` | `cursor/DESIGN.md` |
| **Chat / AI surfaces** | `claude/DESIGN.md` | — |

## Available brands

- airbnb — warm marketing, generous whitespace
- claude — minimal AI chat, cream palette
- cursor — developer tool dark, vivid accents
- linear.app — precision dark-mode dashboards, indigo accent
- notion — structured content, editorial typography
- pinterest — visual grid, dense thumbnails
- raycast — command palette, micro-interactions
- spotify — media-first dark, bold accent color
- stripe — trust-building marketing, iridescent gradients
- supabase — product-dev hybrid, green accent

## Usage rule

Before designing or restyling any screen, open the matching `DESIGN.md`, pick the palette/type/spacing rules, then apply. Don't mix two systems inside the same screen.

Refresh or add brands with:

```bash
npx -y getdesign@latest add <brand>
mv DESIGN.md .knowledge/design-md/<brand>/DESIGN.md
```
