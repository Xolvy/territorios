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

## 3. Maintenance & Customization

The adaptive logic is split between:

- `modules/utils/adaptive.js`: Logic for DOM transformation and reordering.
- `src/input.css`: The `@media` rules for the card-style visualization.

---
*Developed by Antigravity for Xolvy Projects.*
