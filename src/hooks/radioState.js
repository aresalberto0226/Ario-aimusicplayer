// Simple persistence for MyRadio state across route changes
let saved = null;

export const radioState = {
  save(state) {
    saved = { ...state, ts: Date.now() };
  },
  load() {
    // Keep state for up to 30 minutes
    if (saved && Date.now() - saved.ts < 30 * 60 * 1000) {
      return saved;
    }
    return null;
  },
  clear() {
    saved = null;
  },
};
