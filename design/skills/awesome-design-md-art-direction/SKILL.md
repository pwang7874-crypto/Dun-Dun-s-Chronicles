---
name: awesome-design-md-art-direction
description: Derive an original product visual system or prototype from the local VoltAgent Awesome DESIGN.md collection. Use when a user asks to apply that collection, blend several documented design languages, or create a new art direction without copying a source brand.
---

# Awesome DESIGN.md Art Direction

Use the local Awesome DESIGN.md collection as an evidence library, not as a brand-cloning preset.

## Workflow

1. Read the product's PRD, existing design system, target users, required platforms, and explicit visual request before selecting references.
2. Locate the downloaded collection. Prefer the current project's `design/reference/awesome-design-md`; if it is unavailable, ask for its location instead of redownloading without permission.
3. Select only 2–4 relevant `design-md/<source>/DESIGN.md` files. Read every selected file completely.
4. Extract each source's useful rules into five buckets: atmosphere, color roles, typography, geometry, and layout/motion.
5. Separate the synthesis explicitly:
   - Confirmed: directly stated by the selected DESIGN.md file.
   - Adapted: changed to fit the product, platform, audience, accessibility, or existing engineering constraints.
   - Original: newly designed connective language such as collage grammar, torn-paper behavior, or product-specific components.
6. Produce one coherent system. Do not average every source equally; name a dominant source role and supporting roles.
7. When generating a prototype, preserve the product's real information architecture and task states. A visual reference must not override the PRD.
8. Inspect the result for legibility, module distinction, source-brand residue, and accidental contradictions. Iterate once when a major criterion fails.

## Intellectual-property boundary

- Never copy source logos, wordmarks, mascots, proprietary illustrations, signature page composition, marketing copy, or bundled screenshots.
- Treat proprietary fonts as unavailable. Substitute an open-licensed or system font and state the substitution.
- Do not call the result “in the style of” a source brand. Describe the transferable rule instead: deep green surface hierarchy, cinematic photography, organic asymmetry, editorial typography, and so on.
- Keep upstream attribution and license information. The downloaded collection is MIT, but the collection itself notes that analyzed brand identities remain owned by their respective owners.
- Before reusing code or assets, perform a file-level license review. Design-token inspiration alone does not authorize third-party brand assets.

## Product-UI guardrails

- Functional labels and primary actions remain plain, readable, and reachable. Decorative typography and torn edges may frame content but must not distort controls.
- Maintain minimum 44×44 touch targets, visible focus, readable contrast, reduced-motion behavior, and explicit loading/empty/error/recovery states.
- Avoid decorative overload. Choose one primary material metaphor and at most two supporting effects.
- For collage systems, establish a repeatable grammar: one hero photo, one torn-paper boundary, one small archival fragment, and one accent mark. Do not scatter arbitrary stickers.
- For dark systems, reserve the darkest value for the canvas or hero; use a lighter paper surface behind long text and forms.

## Current optional recipe

For a deep rainy-café, wood-and-paper collage direction, read [references/rainy-cafe-collage.md](references/rainy-cafe-collage.md).

## Expected output

Return or create only the artifacts requested by the user, typically:

- a concise source-selection and adaptation note;
- semantic visual tokens and composition rules;
- one representative prototype or prompt;
- a short quality review naming any image-generation text limitations.

Do not begin frontend development when the user asks only for design or a prototype.
