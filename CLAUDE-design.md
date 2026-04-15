# CLAUDE-design.md - GetSafe360 Design System

> Referenced from [CLAUDE.md](./CLAUDE.md). This file covers the full design token system, visual specifications, and component patterns.

---

## Design Principles

1. **Accessibility-first** - WCAG AA minimum, keyboard navigation, ARIA labels.
2. **Motion with purpose** - Smooth, subtle transitions; always respect `prefers-reduced-motion`.
3. **Gradient as intelligence** - Gradients signal "AI sophistication" or key CTAs -- not generic decoration.
4. **Dark-mode native first** - Dark is the default; light mode is a clean, high-contrast counterpart. New users see dark unless they explicitly choose otherwise (localStorage `theme` key).
5. **Modern, confident surfaces** - Rectangular cards, crisp borders, subtle depth -- no pills unless explicitly needed (badges, avatars).

---

## Theme Architecture

### How Dark Mode Works

1. **Init script** (in `app/layout.tsx` `<head>`) runs synchronously before paint — reads `localStorage.theme` and adds `.dark` or `.light` to `<html>`. Default is `.dark` if no preference is stored.
2. **BgColorSelector** (`components/ui/bg-color-selector.tsx`) stores choice in `localStorage.theme` as `"dark" | "light" | "system"` and updates the `<html>` class in real time.
3. **Tailwind** is configured with `darkMode: "class"` so `dark:` utility variants activate when `.dark` is on `<html>`.
4. **CSS variables** in `tokens.css` declare `:root` (light) and `.dark` overrides — the neutral scale inverts so that `--color-neutral-50` is near-white in light and near-black in dark, making single-variable references automatically theme-aware.

### Token Layers

| Layer | File | Example |
|-------|------|---------|
| **Primitive** | `app/tokens.css` | `--color-primary-500`, `--color-neutral-200` |
| **Semantic** | `app/tokens.css` | `--background-default`, `--text-primary`, `--border-default`, `--header-bg`, `--footer-bg` |
| **Component** | `styles/components.css` | `--card-bg`, `--btn-primary-bg`, `--cockpit-sidebar-bg` |

### Usage Rules

- **No hardcoded colors** in components — always use `var(--...)` or Tailwind utilities mapped to tokens.
- Never use raw Tailwind `gray-*` / `slate-*` / `stone-*` for structural backgrounds. These are constants and don't adapt to the theme.
- Only exception: "always-dark" terminal/code surfaces (e.g. `DirectAgentStreamCard`) may use Tailwind's constant `gray-900`/`gray-950` in light mode paired with `dark:bg-[#...]` for dark mode, keeping the terminal aesthetic in both themes.
- Prefer CSS variable utilities: `bg-[var(--background-default)]`, `text-[var(--text-default)]`, `border-[var(--border-default)]`.

---

## Design Tokens (Single Source of Truth)

All tokens live in **`saas-ux/app/tokens.css`**. Component tokens in **`saas-ux/styles/components.css`**.

### Primitive Tokens — Light Mode (`:root`)

```css
/* Brand Colors (Azure family — OKLCH) */
--color-primary-100: oklch(96.63% 0.05 236.63);
--color-primary-200: oklch(92.41% 0.08 236.39);
--color-primary-300: oklch(87.39% 0.12 236.09);
--color-primary-400: oklch(79.79% 0.16 235.77);
--color-primary-500: oklch(63.39% 0.14 235.39);  /* BRAND */
--color-primary-600: oklch(55.09% 0.13 235.31);
--color-primary-700: oklch(47.36% 0.12 235.12);
--color-primary-800: oklch(39.47% 0.10 234.94);
--color-primary-900: oklch(31.79% 0.08 234.73);

/* Neutral Scale (inverts in dark mode — see below) */
--color-neutral-50:  oklch(99%  0 0);   /* near-white */
--color-neutral-100: oklch(97%  0 0);   /* page background */
--color-neutral-200: oklch(92%  0 0);   /* subtle surface */
--color-neutral-300: oklch(87%  0 0);   /* borders, dividers */
--color-neutral-400: oklch(72%  0 0);   /* muted borders */
--color-neutral-500: oklch(56%  0 0);   /* subtle text */
--color-neutral-600: oklch(44%  0 0);
--color-neutral-700: oklch(37%  0 0);
--color-neutral-800: oklch(27%  0 0);
--color-neutral-900: oklch(21%  0 0);   /* near-black text */
--color-neutral-950: oklch(14%  0 0);   /* darkest */

/* Feedback */
--color-success: oklch(0.75 0.17 163.28);
--color-warning: oklch(0.78 0.17 83.66);
--color-danger:  oklch(0.63 0.24 29.23);
```

### Primitive Tokens — Dark Mode (`.dark`)

The neutral scale is **fully inverted** in dark mode: `neutral-50` becomes near-black, `neutral-900` becomes near-white. Using a single neutral variable automatically adapts to the active theme.

```css
.dark {
  --color-primary-500: oklch(48% 0.11 235);   /* brighter Azure for dark bg */
  --color-primary-600: oklch(56% 0.12 235);
  --color-primary-700: oklch(64% 0.13 235);
  --color-primary-800: oklch(72% 0.14 235);
  --color-primary-900: oklch(80% 0.15 235);

  --color-neutral-50:  oklch(14% 0 0);   /* near-black (footer, darkest surface) */
  --color-neutral-100: oklch(20% 0 0);   /* dark page background */
  --color-neutral-200: oklch(27% 0 0);   /* dark card surface */
  --color-neutral-300: oklch(37% 0 0);   /* dark border */
  --color-neutral-400: oklch(44% 0 0);
  --color-neutral-500: oklch(56% 0 0);
  --color-neutral-600: oklch(72% 0 0);   /* subtle text in dark */
  --color-neutral-700: oklch(87% 0 0);
  --color-neutral-800: oklch(92% 0 0);
  --color-neutral-900: oklch(97% 0 0);   /* near-white text */
  --color-neutral-950: oklch(99% 0 0);
}
```

### Semantic Tokens

```css
/* Backgrounds */
--background-default: var(--color-neutral-100);  /* page bg — adapts automatically */
--background-primary: var(--color-primary-500);
--header-bg: oklch(from var(--color-neutral-50) l c h / 0.8);  /* translucent, adapts */
--footer-bg: var(--color-neutral-200);            /* light: subtle gray / dark: dark surface */

/* Text */
--text-default:  var(--color-neutral-900);   /* main body text */
--text-subtle:   var(--color-neutral-500);   /* secondary/muted text */
--text-inverted: var(--color-neutral-100);   /* text on primary bg */
--text-primary:  var(--color-primary-600);   /* brand link/accent text */
--text-warning:  var(--color-warning);

/* Borders */
--border-default: var(--color-neutral-300);
--border-primary: var(--color-primary-500);
--border-warning: var(--color-warning);
```

Dark mode overrides (in `.dark`):
```css
.dark {
  --background-default: var(--color-neutral-100);  /* resolves to oklch(20%) in dark */
  --border-default:     var(--color-neutral-300);  /* resolves to oklch(37%) in dark */
  --text-default:       var(--color-neutral-950);  /* resolves to oklch(99%) in dark */
  --text-subtle:        var(--color-neutral-600);  /* resolves to oklch(72%) in dark */
  --header-bg: oklch(from var(--color-neutral-50) l c h / 0.6);
  --footer-bg: var(--color-neutral-50);            /* near-black footer in dark */
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

Tokens are mapped in `saas-ux/tailwind.config.js`:

```js
darkMode: "class",
colors: {
  primary:      "var(--color-primary-500)",
  "primary-100": "var(--color-primary-100)",
  // ...through primary-900
  neutral: {
    100: "var(--color-neutral-100)",
    // ...through neutral-900
  },
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger:  "var(--color-danger)",
},
borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", /* ... */ },
boxShadow:    { sm: "var(--shadow-sm)", md: "var(--shadow-md)" },
spacing:      { xs: "var(--space-xs)", sm: "var(--space-sm)", /* ... */ },
```

---

## Category Pillar Colors

Category colors are defined in **`tokens.css`** under `--category-*`. They have light and dark variants used for borders, glows, and icon tints. The base color is used for icon strokes and accent lines.

| Category | Token | Light value | Dark value | Usage |
|----------|-------|-------------|------------|-------|
| **Performance** | `--category-performance` | `#facc15` (yellow-400) | `#facc15` (same) | Score bars, borders |
| — light variant | `--category-performance-light` | `#fde047` | `#fde047` | Hover tints |
| — dark variant | `--category-performance-dark` | `#eab308` | `#eab308` | Active borders |
| **Security** | `--category-security` | `#3b82f6` (blue-500) | `#3b82f6` | |
| **SEO / GEO** | `--category-seo` | `#a855f7` (purple-500) | `#a855f7` | |
| **Accessibility** | `--category-accessibility` | `#14b8a6` (teal-500) | `#14b8a6` | |
| **Content** | `--category-content` | `#ff6f5e` (coral) | `#ff6f5e` | |
| **WordPress** | `--category-wordpress` | `#21759b` | `#48a9d0` (lighter for dark bg) | |
| **WordPress gradient** | `--category-wordpress-gradient-start/end` | `#4f46e5` → `#ec4899` | `#818cf8` → `#f472b6` | |
| **Tech** | `--category-tech` | `#f97316` (orange-500) | `#fb923c` (lighter) | |
| **Geo** | `--category-geo` | `#9333ea` (purple-600) | `#c084fc` (lighter) | |

### Icon Background Tint Pattern

For category icon containers, always use `oklch(from var(--category-X) l c h / 0.12–0.15)` as the background. This gives a subtle, theme-aware tint that works in both light and dark modes:

```tsx
// In JSX (inline style)
style={{ background: "oklch(from var(--category-performance) l c h / 0.12)" }}

// OR via the CATEGORY_LINKS pattern in SiteSelectorDropdown
iconBg: "oklch(from var(--category-seo) l c h / 0.15)"
```

### New Component Guidelines

When building a new component that uses category colors:

```tsx
// ✅ Correct — uses CSS variable, adapts to light/dark
style={{ color: "var(--category-security)", borderColor: "var(--category-security)" }}

// ✅ Correct — background tint via oklch relative color
style={{ background: "oklch(from var(--category-seo) l c h / 0.12)" }}

// ❌ Wrong — hardcoded hex
style={{ color: "#3b82f6" }}

// ❌ Wrong — Tailwind constant that ignores theme
className="text-blue-500"
```

---

## Color System — New Component Checklist

When adding **any** new page or component, apply these defaults so it automatically inherits the theme:

| Element | Class / Style to use |
|---------|---------------------|
| Page background | `bg-[var(--background-default)]` — or just omit (body handles it via globals.css) |
| Card / panel bg | `bg-[var(--card-bg)]` |
| Main text | `text-[var(--text-default)]` |
| Secondary / muted text | `text-[var(--text-subtle)]` |
| Links / brand accent | `text-[var(--text-primary)]` |
| Default border | `border-[var(--border-default)]` |
| Primary / focus border | `border-[var(--border-primary)]` |
| Header bg | `bg-[var(--header-bg)]` + `backdrop-blur` |
| Footer bg | `bg-[var(--footer-bg)]` |
| Subtle surface (hover bg) | `bg-[var(--color-neutral-200)]` |
| Smooth transitions | `transition-colors duration-300` on any element whose bg/border/text changes |

**Never** add `dark:` prefix variants for bg/text if you can use a single token variable — the token already handles dark mode.

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

Cards: `var(--radius-md)` (6–8px, Clerk-style).
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
| Background | `var(--card-bg)` → `var(--color-neutral-100)` ≈ `#F9FAFB` | `var(--card-bg)` → `var(--color-neutral-200)` ≈ `#333` |
| Border | `1px solid var(--border-default)` | same token → adapts |
| Radius | `var(--radius-md)` (6–8px) | same |
| Shadow | `var(--shadow-sm)` | same |
| Padding | `var(--space-lg)` (24px) | same |

### Card Attributes

| Attribute | Description |
|-----------|-------------|
| Professional | Clean, enterprise-grade, no fluff |
| Modern | Subtle gradients, crisp borders, minimal shadows |
| Confident | Strong typography, clear hierarchy |
| Not pill-shaped | Rectangular, 6–8px radius |
| Premium | Micro-interactions, glossy overlay, subtle depth |

### Internal Layout

- Vertical stack: Icon → Title → Description → Optional CTA
- Spacing: Icon→title `var(--space-sm)`, title→desc `var(--space-xs)`–`var(--space-sm)`, desc→CTA `var(--space-md)`
- Title: `text-xl font-semibold` color `var(--text-default)`
- Description: `text-sm` or `text-base` color `var(--text-subtle)`
- Icon: 28–32px, color `var(--text-primary)` or pillar color, top-left aligned with title

### Hover Behavior

- Card border brightens slightly, shadow transitions to `var(--shadow-md)`
- Button lifts 1–2px
- Icons shift 1px right

---

## Button Style (Clerk-Inspired, Non-Pill)

### Primary Button

```css
.btn-primary {
  position: relative;
  background-color: var(--color-primary-500);
  color: var(--text-inverted);
  border-radius: var(--radius-sm);    /* 6px — rectangular */
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(255,255,255,0.08);
  height: 40–44px;
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
- **Focus:** Crisp 1–2px outline using `--border-primary`.

### Secondary Button

- Transparent or neutral background: `bg-[var(--color-neutral-200)]`
- `border: 1px solid var(--border-default)`
- Text: `var(--text-default)` or `var(--text-primary)`
- Same radius and height as primary

---

## Component Tokens (styles/components.css)

```css
/* Cards */
--card-bg:     var(--background-default);   /* light: near-white; dark: dark gray (overridden) */
.dark { --card-bg: var(--color-neutral-200); }

/* Feature Card */
--feature-card-bg:      var(--background-default);
--feature-card-bg-dark: #111827;            /* explicit override for .dark .feature-card */
--feature-card-border:  var(--border-default);
--feature-card-radius:  var(--radius-md);
--feature-card-padding: var(--space-lg);
--feature-card-shadow:  var(--shadow-sm);

/* Buttons */
--button-primary-bg:    var(--color-primary-500);
--button-primary-text:  var(--text-inverted);
--button-height:        44px;
--button-padding-x:     16px;
--button-font-size:     var(--text-md);

/* Cockpit Sidebar */
--cockpit-sidebar-bg:               var(--color-neutral-50);
--cockpit-sidebar-border:           var(--border-default);
--cockpit-sidebar-item-text:        var(--text-subtle);
--cockpit-sidebar-item-hover-bg:    oklch(from var(--color-neutral-200) l c h / 0.7);
--cockpit-sidebar-item-active-bg:   oklch(from var(--color-primary-100) l c h / 1);
--cockpit-sidebar-item-active-text: var(--text-primary);
```

---

## CTA Effects (globals.css)

Animated glow effects for hero CTAs and AI-specific sections. **Not** for every button.

### Color Themes

| Class | Use Case |
|-------|----------|
| `.cta-sky` | Default CTAs, InfoBoxes |
| `.cta-violet` | Dev-heavy pages |
| `.cta-teal` | Neutral accent |
| `.cta-amber` | Warm highlight |

### Usage

```tsx
<div className="cta-effect cta-sky">
  {/* content */}
</div>
```

- Respects `prefers-reduced-motion`
- Hover/focus boosts glow brightness and pulse speed
- Dark mode variant available: `.dark .cta-sky { ... }` defined in globals.css

---

## Animations

- `.animate-scan` — scan bar effect (3s linear infinite)
- `.button-shine` — CTA shine gradient sweep
- `.cta-effect::before` — `glassPulse` keyframe (7s ease-in-out)
- `.to-top::before` — `ttPulse` for scroll-to-top rocket

**Rules:** Apply sparingly to hero CTAs or AI sections. Always provide `prefers-reduced-motion` fallbacks.

---

## File Map

```
saas-ux/
├── app/tokens.css          # Primitive + semantic design tokens (OKLCH)
├── app/globals.css          # Base styles, theme transitions, CTA effects
├── styles/components.css    # Component-level tokens + component styles
└── tailwind.config.js       # Maps tokens to Tailwind utilities (darkMode: "class")
```
