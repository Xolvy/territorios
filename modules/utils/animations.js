import anime from 'animejs';
export const animateEntry = (targets, delay = 0) => {
    if (!anime) return;
    anime({
        targets: targets,
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 800,
        delay: anime.stagger(100, { start: delay }),
        easing: 'easeOutExpo'
    });
};

export const animateEmphasis = (target) => {
    if (!anime) return;
    anime({
        targets: target,
        scale: [1, 1.05, 1],
        duration: 600,
        easing: 'easeInOutQuad'
    });
};

export const animateSuccess = (target) => {
    if (!anime) return;
    anime({
        targets: target,
        scale: [0.8, 1],
        opacity: [0, 1],
        duration: 500,
        easing: 'spring(1, 80, 10, 0)'
    });
};

export const animateList = (listSelector) => {
    if (!anime) return;
    anime({
        targets: `${listSelector} > *`,
        opacity: [0, 1],
        translateX: [-10, 0],
        delay: anime.stagger(50),
        duration: 400,
        easing: 'easeOutQuad'
    });
};

