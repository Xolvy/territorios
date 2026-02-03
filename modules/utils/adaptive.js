/**
 * XOLVY ADAPTIVE - Enterprise Responsive Engine
 * Handles automatic layout reordering and table-to-card transformations.
 */

export const XolvyAdaptive = {
    init() {
        console.log("🌟 [Xolvy Adaptive] Initializing Premium Responsive Engine...");
        this.observeTables();
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
    },

    /**
     * Finds all tables with the adaptive flag and prepares them
     * for mobile card transformation by injecting data-labels.
     */
    observeTables() {
        const tables = document.querySelectorAll('table[data-adaptive="true"]');
        tables.forEach(table => {
            const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText);
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, index) => {
                    if (headers[index]) {
                        cell.setAttribute('data-label', headers[index]);
                    }
                });
            });

            table.classList.add('xolvy-adaptive-ready');
        });
    },

    /**
     * Handles complex reordering of elements based on data-mobile-order attributes.
     */
    handleResize() {
        const isMobile = window.innerWidth < 768;
        const adaptiveContainers = document.querySelectorAll('[data-adaptive-container="true"]');

        adaptiveContainers.forEach(container => {
            const children = Array.from(container.children);

            if (isMobile) {
                // Sort by data-mobile-order
                children.sort((a, b) => {
                    const orderA = parseInt(a.getAttribute('data-mobile-order') || '999');
                    const orderB = parseInt(b.getAttribute('data-mobile-order') || '999');
                    return orderA - orderB;
                });
            } else {
                // Sort by data-desktop-order or original sequence
                children.sort((a, b) => {
                    const orderA = parseInt(a.getAttribute('data-desktop-order') || '0');
                    const orderB = parseInt(b.getAttribute('data-desktop-order') || '0');
                    return orderA - orderB;
                });
            }

            // Re-append in new order
            children.forEach(child => container.appendChild(child));
        });
    },

    /**
     * Public method to force a refresh on dynamically loaded content
     */
    refresh() {
        this.observeTables();
        this.handleResize();
    }
};
