export const fmt = (d) =>
  new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// Date -> value for <input type="datetime-local">
export const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export const fromLocalInput = (v) => new Date(v).toISOString();
