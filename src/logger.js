export const logger = (scope) => ({
  log(msg) {
    console.log(`[${scope}] ${msg}`);
  },
  debug(msg) {
    console.debug(`[${scope}] ${msg}`);
  },
  error(msg, err) {
    console.error(`[${scope}] ${msg}`, err);
  }
});
