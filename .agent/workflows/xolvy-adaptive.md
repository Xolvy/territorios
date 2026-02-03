---
description: How to implement and manage the Xolvy Adaptive system (Hot Layout Swapping & Card Transformation)
---

# Xolvy Adaptive: Premium Responsive Engine

The **Xolvy Adaptive** system is an enterprise-grade responsive framework designed to provide high-visibility layouts on mobile devices without relying on traditional horizontal scrolling. It transforms dense tables into interactive cards and reorders interface elements based on context and importance.

## 1. Core Principles

1. **Zero-Scroll Tables**: Tables with high column counts are automatically converted to vertical card stacks on mobile (`max-width: 640px`).
2. **Context Persistence**: Row labels are maintained in card view using `data-label` attributes injected at runtime.
3. **Visual Reordering**: Elements can be assigned `data-mobile-order` and `data-desktop-order` to optimize navigation flow across devices.
4. **Premium Aesthetics**: Cards utilize depth (box-shadows), transitions, and glassmorphism to look and feel high-end.

## 2. Implementation Guide

### A. Adaptive Tables

To make a table adaptive, simply add the `data-adaptive="true"` attribute.

```html
<table data-adaptive="true" class="w-full">
    <thead>
        <tr>
            <th>Name</th>
            <th>Role</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>John Doe</td>
            <td>Admin</td>
        </tr>
    </tbody>
</table>
```

The system will:

1. Hide `<thead>` on mobile.
2. Convert each `<tr>` to a standalone card.
3. Add "Name:" and "Role:" labels before the respective `<td>` content.

### B. Adaptive Containers (Reordering)

Wrap your section in a container with `data-adaptive-container="true"`.

```html
<div data-adaptive-container="true">
    <div data-mobile-order="2" data-desktop-order="1">Panel A</div>
    <div data-mobile-order="1" data-desktop-order="2">Panel B</div>
</div>
```

On mobile, **Panel B** will appear first. On desktop, **Panel A** remains first.

### C. JS Cycle

The engine is initialized in `app.js` and should be refreshed whenever dynamic content is injected or a Hot Module Swap (HMS) occur.

```javascript
import { XolvyAdaptive } from './modules/utils/adaptive.js';

// Initial load
XolvyAdaptive.init();

// Dynamic content refresh
async function onDataLoaded() {
    renderContent();
    XolvyAdaptive.refresh();
}
```

### D. Adaptive Horizontal Scroll (Swiping Menus)

For menus with many buttons that would normally wrap or cut off, use `data-adaptive-scroll="true"`. This converts the container into a premium horizontal swipe-area on mobile with hidden scrollbars.

```html
<nav data-adaptive-scroll="true" class="flex items-center gap-4">
    <button>Option 1</button>
    <button>Option 2</button>
    <button>Option 3</button>
    <!-- ... -->
</nav>
```

### E. Auto-Scaling Buttons (.btn-pro)

Buttons with the `.btn-pro` class are monitored by the adaptive engine. On extreme small devices (`< 480px`), the engine automatically reduces their padding and font size to prevent layout breakage.

## 3. Maintenance & Customization

The adaptive logic is split between:

- `modules/utils/adaptive.js`: Logic for DOM transformation, reordering, and scaling.
- `src/input.css`: The `@media` rules for the card-style visualization and `.xolvy-scroll-menu` utilities.

---
*Developed by Antigravity for Xolvy Projects.*
*Protocol Update: v2.4.3.4 (Super Adaptive)*
