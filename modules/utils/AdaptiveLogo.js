/**
 * AdaptiveLogo Component (Vanilla JS)
 * Returns an <img> element that reacts to the global theme.
 */

export const createAdaptiveLogo = (className = 'h-10 w-auto', alt = 'Xolvy') => {
  const img = document.createElement('img');
  img.className = className;
  img.alt = alt;

  const updateSrc = () => {
    const isDark = document.documentElement.classList.contains('dark');
    // logo.svg (Light mode - dark brand)
    // logo2.svg (Dark mode - white/light brand)
    img.src = isDark ? '/logo2.svg' : '/logo.svg';
    
    // Fallback logic if logos are missing (using favicon as placeholder)
    img.onerror = () => {
      img.src = '/favicon.svg';
    };
  };

  updateSrc();

  // Listen for theme changes (using a custom event or checking classList)
  // Since theme-manager.js doesn't dispatch an event, we'll use a MutationObserver
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        updateSrc();
      }
    });
  });

  observer.observe(document.documentElement, { attributes: true });

  // Cleanup function (optional, can be attached to the element)
  img.__observer = observer;

  return img;
};

export default createAdaptiveLogo;
