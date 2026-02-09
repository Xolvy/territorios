---
description: How to implement and manage the Xolvy Updates system (AI-Driven & Discrete Notifications)
---

# Xolvy Updates: AI-Driven Discrete Notification System

This workflow defines the implementation and management of the **Xolvy Updates** system, which provides discrete, non-intrusive visual feedback and AI-generated insights during module synchronization (HMS).

## 1. System Architecture

The system consists of three main pillars:

1. **AI Insight**: Generates context-aware messages about the update using Gemini AI.
2. **Workflow HUD**: A side-aligned trace that visualizes the HMS (Hot Module Swapping) process in real-time.
3. **HMS Telemetry**: Discrete log traces inside the HUD (Handshake, Asset Search, Shield Validation).
4. **AI Banner**: A premium notification that displays the "Brain" (IA) explanation of the update.
5. **Silent Background Sync**: Core Shell version jumps occur automatically in the background without user interruption.
6. **Admin Telemetry (Auto-Sync)**: An automatic synchronization mechanism that updates Firestore version metadata.
7. **Seamless Handshake**: A post-reload visual feedback mechanism to confirm successful reconnection without requiring a re-login.

## 2. Zero-Caching Persistent Purge & Session Preservation

To prevent "stuck" versions while maintaining a premium UX (avoiding unnecessary logouts), the system implements `performRadicalCachePurge` with logic-aware scoping.

### Use Cases

- **Core Version Jump**: When `APP_VERSION` changes in `package.json`.
- **Service Worker Sticking**: When outdated assets are served from the Workbox cache.
- **Manual Rescue**: Can be triggered by the user or an administrator to fix local state issues.

### Implementation (`performRadicalCachePurge`)

1. **Smart Purge** (`full = false`):
   - Clears `caches` and unregisters Service Workers.
   - **Session Preservation**: Does NOT delete IndexedDB databases containing `auth` or `firebase-heartbeat`.
   - *Goal*: Update assets without logging the user out.
2. **Radical Purge** (`full = true`):
   - Clears `caches`, `sessionStorage`, and unregisters Service Workers.
   - **Total Erasure**: Deletes ALL IndexedDB databases.
   - *Goal*: Emergency recovery from corrupted states.
3. Call `await performRadicalCachePurge(isRescueMode)` before any reload.

### A. Intelligence Integration

Every module must have a description in `modules/utils/intelligence.js` so the AI can explain the update.

- Add the module name and a user-friendly description to the `moduleDescriptions` object in the `getUpdateInsight` method.

### B. Triggering an Update

Updates are triggered via the `ModuleRegistry` subscription in `app.js`:

- When `moduleRegistry.subscribe` detects a change, it calls `notifyModuleUpdate(moduleName, version)`.
- This function is located in `modules/utils/update-manager.js`.

### C. Visual Feedback Flow

1. **Sync Start**: `showXolvyUpdateHUD` creates a glassmorphism card with a spinning icon.
2. **AI Commentary**: If the module is "significant", `intelligence.getUpdateInsight` is called, and the message is shown via `showIANotification`.
3. **Sync Finish**: After the assets are loaded and the re-render is triggered, `completeXolvyUpdate(moduleName)` must be called to transition the HUD to the success state (emerald checkmark).

## 3. Premium Aesthetic Rules

- **Glassmorphism**: Use the `.xolvy-hud-glass` class for HUD elements.
- **AI Scanning**: Use the `.ia-scanline` class on AI banners for a "computing" look.
- **Smooth Transitions**: Use `animate-slide-left` for HUD entry and `animate-slide-up` for AI banners.
- **Progress Timing**: The AI banner progress bar must match the `setTimeout` duration of the banner removal (usually 12s).

## 4. Silent Background Sync (Core Upgrades)

Core upgrades are now handled automatically to prevent fragmentation and user fatigue.

### 1. Triggering

- It is triggered in `initUpdateManager` when a **Semantic Mismatch** is detected (`serverVersion > localVersion`).
- **No Manual Action**: The system starts `startBackgroundUpdate` immediately.

### 2. Visuals & HUD integration

- **Sync Start**: A HUD card appears in the sidebar saying: *"Sincronizando Núcleo v[Version]"*.
- **Offline Indication**: The HUD icon spins, and the AI may provide an IA Notification about the core changes.
- **Sync Finish**: The HUD transitions to an emerald checkmark, and the page reloads automatically with a session-preserving handshake.

### 3. State Preservation & Handshake

- **Immortalization**: Before reloading, the UI state is saved in `sessionStorage` (`xolvy_pre_update_state`).
- **Seamless Handshake**: Upon reload, `initUpdateManager` detects the flag and triggers a success notification bubble: *"¡Conexión Restablecida! Sistema Optimizado"*.

## 5. HMS Hook (Reference)

```javascript
moduleRegistry.subscribe(async (moduleName, version) => {
    const { notifyModuleUpdate, completeXolvyUpdate } = await import('./modules/utils/update-manager.js');
    
    // 1. Notify start and show AI insight
    notifyModuleUpdate(moduleName, version);

    // 2. State Immortalization (Rule 1.3)
    const uiState = { scroll: window.scrollY, timestamp: Date.now() };
    sessionStorage.setItem('xolvy_hms_state', JSON.stringify(uiState));

    // 3. Perform the swap/re-render
    setTimeout(() => {
        completeXolvyUpdate(moduleName);
        handleAuthChange(user).then(() => {
            // Restore state
            const saved = sessionStorage.getItem('xolvy_hms_state');
            if (saved) {
                const { scroll } = JSON.parse(saved);
                window.scrollTo({ top: scroll, behavior: 'smooth' });
                sessionStorage.removeItem('xolvy_hms_state');
            }
        });
    }, 2000);
});
```

## 6. Update Loop & Failure Protection (Anti-Loop Shield: UpdateShield)

To prevent infinite update cycles and handle synchronization failures gracefully (e.g., when Firestore metadata is ahead of the deployed code):

### 1. Loop & Version Detection Logic

- **Mechanism**: The `UpdateShield` object tracks attempts and target versions using `localStorage.getItem('xolvy_update_loop_stats')`.
- **Target Tracking**: The shield records the `lastTarget` version it attempted to reach.
- **Threshold**: If **3 updates** are attempted within **5 minutes** for the **same target version**, the system triggers a **Circuit Breaker**.
- **Registration**: Every `startBackgroundUpdate` call registers an attempt via `UpdateShield.registerAttempt(targetVersion)`.
- **Success Reset**: When `initUpdateManager` detects a version transition (`lastSessionVersion !== APP_VERSION`), it calls `UpdateShield.reset()`.

### 2. Failure Recovery (Safe Mode)

- **Rescue UI**: When `UpdateShield.isLocked()` is true, instead of background sync, a **Rescue UI** is centered on the screen.
- **Rescue Feedback**: The UI informs the user of their current version vs the target version and provides a "Deep Reset" button.
- **Deep Reset**: The Rescue Pill allows a manual reset which:
    1. Executes `UpdateShield.reset()`.
    2. Performs a `performRadicalCachePurge(true)`.
    3. Forces a network reload using a cache-busting query parameter (`?rescue=timestamp`).

### 3. Verification

- Use `console.warn` to track shield registration: `Shield registration for v[Version]`.
- If a loop is detected, the `Rescue UI` will be displayed with an `animate-float` icon to indicate a high-priority system state.

---
*Developed by Antigravity for Xolvy Projects.*

## 7. Admin Telemetry & Global Sync (Automatic Version Propagation)

To prevent Firestore from lagging behind code deployments, the system implements automatic telemetry.

### 1. The Lag Problem

If code `v2.4.2.9` is deployed but Firestore still shows `v2.4.2.5`, clients will enter a stale state or ignore the update. Manual updates via the Maintenance tab are prone to human error.

### 2. Auto-Sync Logic

- **Detection**: Every `initUpdateManager` check compares `APP_VERSION` (Local) vs `serverVersion` (Firestore).
- **Trigger**: If `Local > Server` AND the user is an **Administrator**, the system calls `broadcastCurrentVersion()`.
- **Metadata**: The Firestore record is updated with:
  - `latestVersion`: The new `APP_VERSION`.
  - `forceTimestamp`: `Date.now()`.
  - `forceUpdate`: `true`.
  - `updatedAt`: Human-readable timestamp.

### 3. Cascading Update

Once an Admin logs in, the entire fleet of Conductors receives the **Background Sync** within seconds, ensuring 100% version parity across the organization.

---
*Developed by Antigravity for Xolvy Projects.*

## 8. Pre-Deployment Validation & Proactive Repair

Before broadcasting a new version (Shell or Module), the developer MUST ensure system stability to prevent widespread client failures.

### 1. Pre-Flight Dependency Audit

When updating core libraries (e.g., `animejs`, `chart.js`, `firebase`), verify the API surface across the entire project.

- **Breaking Change Check**: If `animejs` v3 is updated to v4, all `import anime from 'animejs'` must change to `import { animate } from 'animejs'` and the usage updated (e.g., `easing` -> `ease`).
- **Build Killers**: Any missing export (e.g., `formatDateId`) will cause the build to fail. Check `UIHelpers` and `helpers.js` exports BEFORE deploying.

### 2. Mandatory Build Verification (The Build Shield)

NEVER broadcast a version that hasn't passed a production build.
// turbo

1. Run `npm run build`.
2. Inspect the output for `[vite-plugin-pwa:build]` or `Rollup Error` messages.
3. If errors occur, resolve all missing imports/exports before pushing to Git or Firestore.

### 3. Path & MIME Integrity (Glob Safety)

- **Relative Paths**: Always use relative paths (`./modules/*.js`) in `import.meta.glob`.
- **MIME Safety**: Absolute paths in production can trigger 404/MIME errors which cause the `UpdateShield` to trigger.
- **Cache Busting**: Ensure the `ModuleRegistry` handles the `?v=` parameter correctly to prevent stale asset loading.

### 4. Proactive Data Normalization (Smart Repair)

Corruption in Firestore data (e.g., territory numbers with leading/trailing spaces) can cause logic failures in the new version.

1. Before a version jump, the Administrator should run **"Reparación Cuántica"** (Smart Repair) from the Maintenance Tab.
2. This normalizes territory numbers, syncs historical records with the schedule, and audits phone registries.

## 8. Failure Prevention Rules (The Golden Rules)

| Scenario | Preventive Action |
| :--- | :--- |
| **New Export Added** | Ensure it is exported from `modules/services/ui-helpers.js` OR `modules/utils/helpers.js` and properly imported in all views. |
| **Library Version Bump** | Audit all `grep` matches of the library and update callback signatures/options. |
| **HMS Loop Detected** | Check `module-registry.js` for absolute paths or version mismatches in the `constructor`. |
| **MIME Error in Build** | Check `app.js` and `glob` usage; ensure Vite is bundling the dynamic targets correctly. |

---

## 9. CI/CD Automated Deployment & Version Sync

To eliminate manual human error and ensure Firestore version metadata always matches the deployed code, the system utilizes a GitHub-integrated CI/CD pipeline.

### 1. The Automation Script

The file `scripts/sync-version-auto.js` uses the `firebase-admin` SDK to programmatically update the `version_control` collection. It automatically reads the current version from `package.json`.

### 2. GitHub Actions Integration

The `.github/workflows/firebase-deploy.yml` workflow includes an extra step: **"Auto-update Firestore Version"**. This step:

- Executes immediately after a successful deployment to Firebase Hosting.
- Receives a Service Account key via GitHub Secrets.
- Forces the new `latestVersion` and `forceTimestamp` globally.

### 3. Developer Requirements

- **Version Bumping**: Developers must increment the `version` field in `package.json` for every deployment.
- **HMS Bumping**: If only specific modules changed without a shell update, increment their version in `modules/utils/module-registry.js`.
- **Secrets Management**: The `FIREBASE_SERVICE_ACCOUNT` secret must be valid in the GitHub repository settings.

---
Protocol Update: v2.4.3.3
