/**
 * XOLVY ADAPTIVE - Enterprise Responsive Engine
 * Handles automatic layout reordering and table-to-card transformations.
 */

export const XolvyAdaptive = {
    init() {
        console.log("🌟 [Xolvy Adaptive] Initializing Premium Responsive Engine...");
        this.observeTables();
        this.observeWrappingMenus();
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
            const headRows = table.querySelectorAll('thead tr');
            // Support multi-row headers if present (use last row for labels)
            const lastHeaderRow = headRows[headRows.length - 1];
            if (!lastHeaderRow) return;

            const headers = Array.from(lastHeaderRow.querySelectorAll('th')).map(th => th.innerText);
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, index) => {
                    if (headers[index] && !cell.hasAttribute('data-label')) {
                        cell.setAttribute('data-label', headers[index]);
                    }
                });
            });

            table.classList.add('xolvy-adaptive-ready');
        });
    },

    /**
     * Ensures menus wrap to multiple rows instead of scrolling or cutting off
     */
    observeWrappingMenus() {
        // Find legacy scroll menus and new wrap menus
        const menus = document.querySelectorAll('[data-adaptive-scroll="true"], [data-adaptive-wrap="true"]');
        menus.forEach(menu => {
            menu.classList.add('flex-wrap');
            menu.classList.remove('xolvy-scroll-menu', 'scrollbar-hide', 'overflow-x-auto');
            // Ensure children don't shrink too much
            Array.from(menu.children).forEach(child => {
                if (child.tagName === 'BUTTON' || child.classList.contains('nav-item')) {
                    child.classList.add('shrink-0');
                }
            });
        });
    },

    /**
     * Handles complex reordering of elements based on data-mobile-order attributes.
     */
    handleResize() {
        const width = window.innerWidth;
        const isMobile = width < 768;
        const isUltraSmall = width < 480;

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

        // Global UI Scaling for extreme small screens
        if (isUltraSmall) {
            document.querySelectorAll('.btn-pro').forEach(btn => {
                btn.classList.add('px-3', 'py-2', 'text-[9px]');
                btn.classList.remove('px-6', 'py-4', 'px-8', 'px-10');
            });
        }
    },

    /**
     * Public method to force a refresh on dynamically loaded content
     */
    refresh() {
        this.observeTables();
        this.observeWrappingMenus();
        this.handleResize();
    }
};
