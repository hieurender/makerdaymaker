export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const between = (min, max) => min + Math.random() * (max - min);

export function hasTenure(employee, years) {
  if (!employee.startDate) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return new Date(employee.startDate) <= cutoff;
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
