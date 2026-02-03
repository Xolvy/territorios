---
description: How to implement and manage the Xolvy Updates system (AI-Driven & Discrete Notifications)
---

# Xolvy Updates: AI-Driven Discrete Notification System

This workflow defines the implementation and management of the **Xolvy Updates** system, which provides discrete, non-intrusive visual feedback and AI-generated insights during module synchronization (HMS).

## 1. System Architecture

The system consists of three main pillars:

1. **AI Insight**: Generates context-aware messages about the update using Gemini AI.
2. **Discrete HUD**: A sidebar element indicating the real-time synchronization state of specific modules.
3. **AI Banner**: A premium notification that displays the "Brain" (IA) explanation of the update.

## 2. Implementation Steps

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

## 4. HMS Hook (Reference)

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

---
*Developed by Antigravity for Xolvy Projects.*
