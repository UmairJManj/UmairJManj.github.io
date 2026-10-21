/* Flashcard content and player settings. */

export function loadSettings() {
  try { return { sound: true, ...JSON.parse(localStorage.getItem("hoops3d:settings") || "{}") }; }
  catch { return { sound: true }; }
}
export function saveSettings(s) {
  try { localStorage.setItem("hoops3d:settings", JSON.stringify(s)); } catch { /* ignore */ }
}

const cache = {};
export async function loadContent(id) {
  if (cache[id]) return cache[id];
  const res = await fetch(`/hoops/content/${id}.json`);
  if (!res.ok) throw new Error(`content ${id}: ${res.status}`);
  const c = await res.json();
  cache[id] = c;
  return c;
}
