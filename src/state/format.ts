export const fmtS = (ms: number) => (ms / 1000).toFixed(1) + 's';
export const fmtMin = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? s + 's' : `${Math.floor(s / 60)}m ${s % 60}s`;
};
export const fmtClock = (ms: number) => {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};
