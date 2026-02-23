// web/js/theme.js
const KEY = "ui_theme";

export function applySavedTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === "dark") document.documentElement.classList.add("dark");
}

export function setTheme(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem(KEY, isDark ? "dark" : "light");
}

export function isDark() {
  return document.documentElement.classList.contains("dark");
}
