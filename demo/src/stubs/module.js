// Stub for node:module in browser environment
// just-bash's browser bundle tries to dynamically import this, but we don't need it
export const createRequire = () => {
  throw new Error('node:module is not available in browser environment');
};
