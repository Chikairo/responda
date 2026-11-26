# TASK: Targeted UX, Navigation, Theme-Sync & Demo-Flow Fixes for Responda

You are updating the existing **Responda** React + TypeScript + Tailwind CSS + Express 5 application (`data/responda-db.json` atomic store, server-issued Bearer session auth, `LagosMap`, `SimulationControlPanel`).

**CRITICAL EXECUTION RULE:**
The visual design system and color theme are **already completed and applied**—do NOT redesign the UI, change color tokens, or alter font families. Your task is strictly to resolve the **8 specific UX, header layout, navigation, interaction, and demo-flow issues** detailed below while preserving all existing working functionality.

---

## PART A — PRE-IMPLEMENTATION CODEBASE INSPECTION
Before editing or creating any file, inspect the existing codebase to locate:
1. The global shell header component (where `"Responda Medical Emergency Coordination (Lagos)"`, the date/time stamp, the manual theme toggle, and `"Demo Profile (Prototype Auth):"` are rendered).
2. `index.html` (head metadata and browser tab favicon tags).
3. The root theme provider / theme state logic and how `LagosMap` switches between dark and light map tiles.
4. The sidebar navigation (`sidenav`) layout container across desktop and mobile breakpoints.
5. All dropdown menus, popovers, and modal components (`DispatchConfirmModal`, `ConfirmActionModal`, `OperatorGuideModal`, Demo Profile switcher dropdown, filter dropdowns, and unit availability override modal).
6. The `Incident Management` list view (`+ New Emergency Intake` button/modal) and the live call demo state machine (`SimulationControlPanel`, intake transcript runner, and milestone progression logic).

---

## PART B — WHAT MUST BE PRESERVED
* **Existing Design Theme & Styling:** Keep all existing dark/light CSS variables, Tailwind styling, `Plus Jakarta Sans` / `DM Sans` / `JetBrains Mono` typography, and `RespondaLogo` styling intact.
* **Backend, Auth & Persistence:** Preserve the Express 5 server, server-issued HMAC-signed Bearer session authentication (`Authorization: Bearer <token>`), two-role RBAC (`Operations Staff` 4 tabs / `Organisation Administrator` 5 tabs), WebSocket listeners (`/ws/events`, `/ws/live-intake`), and `data/responda-db.json` atomic store.
* **Medical-Only Operational Scope:** Keep active operational incidents strictly medical (`Medical`, `Road accident`), keep historical non-medical records isolated as read-only `Legacy / Out-of-Scope` records in `Incident History`, and keep legacy non-medical units `Inactive`.

---

## PART C — THE 8 REQUIRED UX & FUNCTIONAL FIXES

### 1. Responsive `'Demo Profile (Prototype Auth):'` Label (`< 1024px` vs. `>= 1024px`)
* Locate the prototype session switcher in the top header bar.
* **Mobile & Tablet (`< 1024px` / below Tailwind `lg`):** Hide the text label `"Demo Profile (Prototype Auth):"` (`hidden lg:inline`) and render **only** the compact role badge and account switcher dropdown directly so it does not crowd or wrap the header.
* **Desktop (`>= 1024px` / `lg:inline`):** Display the full `"Demo Profile (Prototype Auth):"` label beside the role badge and dropdown.

### 2. Main Header Brand Placement (`RespondaLogo` + Name) & Browser Favicon
* **Top Header Left Slot:** Render `RespondaLogo` (the red rounded-square beacon icon) paired with the `"Responda"` wordmark on the **left** side of the main page top header bar (in addition to appearing in the collapsible sidebar when expanded), alongside the mobile menu button on smaller viewports.
* **Top Header Right Slot:** Align all remaining header utilities (Demo Profile switcher, `Operator Guide`, etc.) cleanly to the **right** (`ml-auto flex items-center gap-2 sm:gap-3`).
* **Browser Favicon (`index.html`):** The browser tab favicon is currently empty. Add an inline SVG favicon matching `RespondaLogo` inside `<head>` in `index.html`:
  ```html
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23E12D39'/%3E%3Ccircle cx='16' cy='16' r='9' fill='%23FFFFFF' fill-opacity='0.24'/%3E%3Ccircle cx='16' cy='16' r='5.5' fill='%23FFFFFF'/%3E%3C/svg%3E" />
  ```

### 3. Automatic System-Intuitive Light/Dark Theme (Remove Manual Theme Toggle)
* **Remove Manual Toggle:** Completely remove the manual Light/Dark theme toggle button from the top header (and any settings screen) to save header space and eliminate redundant controls.
* **Sync Automatically with User Device (`prefers-color-scheme`):**
  * Update the root theme provider / `App` effect to read `window.matchMedia('(prefers-color-scheme: dark)')` on initial mount and attach a `change` event listener.
  * Whenever the user's device switches between Light Mode and Dark Mode, immediately update `document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')` and toggle the `.dark` class on `<html>`.
  * Ensure `LagosMap` automatically switches its cartography tile layer between Dark Mode and Light Mode whenever the system theme changes.

### 4. Replace Bulky Header Title & Timestamp Block
* In the main top header bar, locate and **remove** the two-line text block:
  > `Responda Medical Emergency Coordination (Lagos)`
  > `Thu, 26 Nov 2026 · 12:40 PM`
* Replace that exact left-hand header slot with the **`RespondaLogo` icon + `"Responda"` wordmark** specified in Item 2 so the header remains clean, compact, and aligned across desktop, tablet, and mobile.

### 5. Interactive Pointer Cursors (`cursor: pointer`) & Click-Outside / Escape Dismissal
* **Pointer Cursors on All Clickable Items:** Ensure **every clickable element** across the entire application—all `<button>` elements, dropdown triggers, menu options, table rows, incident cards, response unit cards, filter pills, milestone steps, tabs, and icon buttons—explicitly uses `cursor: pointer` (`cursor-pointer` in Tailwind plus a global CSS rule in `index.css`):
  ```css
  button:not(:disabled),
  [role="button"]:not([aria-disabled="true"]),
  select,
  a {
    cursor: pointer;
  }
  ```
* **Close Dropdowns & Modals on Outside Click or `Escape`:**
  * Add click-outside detection (`mousedown` / `pointerdown` outside the container ref, plus modal backdrop clicks) and `Escape` key listeners to **all dropdown menus, popovers, and modals** (`DispatchConfirmModal`, `ConfirmActionModal`, `OperatorGuideModal`, Demo Profile switcher dropdown, filter dropdowns, and unit override modals) so clicking anywhere outside closes them cleanly in addition to their close (`×`) button.
  * **STRICT EXCLUSION:** Do **NOT** apply click-outside auto-close to the persistent sidebar navigation menu (`sidenav`), so clicking inside the main workspace never unintentionally closes or collapses the sidenav.

### 6. Fixed Sidenav Menu on Both Mobile and Desktop
* Lock the outer application shell to the viewport (`h-screen h-dvh overflow-hidden flex`) so the **sidebar navigation menu (`sidenav`) remains fixed in place** on both desktop and mobile viewports and never scrolls off-screen when the user scrolls long incident lists, transcripts, or audit timelines.
* Only the inner main workspace container (`flex-1 overflow-y-auto`) should scroll.
* On mobile viewports (`< 1024px`), anchor the slide-over sidenav with `fixed inset-y-0 left-0 z-40 h-dvh` so it stays fixed to the viewport during scroll.

### 7. Fix Stalled Demo Live Call Transcript & Stage Progression (`Report & Intake` → `Assessment & Verification`)
* **Problem to Fix:** Currently, starting the demo initiates the emergency call, but the live call transcript stalls after the opening line while the workflow stage remains stuck on `Milestone 1: Report & Intake`, preventing progression into `Milestone 2: Assessment & Verification`.
* **Required Demo Behavior:**
  1. When the demo call begins (`Stage 1: Incoming Call` → `Stage 2: AI Intake`), execute the **complete multi-turn Q&A conversation** between `RESPONDA AI` and `CALLER` sequentially (both when auto-playing via `Play` and when stepping forward), rendering every question and caller answer clearly in the live transcript feed.
  2. As each caller answer arrives in the transcript, progressively populate and tag (`AI` / `AUTO-STRUCTURED`) the extracted structured intake fields (`Incident Category`, `Patient Count`, `Consciousness`, `Reported Injuries`, `Hazards`, and `Caller-Described Landmark`).
  3. Immediately upon completion of the intake Q&A conversation, **automatically advance** the simulation state and incident milestone from `Milestone 1: Report & Intake` (`New`) into **`Milestone 2: Assessment & Verification`** (`Under Review` — `Stage 3: Location Resolution` / `Stage 4: Human Takeover`) so the operator can seamlessly review the extracted brief, verify the location, confirm priority, and continue through dispatch (`Stage 6–7`), 60-second simulated tracking + distinct arrival/pickup/hospital transport checkpoints (`Stage 8`), and closure (`Stage 9`).
  4. Keep `SimulationControlPanel` (`Prev`, `Play / Pause`, `Next`, `Reset`) synchronized with this progression and reflected live across `Command Centre`, `LagosMap`, `Incident Management`, and the `Audit Trail`.

### 8. Remove Redundant `+ New Emergency Intake` Manual Entry Flow
* Because Responda is designed to receive emergency calls rather than manually collect emergencies via a standalone creation form, **remove** the `+ New Emergency Intake` button and its manual creation modal/form from `Incident Management` (`Incident List` view).
* Preserve the underlying incoming-call ingestion (`SimulationControlPanel` and `/ws/live-intake`) so simulated and live call-driven incidents continue to populate the queue normally.

---

## PART D — STRICT EXCLUSIONS
* **Do NOT** alter the existing color palette, font families, or visual design theme.
* **Do NOT** add standalone `AI Intake`, `Conversation Centre`, `Analytics`, or `Responsive Showcase` pages, or add new user roles beyond `Operations Staff` and `Organisation Administrator`.
* **Do NOT** migrate to Firebase or trust client-supplied role/operator headers (`x-responda-role`, `x-responda-operator`).
* **Do NOT** fabricate GPS coordinates, carrier triangulation (`"Carrier location integration not configured"` must remain honest), distances, ETAs, or unapproved hardcoded hospitals/landmarks.

---

## PART E — FINAL VERIFICATION CHECKLIST
Before finishing, verify all 8 fixes:
1. Below `1024px`, `"Demo Profile (Prototype Auth):"` is hidden and only the role + dropdown appear; at `>= 1024px`, the full label is shown.
2. Top header left displays `RespondaLogo` + `"Responda"`, remaining header utilities align right, and the Responda red beacon icon renders as the browser tab favicon.
3. No manual Light/Dark toggle button exists; changing device `prefers-color-scheme` switches both app theme and `LagosMap` tiles automatically.
4. `"Responda Medical Emergency Coordination (Lagos) / Thu, 26 Nov 2026 · 12:40 PM"` is completely replaced by the Responda logo and name.
5. Every clickable control has `cursor: pointer`; all dropdowns and modals close on outside click or `Escape`, while the sidenav remains unaffected.
6. Scrolling the main workspace keeps the sidenav fixed on both desktop and mobile.
7. Running the demo plays the complete Q&A call transcript, populates structured AI intake fields, and automatically transitions from `Report & Intake` (`New`) into `Assessment & Verification` (`Under Review`) and through Stage 9 closure without stalling.
8. The `+ New Emergency Intake` manual button and creation form are removed from `Incident Management`.