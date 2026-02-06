# CLAUDE-design.md - GetSafe360 Design System

> Referenced from [CLAUDE.md](./CLAUDE.md). This file covers the full design token system, visual specifications, and component patterns.

---

## Design Principles

1. **Accessibility-first** - WCAG AA minimum, keyboard navigation, ARIA labels.
2. **Motion with purpose** - Smooth, subtle transitions; always respect `prefers-reduced-motion`.
3. **Gradient as intelligence** - Gradients signal "AI sophistication" or key CTAs -- not generic decoration.
4. **Dark-mode native first** - Dark is first-class; light mode is a clean, high-contrast counterpart.
5. **Modern, confident surfaces** - Rectangular cards, crisp borders, subtle depth -- no pills unless explicitly needed (badges, avatars).

---

## Design Tokens (Single Source of Truth)

All tokens live in **`saas-ux/app/tokens.css`**. No hardcoded colors in components.

### Token Layers

| Layer | Example | Purpose |
|-------|---------|---------|
| **Primitive** | `--color-primary-500`, `--color-neutral-200` | Raw color palette |
| **Semantic** | `--background-default`, `--text-primary`, `--border-default` | Role-based mapping |
| **Component** | `--feature-card-bg`, `--button-primary-bg` | Component-specific overrides (in `styles/components.css`) |

### Primitive Tokens

```css
/* Brand Colors (Azure family) */
--color-primary-100: #e0f2ff;
--color-primary-200: #b9e3ff;
--color-primary-300: #8cd2ff;
--color-primary-400: #4fbaff;
--color-primary-500: #127fc3;   /* BRAND */
--color-primary-600: #0f6aa3;
--color-primary-700: #0c5684;
--color-primary-800: #094266;
--color-primary-900: #062f49;

/* Neutral Scale */
--color-neutral-100: #f9fafb;
--color-neutral-200: #f3f4f6;
--color-neutral-300: #e5e7eb;
--color-neutral-400: #d1d5db;
--color-neutral-500: #9ca3af;
--color-neutral-600: #6b7280;
--color-neutral-700: #4b5563;
--color-neutral-800: #374151;
--color-neutral-900: #1f2937;

/* Feedback */
--color-success: #10b981;
--color-warning: #f59e0b;
--color-danger:  #ef4444;
```

### Semantic Tokens

```css
/* Backgrounds */
--background-default: var(--color-neutral-100);
--background-primary: var(--color-primary-500);

/* Text */
--text-default:  var(--color-neutral-900);
--text-subtle:   var(--color-neutral-600);
--text-inverted: #ffffff;
--text-primary:  var(--color-primary-600);

/* Borders */
--border-default: var(--color-neutral-300);
--border-primary: var(--color-primary-500);

/* Icons */
--icon-default: var(--text-default);
--icon-primary: var(--text-primary);
```

### Dark Mode Overrides

```css
.dark {
  --background-default: #111827;
  --text-default: #f9fafb;
  --border-default: #374151;
  --color-primary-500: #4fbaff;   /* brighter Azure for dark */
}
```

### Spacing, Radii, Shadows, Typography

```css
/* Spacing */
--space-xs: 4px;   --space-sm: 8px;
--space-md: 16px;  --space-lg: 24px;  --space-xl: 32px;

/* Border Radius (modern, non-pill) */
--radius-sm: 6px;   --radius-md: 8px;
--radius-lg: 12px;  --radius-xl: 16px;

/* Shadows (subtle, modern depth) */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.08);

/* Typography (mobile-first) */
--text-sm: 14px;  --text-md: 16px;
--text-lg: 18px;  --text-xl: 22px;
```

### Tailwind Integration

Tokens are mapped in `saas-ux/tailwind.config.js` so Tailwind utilities reference CSS variables:

```js
colors: {
  primary: "var(--color-primary-500)",
  "primary-600": "var(--color-primary-600)",
  neutral: { 100: "var(--color-neutral-100)", /* ... */ },
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger:  "var(--color-danger)",
},
borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", /* ... */ },
boxShadow:    { sm: "var(--shadow-sm)", md: "var(--shadow-md)" },
spacing:      { xs: "var(--space-xs)", sm: "var(--space-sm)", /* ... */ },
```

### Usage Rules

- **No hardcoded colors** in components -- always use `var(--...)` or the Tailwind token utilities.
- Icons inherit text color unless explicitly overridden.
- No heavy glows or box-shadows -- only subtle, modern elevation via `--shadow-sm` / `--shadow-md`.
- Prefer utility classes that map to tokens, or custom classes that reference `var(--...)`.

---

## Color System

### Pillar Colors (Four Quadrants)

Use semantic, token-aligned variants -- not raw Tailwind color names:

| Pillar | Light BG | Dark BG | Border reference |
|--------|----------|---------|------------------|
| **SEO** (Green) | `rgba(16,185,129,0.06)` | `rgba(16,185,129,0.12)` | `--color-success` |
| **Performance** (Blue) | soft blue tint | blue overlay | `--color-primary-500` |
| **Security** (Red/Orange) | soft orange/red tint | orange/red overlay | `--color-danger` |
| **Accessibility** (Purple) | soft purple tint | purple overlay | neutral + purple icon |

---

## Typography

### Font Stack

```css
font-family: Geist, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, Helvetica, sans-serif;
```

### Scale

| Size | Class | Usage |
|------|-------|-------|
| 3xl | `text-3xl` | Page headings (Dashboard, Hero) |
| 2xl | `text-2xl` | Section titles |
| xl | `text-xl` | Card titles |
| lg | `text-lg` | Buttons, prominent text |
| base | `text-base` | Body text |
| sm | `text-sm` | Metadata, captions |
| xs | `text-xs` | Badges, fine print |

### Weights

- Headings, buttons: `font-semibold`
- Subheadings, labels: `font-medium`
- Body text: `font-normal`

---

## Spacing & Layout

### Containers

```tsx
// Page container
className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"

// Card/form max-width
className="max-w-2xl mx-auto"
```

### Spacing Scale

- Tight: `p-2` (8px)
- Card padding: `p-4` (16px)
- Section padding: `p-6` (24px)
- Page padding: `p-8` (32px)

### Border Radius

Cards: `var(--radius-md)` (6-8px, Clerk-style).
Buttons: `var(--radius-sm)` or `var(--radius-md)` (no pill by default).
Modals / large surfaces: `var(--radius-lg)`.
Pills / avatars: only when explicitly needed, `border-radius: 9999px`.

---

## Shadows & Effects

- Cards: `box-shadow: var(--shadow-sm);`
- Primary CTAs / key surfaces: `box-shadow: var(--shadow-md);`
- **Avoid:** Heavy glows, outdated fuzzy shadows, overly dramatic elevation.
- Glow utilities (if kept) should be extremely subtle, reserved for rare hero moments.

---

## Card Aesthetic (Clerk-Inspired)

The signature look: minimalist, high-contrast, modern SaaS surfaces.

### Card Surface

| Property | Light Mode | Dark Mode |
|----------|-----------|-----------|
| Background | `var(--background-default)` / `#F9FAFB` | `#111827` |
| Border | `1px solid var(--border-default)` | `1px solid #374151` |
| Radius | `var(--radius-md)` (6-8px) | same |
| Shadow | `var(--shadow-sm)` | same |
| Padding | `var(--space-lg)` (24px) | same |

Surfaces feel **solid and intentional**, not soft or pill-shaped. Flat planes with subtle depth, not neumorphism.

### Card Attributes

| Attribute | Description |
|-----------|-------------|
| Professional | Clean, enterprise-grade, no fluff |
| Modern | Subtle gradients, crisp borders, minimal shadows |
| Confident | Strong typography, clear hierarchy |
| Not pill-shaped | Rectangular, 6-8px radius |
| Premium | Micro-interactions, glossy overlay, subtle depth |

### Internal Layout

- Vertical stack: Icon -> Title -> Description -> Optional CTA
- Spacing: Icon->title `var(--space-sm)`, title->desc `var(--space-xs)`-`var(--space-sm)`, desc->CTA `var(--space-md)`
- Title: `text-xl font-semibold` color `var(--text-default)`
- Description: `text-sm` or `text-base` color `var(--text-subtle)`
- Icon: 28-32px, color `var(--text-primary)` or pillar color, top-left aligned with title

### Hover Behavior

- Card border brightens slightly, shadow transitions to `var(--shadow-md)`
- Button lifts 1-2px
- Icons shift 1px right

---

## Button Style (Clerk-Inspired, Non-Pill)

### Primary Button

```css
.btn-primary {
  position: relative;
  background-color: var(--color-primary-500);
  color: var(--text-inverted);
  border-radius: var(--radius-sm);    /* 6px -- rectangular */
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(255,255,255,0.08);
  height: 40-44px;
  font-weight: 600;
}

/* Signature glossy overlay */
.btn-primary::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0.10) 46%,
    rgba(255,255,255,0.00) 54%
  );
  pointer-events: none;
  opacity: 0.9;
}
```

### States

- **Hover:** Slight brightness increase, border more visible, shadow slightly stronger.
- **Active:** Reduced shadow ("pressed" feel), slight darkening.
- **Focus:** Crisp 1-2px outline using `--border-primary`.

### Secondary Button

- Transparent or neutral background
- `border: 1px solid var(--border-default)`
- Text: `--text-default` or `--text-primary`
- Same radius and height as primary

---

## Component Tokens (styles/components.css)

Component tokens sit between semantic tokens and component styles:

```css
/* Feature Card */
--feature-card-bg: var(--background-default);
--feature-card-bg-dark: #111827;
--feature-card-border: var(--border-default);
--feature-card-radius: var(--radius-md);
--feature-card-padding: var(--space-lg);
--feature-card-shadow: var(--shadow-sm);

/* Buttons */
--button-primary-bg: var(--color-primary-500);
--button-primary-text: var(--text-inverted);
--button-primary-border: rgba(255,255,255,0.08);
--button-primary-radius: var(--radius-sm);
--button-primary-shadow: var(--shadow-md);
--button-height: 44px;
--button-padding-x: 16px;
--button-font-size: var(--text-md);
```

---

## Feature Card Component

### React Usage

```tsx
<FeatureCard
  title="Performance"
  description="Optimize your site speed and Core Web Vitals."
  icon={Speedometer}
/>
```

### CSS Classes (from components.css)

```css
.feature-card       /* container: bg, border, radius, padding, shadow, flex column, gap */
.feature-card:hover /* border-color: --border-primary, shadow: --shadow-md */
.feature-card-icon  /* color: --feature-card-icon-color */
.feature-card-title /* text-xl, font-semibold, --text-default */
.feature-card-desc  /* text-md, --text-subtle, line-height 1.5 */
```

---

## Iconography

- **Primary:** Phosphor Icons (default), Lucide as fallback
- **Style:** Regular weight, 24-32px, inherit text color
- **Category Icons:**
  - Performance: `<Speedometer size={32} />`
  - SEO: `<ListMagnifyingGlass size={32} />`
  - Accessibility: `<PersonArmsSpread size={32} />`
  - Security: `<ShieldCheck size={32} />`
- **Guidelines:** Purposeful (support meaning, not decoration), simple, consistent padding/alignment/stroke

---

## CTA Effects (globals.css)

Animated glow effects for hero CTAs and AI-specific sections. **Not** for every button.

### Color Themes

| Class | Use Case |
|-------|----------|
| `.cta-sky` | InfoBoxes, default CTAs |
| `.cta-violet` | Dev-heavy pages |
| `.cta-teal` | Neutral accent |
| `.cta-amber` | Drizzle-style warmth |

### Usage

```tsx
<div className="cta-effect cta-sky">
  {/* content */}
</div>
```

- Respects `prefers-reduced-motion`
- Hover/focus boosts glow brightness and pulse speed
- See `globals.css` for full keyframes (`glassPulse`, `ttPulse`, `bg-move`)

---

## Animations

- `.animate-scan` - scan bar effect (3s linear infinite)
- `.button-shine` - CTA shine gradient sweep
- `.cta-effect::before` - `glassPulse` keyframe (7s ease-in-out)
- `.to-top::before` - `ttPulse` for scroll-to-top rocket

**Rules:** Apply sparingly to hero CTAs or AI sections. Always provide `prefers-reduced-motion` fallbacks.

---

## File Map

```
saas-ux/
├── app/tokens.css          # Primitive + semantic design tokens
├── app/globals.css          # Base styles, CTA effects, theme vars
├── styles/components.css    # Component-level tokens + component styles
└── tailwind.config.js       # Maps tokens to Tailwind utilities
```
