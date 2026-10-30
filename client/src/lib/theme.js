export const THEME_OPTIONS = [
  { id: 'light', label: 'Claro', swatch: 'bg-gray-100 border border-gray-300' },
  { id: 'dark', label: 'Escuro', swatch: 'bg-gray-900' },
  { id: 'blue', label: 'Azul corporativo', swatch: 'bg-blue-700' },
  { id: 'green', label: 'Verde tecnologia', swatch: 'bg-emerald-600' },
  { id: 'purple', label: 'Roxo moderno', swatch: 'bg-violet-600' },
];

export function applyTheme(theme) {
  const root = document.documentElement;
  if (!theme || theme === 'light') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function applyPrimaryColor(color) {
  if (!color) return;
  document.documentElement.style.setProperty('--brand-600', color);
}

export function applyAppearance({ theme, primary_color } = {}) {
  if (theme) {
    applyTheme(theme);
  }
  if (primary_color) applyPrimaryColor(primary_color);
}

export function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('itsa_user') || 'null');
  } catch (err) {
    return null;
  }
}
