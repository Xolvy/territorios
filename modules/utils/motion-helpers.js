/**
 * @file motion-helpers.js
 * @description Xolvy Motion System — Motion One micro-animations with stagger.
 * Provides fluid, GPU-accelerated animations for DOM element entry/exit.
 */
import { animate, stagger } from 'motion';

// ─── STAGGER ENTRY ─────────────────────────────────────────────────────────────

/**
 * Animate a list of elements with a staggered cascade effect.
 * Use this after injecting items via innerHTML.
 *
 * @param {string|HTMLElement[]} selector - CSS selector or array of elements
 * @param {Object} [options]
 * @param {number} [options.delay=0.04] - Stagger delay between items (seconds)
 * @param {number} [options.duration=0.35] - Animation duration per item
 * @param {number} [options.startDelay=0] - Initial delay before cascade begins
 */
export const staggerIn = (selector, options = {}) => {
    const {
        delay = 0.04,
        duration = 0.35,
        startDelay = 0,
    } = options;

    const elements = typeof selector === 'string'
        ? Array.from(document.querySelectorAll(selector))
        : selector;

    if (!elements || elements.length === 0) return;

    // Ensure elements are initially invisible to avoid flash
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(12px)';
    });

    animate(
        elements,
        { opacity: [0, 1], y: [12, 0] },
        {
            duration,
            delay: stagger(delay, { start: startDelay }),
            easing: [0.22, 1, 0.36, 1], // CSS spring-like easing
        }
    );
};

/**
 * Animate a single element into view.
 * @param {HTMLElement} el
 * @param {Object} [options]
 */
export const fadeIn = (el, options = {}) => {
    if (!el) return;
    const { duration = 0.3, y = 8, delay = 0 } = options;
    el.style.opacity = '0';
    animate(el, { opacity: [0, 1], y: [y, 0] }, {
        duration,
        delay,
        easing: [0.22, 1, 0.36, 1],
    });
};

/**
 * Animate an element out (fade + slide up).
 * @param {HTMLElement} el
 * @param {Function} [onComplete] - Callback after animation ends
 */
export const fadeOut = (el, onComplete) => {
    if (!el) return;
    animate(el, { opacity: [1, 0], y: [0, -8] }, {
        duration: 0.2,
        easing: 'ease-in',
    }).finished.then(() => {
        if (onComplete) onComplete();
    });
};

/**
 * Pulse a button or element (click feedback).
 * @param {HTMLElement} el
 */
export const pulse = (el) => {
    if (!el) return;
    animate(el, { scale: [1, 0.93, 1] }, { duration: 0.25, easing: 'ease-in-out' });
};

/**
 * Standard page-section reveal on scroll using IntersectionObserver + Motion.
 * Attach to any container to animate its direct children.
 * @param {string} containerSelector
 */
export const observeAndReveal = (containerSelector) => {
    const containers = document.querySelectorAll(containerSelector);
    if (!containers.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const children = Array.from(entry.target.children);
                staggerIn(children, { delay: 0.06 });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    containers.forEach(c => observer.observe(c));
};

/**
 * Animate a list in the phone Live Pool after data refresh.
 * Targets rows within a given table body.
 * @param {HTMLElement} tbody
 */
export const animatePhoneTableRows = (tbody) => {
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    staggerIn(rows, { delay: 0.03, duration: 0.28, startDelay: 0.05 });
};

/**
 * Animate agenda day cards on load.
 * @param {HTMLElement} container
 */
export const animateAgendaCards = (container) => {
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('[class*="modern-card"], [class*="group"]'));
    staggerIn(cards, { delay: 0.07, duration: 0.4, startDelay: 0.1 });
};

// ─── GLOBAL EXPOSURE ──────────────────────────────────────────────────────────
window.XolvyMotion = { staggerIn, fadeIn, fadeOut, pulse, animatePhoneTableRows, animateAgendaCards };
