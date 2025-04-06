export const SECOND = 1000;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;

const _appendLeadingZero = (n: number) => (n < 10 ? `0${n}` : n);

export const msToTimestamp = (ms: number) => {
  const h = Math.floor(ms / 60000 / 60);
  const m = Math.floor((ms / 60000) % 60);
  const s = Number(Math.floor((ms % 60000) / 1000).toFixed(0));
  const t = [m, s];
  if (h) t.unshift(h);
  return t.map(_appendLeadingZero).join(":");
};
