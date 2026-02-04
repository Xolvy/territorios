---
description: How to implement the Xolvy Shield data integrity pattern in a module
---

Follow these steps to apply "Xolvy Shield" to any new or existing module to ensure data robustness:

1. **Identify Critical Fields**: Determine which fields are essential for the module (e.g., `numero`, `id`, `fecha`).
2. **Implement Normalization**: Add a normalization helper at the top of the file or in a shared utility.

    ```javascript
    const normalize = (val) => String(val || '').trim();
    ```

3. **Apply Ghost Filtering**: When fetching data from Firestore or any source, filter out records that don't meet the normalization criteria.
4. **Add Visual Status Badges**: If the module involves data that can be "soft" or "hard" assigned, implement a status badge component:
    - **LISTO**: Valid sync.
    - **OCUPADO**: Conflict found.
    - **ASIGNAR**: Needs formalization.
5. **Enforce Terminology**: Use `.replace()` logic to strip prefixes like "Grupo " or fix legacy terms like "Salmo" to "Mz.".
6. **Nested Array Serialization**: Firestore doesn't support nested arrays (GeoJSON). ALWAYS use `JSON.stringify(geojson)` before saving and `JSON.parse(data.geojson)` in the normalization engine to ensure map persistence.
7. **Add 'Shield' Comments**: Mark these sections with `// Xolvy Data Shield: [Description]` to make it part of the system's identity.

// turbo
7. Verify implementation by running `npm run lint` or checking the module in the browser.
