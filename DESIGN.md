# Design System: Personal AI Sidebar

## 1. Visual Theme & Atmosphere

A **warm, intimate dark-mode** interface reminiscent of a cozy study at midnight. The aesthetic is **minimalist-yet-premium** — sparse layouts with generous breathing room, softened by subtle glow effects and micro-animations that make every interaction feel responsive and crafted. The overall mood is **focused and calm**, designed for deep reading and writing sessions without visual noise.

The color psychology leans **earthy and grounded** — charcoal browns and warm stones offset by a confident violet accent that adds personality without aggression.

## 2. Color Palette & Roles

- **Warm Charcoal Black (#1C1917)** — Main application background. A deep near-black with warm undertones that feels softer than pure black, reducing eye strain during long sessions.

- **Rich Stone Gray (#292524)** — Primary surface color for cards, containers, and UI panels. Creates a subtle layer between background and content without harsh contrast.

- **Warm Gray-Rock (#3C3833)** — Hover state for interactive surfaces. A gentle step up from the base surface, indicating affordance without loud feedback.

- **Darker Warm Stone (#44403C)** — Active/pressed state for surfaces and border color for UI elements. Defines boundaries with a soft, muted line.

- **Royal Violet (#7C3AED)** — Primary action color. Used for the send button, active tab states, brand iconography, and all primary interactive elements. A bold but sophisticated purple that commands attention without feeling playful.

- **Soft Lavender (#A78BFA)** — Primary highlight and accent light. Used for hover glow effects, special text labels (prompt names, result titles), and the typing indicator dots. Brings a gentle luminescence to the dark canvas.

- **Deep Aubergine (#6D28D9)** — Primary dark variant for hover states on violet elements. Adds depth to interactions.

- **Violet Glow (rgba(124, 58, 237, 0.15))** — Translucent glow used behind active tabs and around violet elements. Creates a subtle atmospheric halo without overwhelming.

- **Ivory White (#FAFAF9 / stone-50)** — Primary body text color. A warm white with a hint of cream that reads softly against the dark background.

- **Warm Taupe (#A8A29E / secondary)** — Secondary text and icon color. Muted and understated, perfect for labels, metadata, and non-critical information.

- **Stone Placeholder (#57534E / stone-600)** — Input placeholder text. Visible but unobtrusive.

- **Amber Alert (#FBBF24 / amber-300-400)** — Warning and notification color. Used for missing API key banners and connection warnings. Warm and cautionary without being alarming.

- **Crimson Error (#F87171 / red-400)** — Error states and destructive actions. Reserved for connection failures and delete confirmations.

- **Emerald Success (#34D399 / emerald-400)** — Success feedback for connection tests.

## 3. Typography Rules

- **Primary Typeface:** Plus Jakarta Sans — a modern, geometric sans-serif with generous x-height and refined curves. Conveys clarity and contemporary sophistication.

- **Body Text:** 13.5px at relaxed leading (leading-relaxed). Compact enough for a sidebar, spacious enough for comfortable reading.

- **Header / Brand:** 14px semibold with a subtle gradient text effect (stone-50 → stone-300). The brand name "AI Cá Nhân" uses a gradient-to-transparent clip technique for a polished, modern feel.

- **Section Labels:** 10px bold uppercase with wide letter-spacing (tracking-wider) in stone-400. Creates a clear information hierarchy with minimal visual weight.

- **Semantic Weight Usage:**
  - **Semibold (font-semibold):** Titles, button text, emphasis within paragraphs
  - **Bold (font-bold):** Section headings, uppercase labels, primary action text
  - **Medium (font-medium):** System messages, secondary information
  - **Regular (font-normal / 400):** Body content

- **Letter-spacing Character:** Generally normal; only uppercase labels use tracking-wider for a refined, editorial feel.

## 4. Component Stylings

- **Buttons:**
  - *Primary action (send, test connection):* Subtly rounded corners (rounded-lg), filled with Royal Violet (#7C3AED), white text. On hover, shifts to Deep Aubergine (#6D28D9) with a slight lift from shadow-md and colored shadow (shadow-primary/10). On press, scales down to 95% for tactile feedback.
  - *Add prompt / pill actions:* Pill-shaped (rounded-full), Royal Violet fill, white bold text, floating shadow. Signals a special, standout action.
  - *Ghost icon buttons (header tabs):* Subtly rounded (rounded-lg), transparent background with border-transparent. Active state gains a Violet Glow background with primary/20 border and a subtle pulsing dot indicator. Hover reveals Warm Gray-Rock surface.
  - *Read page toggle:* Ghost button with an animated spinner and pulsing "Đang đọc..." text during loading. Active state uses Violet Glow fill.
  - *Subtle inline actions (save, expand):* Gently rounded (rounded-md), thin stone border on transparent surface. Fully transparent until hover, then surface fills in with a smooth opacity transition.
  - *Destructive (delete):* Gently rounded (rounded-lg), filled Crimson Error (#DC2626 / red-600), white bold text. Hover brightens to signal danger.

- **Cards / Containers:**
  - Generously rounded corners (rounded-2xl) on all card-like containers — settings cards, prompt cards, saved result cards.
  - Filled with Rich Stone Gray (bg-surface, #292524) bordered with a near-invisible Darker Warm Stone line (border-stone-850).
  - Whisper-soft shadow (shadow-sm) for subtle elevation.
  - On hover, the border gently lightens to Darker Warm Stone (border-stone-800) at 300ms transition — a barely perceptible signal of interactivity.
  - Message bubbles use rounded-2xl with a directional cutout (rounded-br-none for user, rounded-bl-none for assistant) creating a chat-bubble language.

- **Inputs / Forms:**
  - Subtly rounded corners (rounded-xl).
  - Filled with Warm Charcoal Black (bg-warm-bg, #1C1917) — the same as the main background — creating a sunken, inset appearance.
  - Bordered with Darker Warm Stone (border-stone-850).
  - Inset shadow (shadow-inner) for physical depth, making the input feel carved into the interface.
  - On focus, the border shifts to Royal Violet at 80% opacity with a matching 1px ring (focus:ring-primary/45), all animated at 300ms.
  - Textarea auto-resizes with a max-height of 120px before scrolling.
  - Select elements use a custom chevron icon instead of the browser default for a consistent look.

- **System Messages / Notification Banners:**
  - Centered, pill-shaped capsules (rounded-full) with a subtle stone border on transparent background. Feels like a whispered system note rather than an alert box.
  - Warning banners use a rounded-xl card with amber border and amber-tinted background, accompanied by a warning icon.
  - Error banners use red-toned equivalents with a dismiss button.

- **Skeleton / Loading States:**
  - Animated shimmer effect using a sweeping gradient overlay over rounded-xl placeholders.
  - Pulsing opacity (animate-pulse) combined with the shimmer for a premium loading feel.

- **Avatars:**
  - Assistant avatar: A pill-shaped icon (rounded-full) with Rich Stone Gray fill and stone border. Contains a robot icon in Soft Lavender that rotates playfully on hover.
  - Brand icon header: Subtly rounded (rounded-lg) with a Royal Violet-to-purple gradient fill and colored shadow.

## 5. Layout Principles

- **Whitespace Strategy:** Generous and intentional. Core spacing unit is 3.5 (14px) for padding and gaps, creating a spacious, breathable layout inside a narrow sidebar (approximately 380–400px). Elements are never crowded; each section has room to breathe.

- **Z-Index & Layering:**
  - The header is pinned to the top with z-50 and uses a blurred backdrop (backdrop-blur-md) with semi-transparent background (bg-warm-bg/85) so content scrolls beneath it.
  - The composer is pinned to the bottom with a gradient-to-transparent overlay (bg-gradient-to-t from-warm-bg via-warm-bg/95 to-transparent) so messages appear to sink behind the input area.
  - Confirm delete overlays use a nearly-opaque warm-bg with backdrop blur (backdrop-blur-sm) at 95% opacity, creating a focused modal moment without a full modal break.

- **Message Alignment:** User messages align right with a directional tail (rounded-br-none), assistant messages align left (rounded-bl-none). All messages max out at 85% width to maintain breathing room and create a conversational asymmetry.

- **Empty State Centering:** When no messages exist, content is vertically and horizontally centered with generous vertical padding (py-14), accompanied by a subtle icon with a hovering violet glow that activates on group hover — inviting interaction.

- **No Grid System:** The layout relies entirely on flexbox with gap utilities. There is no CSS Grid usage, giving the sidebar a linear, scroll-driven flow from top to bottom.

- **Animation Philosophy:** Micro-interactions use cubic-bezier(0.16, 1, 0.3, 1) — a custom ease-out curve that feels snappy and natural, with a brief anticipation and a satisfying deceleration. Elements enter with fade-in-up (0.35s), slide in from the right (0.25s), or pulse gently for attention states.

- **Edge-to-Edge Content:** The sidebar uses minimal horizontal padding (px-3) at the root level, with inner sections adding their own padding (p-3.5) — creating a subtle nested hierarchy without visible card boundaries.
