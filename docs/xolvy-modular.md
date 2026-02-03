# Xolvy Modular - Zero-Downtime & HMS Standard

**Xolvy Modular** is the architectural standard for high-availability web applications. It ensures that updates, whether global or granular, never interrupt the user's workflow.

## The Two-Tier Update Architecture

### 1. The Global Jump (Shell Update)

When the core application (the "Shell") is updated, the system enters **"Isolation Mode"**:

* **Visual Shield**: A premium, full-screen overlay informs the user while assets are staged.
* **Background Staging**: Uses Service Workers to download the new version in the background.
* **Session Immortalization**: The app saves the current path, scroll position, and user data so that after the refresh, the user is exactly where they left off.

### 2. Hot Module Swapping (HMS)

For smaller updates, we use granular module control:

* **Module Registry**: A central hub (`module-registry.js`) tracks the version of each individual module (Admin, Conductor, Login).
* **Independent Updates**: If the Admin module is updated, only that module is re-fetched. The rest of the application remains **Online and Interactive**.
* **Zero-Downtime Swap**: New code is pre-fetched and swapped in silently or during the next navigation.

## Implementation Standard

### State Management

Modules must be **Stateless** or **Rehydratable**:

1. On update, save local changes to `localStorage` or `IndexedDB`.
2. The new module version reads this state during initialization.
3. Once the new code is active, the module goes "Online" and syncs with Firestore.

### Versioning Rule

* **Core Changes**: Incremental `package.json` version.
* **Module Changes**: Update the `module_control` collection in Firestore to trigger HMS on all active clients.

---
*Developed by Antigravity for Xolvy Projects.*
