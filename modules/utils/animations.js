import { animate, stagger } from "animejs";

export const animateEntry = (targets, delay = 0) => {
    animate(targets, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 800,
        delay: stagger(100, { start: delay }),
        ease: "outExpo",
    });
};

export const animateEmphasis = (target) => {
    animate(target, {
        scale: [1, 1.05, 1],
        duration: 600,
        ease: "inOutQuad",
    });
};

export const animateSuccess = (target) => {
    animate(target, {
        scale: [0.8, 1],
        opacity: [0, 1],
        duration: 500,
        ease: "spring(1, 80, 10, 0)",
    });
};

export const animateList = (listSelector) => {
    animate(`${listSelector} > *`, {
        opacity: [0, 1],
        translateX: [-10, 0],
        delay: stagger(50),
        duration: 400,
        ease: "outQuad",
    });
};
