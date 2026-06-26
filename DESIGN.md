---
name: Sentinel Civic Design System
description: Hyperlocal operations dashboard & gamified civic tracking platform for Lucknow
colors:
  primary: "#c9a35a"
  bg-primary: "#15161d"
  bg-secondary: "#191a21"
  bg-surface: "#1b1d25"
  bg-elevated: "#20222a"
  ink-primary: "#f1f2f4"
  ink-secondary: "#d9dbe0"
  ink-muted: "#a1a5b0"
  success: "#10b981"
  warning: "#f59e0b"
  error: "#ef4444"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 700
  body:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.85rem"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.bg-secondary}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Sentinel Civic

## 1. Overview

**Creative North Star: "The Hyperlocal Tactical Command"**

This system represents a high-fidelity civic telemetry dashboard for municipal monitoring and citizen action in Lucknow. The design is inspired by modern operations centers (Grafana, dark cybernetic telemetry panels, high-contrast visual cues), conveying real-time responsiveness and civic duty. It features a deep dark-mode color scheme offset by luminous accents on critical alerts, interactive charts, and gamified leaderboard panels.

**Key Characteristics:**
- **Operations Density**: High information density with crisp grids and telemetry-styled monospace tables.
- **Micro-Interactive feedback**: Subtle hover scales, outline changes, and glowing indicators for critical paths.
- **Visual Sizing Stability**: Strict separation of information layers using blur-backdrop absolute overlays, preventing layout shift when explaining metrics.

## 2. Colors

The color palette uses deep, saturated dark values as bases, allowing critical status lights and the gold primary accent to stand out.

### Primary
- **Command Amber Gold** (oklch(0.75 0.12 85) / #c9a35a): The primary brand color. Denotes action prompts, metric summaries, and highlights. Used sparingly to preserve visual hierarchy.

### Secondary
- **Success Green** (oklch(0.65 0.16 155) / #10b981): Represents resolved states and optimal SLA values.
- **Warning Amber** (oklch(0.72 0.16 75) / #f59e0b): Represents in-progress states or warning bounds.
- **Error Red** (oklch(0.60 0.20 25) / #ef4444): Represents critical alerts and SLA breach states.

### Neutral
- **Midnight Base** (oklch(0.18 0.01 260) / #15161d): Primary background.
- **Console Slate** (oklch(0.20 0.012 260) / #191a21): Card and grid container surface.
- **Glint White** (oklch(0.95 0.02 90) / #f1f2f4): Primary text.

### Named Rules
**The Accented Rarity Rule.** Accent gold is used on no more than 10% of any view. Its visual prominence is what drives user attention.

## 3. Typography

**Display Font:** Playfair Display, Georgia, serif
**Body Font:** Outfit, sans-serif
**Label/Mono Font:** JetBrains Mono, monospace

### Hierarchy
- **Display** (Bold, 1.75rem, line-height: 1.2): Used for primary KPIs, page titles, and total issue counts.
- **Headline** (Semi-bold, 1.25rem, line-height: 1.3): Used for card titles.
- **Body** (Regular, 1rem, line-height: 1.6): Used for normal prose, alerts, and descriptive text.
- **Label / Mono** (Medium, 0.85rem, letter-spacing: 0.05em): Used for mathematical formulas, telemetry readouts, table headers, and coordinates.

## 4. Elevation

The interface is flat by default, relying on tonal contrast and thin borders to establish structure. Shadows are used only to draw focus to critical alert overlays or active dashboard nodes.

### Shadow Vocabulary
- **Critical Glow** (box-shadow: 0 0 12px rgba(239, 68, 68, 0.15)): Luminous crimson boundary indicator.
- **Standard Card Border** (border: 1px solid oklch(0.30 0.01 260)): Subtle boundary definition for cards.

## 5. Components

### Buttons
- **Shape:** Rounded corners (10px radius) or full pill (9999px).
- **Primary:** Amber Gold background, black text, with transform hover transitions.

### Cards / Containers
- **Corner Style:** Rounded corners (14px radius).
- **Background:** Midnight/Console Slate gradient with thin subtle borders.
- **Explanation Overlays:** Absolute positioned overlay with backdrop-blur (4px) and semi-transparent dark backing (rgba(21, 22, 29, 0.96)).

### Inputs / Fields
- **Style:** Subtle border (oklch(0.30 0.01 260)), dark background, focus border shift to Primary Amber Gold.

## 6. Do's and Don'ts

### Do:
- **Do** use absolute overlays for explanations to prevent Chart.js containers from resizing permanently.
- **Do** format math details using the `<Latex>` KaTeX renderer with proper block notation.
- **Do** color code telemetry elements (green, orange, red) strictly based on priority and risk scoring indexes.

### Don't:
- **Don't** use side-stripe borders of high thickness (>1px) as alert indicators on cards.
- **Don't** use gradient text on headers.
- **Don't** apply card shadows with blurs exceeding 16px.
- **Don't** overflow text outside of fixed-height grid elements (e.g. use scroll wraps in KPI widgets).
