---
description: How to implement the Xolvy Shield data integrity pattern in a module
---

# Xolvy Data Shield: Common Bank & Atomic Integrity

Follow these steps to apply "Xolvy Shield" to ensure data robustness, cross-module synchronization, and a **Unified Common Bank** (Banco Común) architecture:

## 1. Unified Common Bank (Architecture)

- **Single Source of Truth**: Identify the master collection (e.g., `historial_territorios`).
- **Universal Access**: All modules (Admin, Conductor, Public) MUST query this collection for historical or state-dependent data.
- **Reference Integrity**: Documents in sub-collections must reference the `id` of the master document to maintain a clean relational map.

## 2. Atomic Transactions (Pattern)

ALWAYS use `runTransaction` for operations that touch multiple documents.

```javascript
await runTransaction(db, async (transaction) => {
    // 1. Read all required docs first
    const masterDoc = await transaction.get(masterRef);
    // 2. Perform logic & validations
    // 3. Queue all updates at once
    transaction.update(masterRef, { status: 'Updated' });
    transaction.set(historyRef, { log: 'Change' });
    transaction.update(statsRef, { count: increment(1) });
});
```

## 3. Global Aggregations & Manual Resync

- **Pre-calculated Stats**: Maintain a `configuracion/stats_globales` document.
- **Resync Utility**: Every "Common Bank" implementation MUST include a `resyncGlobalStats()` function to audit and recover counts from raw data if drift occurs.

## 4. Auditability: Soft Deletes

- **Pattern**: NEVER use `deleteDoc` on common bank records.
- **Implementation**: Add `{ deleted: true, deletedAt: Timestamp.now() }` fields.
- **Filtering**: Update all queries to include `where("deleted", "!=", true)`.

## 5. Bilateral Propagation (Bilateral Sync)

Any modification in the History bank must trigger:

- **Territory Sync**: Update the current assignment state.
- **Program Sync**: Move/Update territories in the `programa_semanal` slots (Morning/Afternoon/Evening/Zoom).

## 6. Shielded Normalization

```javascript
const shield = {
    num: (v) => String(v || '').replace(/[^0-9(P)]/g, ''), // Supports Partials (P)
    date: (v) => (v || new Date().toISOString()).split('T')[0]
};
```

// turbo
10. Verify that Admin Reports and Conductor Views render identical data from the same Atomic Common Bank.
