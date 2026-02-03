---
description: How to implement and manage the Xolvy Modular update system (HMS & Zero-Downtime)
---

# Xolvy Modular: Zero-Downtime System

This workflow defines the "Golden Rule" for updates in Xolvy applications, ensuring that users never experience broken workflows during transitions.

## 1. Global Updates (Core Shell)

When the entire application needs a core update:

- **Aisle-First Strategy**: The `UpdateManager` must trigger a premium overlay that "isolates" the user session.
- **Offline Working State**: While the background stages new assets via Service Workers, the current session remains functional in memory.
- **State Inmortalization**: Save the current UI state (scroll, path, user context) in `sessionStorage` before reloading.
- **Sincronización Post-Update**: Recovery of state upon reload to ensure a seamless "jump" to the new version.

## 2. Granular Updates (HMS - Hot Module Swapping)

When only one module (e.g., Admin, Conductor) changes:

- **Individual Isolation**: The specific module enters an "Offline/Updating" visual state if necessary, while the rest of the app remains Online.
- **Background Pre-fetch**: Use `ModuleRegistry` to pre-fetch only the updated `.js` file with a new version tag (`?v=...`).
- **Silent Swapping**: Once the module is cached, the next navigation or a manual trigger swaps the module without a full page reload.
- **Sync on Finish**: The updated module automatically reconciles its local state with Firestore once declared "Online".

## 3. Implementation Rules

- **Versioning**: Always update the version in `package.json` and `module_control` in Firestore.
- **HMS Ready**: Every new module must export a `render` or `init` function that can be re-called by the Shell.
- **Visual Feedback**: Use gradients and animations (Rocket icon, progress bars) to "Wowed" the user during updates.
- **Discrete Notifications**: Integrate with the [Xolvy Updates System](./xolvy-updates.md) to provide AI-driven insights and HUD status without breaking the user's flow.

---
*Developed by Antigravity for Xolvy Projects.*
