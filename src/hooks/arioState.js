// Persistence for Ario FM state across route changes
let saved = null;

export const arioState = {
  save(state) {
    saved = { ...state, ts: Date.now() };
  },
  load() {
    if (saved && Date.now() - saved.ts < 30 * 60 * 1000) {
      return saved;
    }
    return null;
  },
  clear() {
    saved = null;
  },
};
