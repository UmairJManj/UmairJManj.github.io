/* Player settings. */

export function loadSettings() {
  try { return { sound: true, ...JSON.parse(localStorage.getItem("hoops3d:settings") || "{}") }; }
  catch { return { sound: true }; }
}
export function saveSettings(s) {
  try { localStorage.setItem("hoops3d:settings", JSON.stringify(s)); } catch { /* ignore */ }
}
