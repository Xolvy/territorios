# Implementation Plan: Advanced Territorial Dynamics ("Bolsa de Trabajo") & Smart Admin Suggestions

This plan transforms "Rescue Missions" from a tool for delayed assignments into a proactive marketplace for free territories, allowing partial assignments and providing intelligent suggestions for administrators.

## 1. Conductor Dashboard overhaul

### [MOD] `modules/conductor-dashboard.js`

- **Logic Change**: Replace `rescueCandidates` logic. Instead of filtering by delay, filter by `estado === 'Libre'`.
- **UI Renewal**:
  - Rename "Misiones de Rescate" to "Territorios Libres" or "Bolsa de Trabajo".
  - Update the modal cards to include a "Seleccionar Manzanas" button if the territory has multiple blocks.
- **Partial Assignment Implementation**:
  - integrate `showTerritorySelectionModal` (or a simplified version) within the conductor view.
  - If a user takes only part of a territory, call a new service `takeTerritoryPartial`.

## 2. Advanced Firestore Services

### [MOD] `data/firestore-services.js`

- **New function `takeTerritoryPartial(id, userId, takenManzanas, remainingManzanas)`**:
  - Creates a new territory document for the `takenManzanas` assigned to the user.
  - Updates the original territory document to contain only the `remainingManzanas`, staying in `Libre` status.
  - Logs the assignment.
- **Enhanced `returnTerritorioParcial`**:
  - Add a metadata flag `is_incomplete: true` to the remaining part of the territory to facilitate Admin suggestions.

## 3. Smart Admin Suggestions ("Admin Power Up")

### [MOD] `modules/admin/program-view.js` & `modules/services/ui-helpers.js`

- **Detection**: Create a helper to identify "Incomplete" territories (those with `is_incomplete: true` or those that are results of a split).
- **UI Integration**: In the `showTerritorySelectionModal` used by Admins:
  - Add a "Sugerencias de Refuerzo" section at the top.
  - Showcase territories that are partial/incomplete or have been unassigned for a long time.
  - Use a visual badge "Incompleto" or "Sugerido".

## 4. Visual & UX Polish

- Use the premium "glassmorphism" style for the new selection controls.
- Add success animations when a user "takes" a mission.
- Ensure the "Smart Suggestions" feel like an AI-driven or intelligent recommendation.

## Verification Steps

1. Verify "Bolsa de Trabajo" shows unassigned territories.
2. Test taking a full territory from the pool.
3. Test taking only 2 out of 5 manzanas and verify a new territory is created.
4. Verify from Admin view that the "Remaining" part is suggested for assignment.
