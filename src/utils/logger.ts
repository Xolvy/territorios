const isProd = process.env.NODE_ENV === "production";

export const logger = {
  log: (...args: any[]) => {
    if (!isProd) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (!isProd) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (!isProd) console.error(...args);
  },
};

export default logger;
