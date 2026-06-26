---
name: Sentinel Civic Design System
description: Hyperlocal community hero network & gamified civic tracking platform for Lucknow
colors:
  primary: "#6366f1"
  bg-primary: "#15161d"
  bg-secondary: "#191a21"
  bg-surface: "#1b1d25"
  bg-elevated: "#20222a"
  ink-primary: "#f1f2f4"
  ink-secondary: "#d9dbe0"
  ink-muted: "#a1a5b0"
  success: "#10b981"
  warning: "#f59e0b"
  error: "#f43f5e"
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
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.bg-secondary}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Sentinel Civic

## 1. Overview

**Creative North Star: "The Community Hero Network"**

This system represents a high-fidelity civic action platform for Lucknow citizens, blending a community watch feel with AI-assisted insights. The design is clean and dashboard-driven, using a dark mode theme with smart accenting (Indigo, Emerald, Amber, Rose) and pixel-art details to reward citizen participation.

**Key Characteristics:**
- **Community Focus**: Visual hierarchy that prioritizes map interactions, recent activity feeds, and citizen achievements.
- **Accented Simplicity**: Tonal card grids using subtle borders rather than nested cards.
- **Earned Gold**: Gold and medal markers are reserved strictly for badges, XP levels, and top-tier rankings to ensure it feels earned.

## 2. Colors

The color palette features clean, modern semantic colors on dark charcoal surfaces.

### Primary
- **Intelligence Indigo** (#6366f1): The primary brand color. Denotes action buttons, active selections, and interactive controls.

### Secondary
- **Verified Emerald** (#10b981): Represents resolved issues, high community vote trust, and verified states.
- **Warning Amber** (#f59e0b): Represents in-progress actions or moderate risk bounds.
- **Critical Rose** (#f43f5e): Represents critical alerts and SLA breach states.

### Neutral
- **Midnight Base** (#15161d): Primary page background.
- **Console Slate** (#191a21): Cards and panels background.
- **Glint White** (#f1f2f4): Primary text.

## 3. Typography

**Display Font:** Playfair Display, Georgia, serif
**Body Font:** Outfit, sans-serif
**Label/Mono Font:** JetBrains Mono, monospace

### Hierarchy
- **Display** (Bold, 1.75rem): Used for primary KPIs, page titles, and total issue counts.
- **Headline** (Semi-bold, 1.25rem): Used for card titles.
- **Body** (Regular, 1rem): Used for descriptions and comments.
- **Label / Mono** (Medium, 0.85rem): Used for coordinates, time trackers, and statistics.

## 4. Components

### Buttons
- **Shape:** Rounded corners (10px radius) or full pill.
- **Primary:** Indigo background, white text.

### Cards / Containers
- **Corner Style:** Rounded corners (14px radius) or retro stone panels (0px radius).
- **Background:** Console Slate.

## 5. Do's and Don'ts

### Do:
- **Do** align headers and layouts to a unified 1200px container width.
- **Do** show citizen impact statistics prominently on profiles.

### Don't:
- **Don't** use gold color for standard buttons or non-reward text elements.
- **Don't** use complex RPG terminology (Quest, Threat, Swarm) for basic community reports.
