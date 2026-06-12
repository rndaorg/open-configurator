# VC Pitch Deck — Open Configurator

Build a polished 20-slide `.pptx` deck in the **Midnight Executive** palette (#0F172A navy, #1E2761, #3B82F6 electric, #CADCFC ice) using `pptxgenjs`, saved to `/mnt/documents/open-configurator-pitch-deck.pptx`. Narrative mirrors the existing VC outreach email and `docs/investor-pitch.md`, with AI/agent differentiation pulled forward.

## Slide outline

1. **Cover** — "Open Configurator: The OS for Configurable Commerce" + tagline + contact
2. **The Problem** — 70% of B2B buyers want self-service; <10% of mid-market offers it
3. **Why Now** — AI agents + 3D web + CPQ market shift ($2.8B → $5.7B by 2030)
4. **Market Size** — TAM/SAM/SOM with mid-market wedge ($1.6B underserved)
5. **The Solution** — Configurator + Commerce + AI in one platform
6. **Product Pillars** — 4-card grid: 3D Viz, Rules/Pricing, AI Agents, Commerce
7. **AI Configuration Agent** — NL → compatible config, with example prompt
8. **Multi-Agent Orchestration** — Master → Customer/Pricing/Inventory/Rules diagram
9. **Sales Copilot** — Upsells, quotes, follow-up emails for internal teams
10. **Commerce Backend** — Cart, checkout, Stripe, subscriptions, orders
11. **Operations** — Multi-warehouse inventory, forecasting, reorder automation
12. **Marketing Engine** — SendGrid drips, cart recovery, segmentation
13. **Global & Enterprise-Ready** — 5 languages, 9 currencies, RLS, RBAC, Zod
14. **Live Demo** — Screenshot/mock + URL to open-configurator.lovable.app
15. **Competitive Landscape** — Table vs Tacton/Configit, Shopify apps, custom build
16. **Business Model** — Services + retainers + white-label licensing mix
17. **Go-To-Market** — Verticals, partners, content moat, outbound
18. **Traction & Milestones** — Shipped MVP, 30+ features, 90-day & 12-mo goals
19. **Roadmap** — Next 6 prompts toward "OS" status (multi-tenant, CPQ, OMS, etc.)
20. **The Ask & Team** — Seed round, hires, contact (support@openconfigurator.dev)

## Technical approach

- Use the bundled **pptx skill** (`pptxgenjs`) — install globally, write generator script to `/tmp/gen-deck.js`
- 16:9, US Letter-equivalent widescreen (13.33 × 7.5 in)
- Custom dark master: `#0F172A` background, `#CADCFC` body text, `#3B82F6` accents
- Typography: bold sans for titles (Arial Black / Calibri Bold), Calibri body; title 40–48pt, body 20–24pt
- Visual motifs: thin top accent bar, slide number bottom-right, kicker labels in `#3B82F6`
- Stat slides use large numerals (72–96pt) with small captions
- Diagram slides (#8 orchestration, #6 pillars) built from `addShape` rectangles + connectors — no external images required
- Embed any imagery as base64 if used

## QA cycle (mandatory per pptx skill)

1. Convert to PDF via LibreOffice → render slides at 150dpi with `pdftoppm`
2. View each slide image, check for overflow/overlap/contrast/density
3. Fix issues, re-render, re-verify until clean
4. Deliver `<presentation-artifact path="open-configurator-pitch-deck.pptx" mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation">`

## Out of scope

- No app code changes (this is a downloadable artifact, parallel to the VC email)
- No interactive `/pitch` route
- No edits to existing `docs/investor-pitch.md`
