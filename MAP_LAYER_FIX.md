# Map Layer Toggle Button Fix 🗺️

## Problem
The 4 layer toggle buttons at the top of the map were invisible.

## Root Cause
The `.map-wrapper-v2` container had `overflow: hidden`, which clipped the absolutely-positioned layer toggle buttons.

## Solution Applied

### 1. Changed Overflow Property
**File:** `client/src/pages/HomePage.v2.css`
- Changed `.map-wrapper-v2` from `overflow: hidden` to `overflow: visible`
- This allows the layer toggle buttons (positioned absolute) to show above the map

### 2. High Z-Index (Already Applied)
**Files:** `client/src/pages/HomePage.v2.css` and `client/src/styles/no-cards.css`
- `.layer-toggle-v2` has `z-index: 1000`
- `.layer-chip-v2` has `z-index: 1` with `position: relative`
- Ensures buttons appear above map controls (Leaflet/Google Maps)

### 3. Increased Opacity (Already Applied)
**File:** `client/src/pages/HomePage.v2.css`
- Background changed to `rgba(42, 31, 46, 0.98)` (was 0.95)
- Makes buttons more visible against map

## How to Test

1. **Hard Refresh Your Browser**
   - Press `Ctrl + Shift + R` (Windows)
   - Or `Cmd + Shift + R` (Mac)
   - This clears cached CSS

2. **Check the Map**
   - You should now see 4 buttons at the top-left of the map:
     - **ACTIVE QUESTS**
     - **CONFIRMED THREATS**
     - **THREAT CLUSTERS**
     - **URGENT QUESTS**
     - **DANGER ZONES**

3. **Click Each Button**
   - Each button should change the map layer
   - Active button shows in gold color
   - Map markers should change based on layer

## If Still Not Visible

### Check Browser Console
1. Press `F12` to open DevTools
2. Go to Console tab
3. Look for any CSS errors

### Inspect Element
1. Right-click on the map area
2. Select "Inspect"
3. Look for `.layer-toggle-v2` element
4. Check computed styles:
   - Should have `z-index: 1000`
   - Should have `position: absolute`
   - Should have `top: 16px`, `left: 16px`

### Verify Files Loaded
Check that these files are loaded:
- `client/src/pages/HomePage.v2.css`
- `client/src/styles/no-cards.css`

## Files Modified
- ✅ `client/src/pages/HomePage.v2.css` - Changed overflow to visible
- ✅ `client/src/styles/no-cards.css` - Already had z-index fixes

## Expected Result
The layer toggle buttons should now be visible and clickable at the top-left corner of the map, with a dark purple background and gold active state.
