import type { FestivalTheme } from '$lib/types';

export interface PresetTheme {
  id: 'night-rave' | 'day-festival' | 'synthwave' | 'minimal';
  name: string;
  description: string;
  dataTheme: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    base: string;
  };
}

const PRESETS: PresetTheme[] = [
  {
    id: 'night-rave',
    name: 'Night Rave',
    description: 'Dark with neon accents',
    dataTheme: 'nightrave',
    colors: {
      primary: '#b14aed',
      secondary: '#ff2d78',
      accent: '#00d4ff',
      base: '#0d0d1a'
    }
  },
  {
    id: 'day-festival',
    name: 'Day Festival',
    description: 'Light and warm',
    dataTheme: 'dayfestival',
    colors: {
      primary: '#f59e0b',
      secondary: '#ef4444',
      accent: '#10b981',
      base: '#fffbf0'
    }
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Purple, pink and cyan',
    dataTheme: 'synthwave',
    colors: {
      primary: '#e779c1',
      secondary: '#58c7f3',
      accent: '#f3cc30',
      base: '#2d1b69'
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean monochrome',
    dataTheme: 'minimal',
    colors: {
      primary: '#111111',
      secondary: '#555555',
      accent: '#0066cc',
      base: '#ffffff'
    }
  }
];

export function getPresetThemes(): PresetTheme[] {
  return PRESETS;
}

/**
 * Generates daisyUI 5 compatible CSS custom property declarations
 * from a FestivalTheme's color values.
 */
export function generateDaisyTheme(theme: FestivalTheme): Record<string, string> {
  const preset = theme.preset ? PRESETS.find((p) => p.id === theme.preset) : undefined;
  const colors = preset ? preset.colors : theme;

  const primary = colors.primary ?? '#b14aed';
  const secondary = colors.secondary ?? '#ff2d78';
  const accent = colors.accent ?? '#00d4ff';
  const base = colors.base ?? '#0d0d1a';

  return {
    '--color-primary': primary,
    '--color-secondary': secondary,
    '--color-accent': accent,
    '--color-base-100': base
  };
}

/**
 * Applies a festival's theme to the <html> element.
 * If preset is set, switches data-theme attribute.
 * If custom colors, applies CSS vars directly.
 */
export function applyFestivalTheme(theme: FestivalTheme | undefined): void {
  const html = document.documentElement;

  if (!theme) {
    html.setAttribute('data-theme', 'nightrave');
    html.style.removeProperty('--color-primary');
    html.style.removeProperty('--color-secondary');
    html.style.removeProperty('--color-accent');
    html.style.removeProperty('--color-base-100');
    return;
  }

  if (theme.preset) {
    const preset = PRESETS.find((p) => p.id === theme.preset);
    if (preset) {
      html.setAttribute('data-theme', preset.dataTheme);
      // Clear any custom inline vars so preset theme takes over
      html.style.removeProperty('--color-primary');
      html.style.removeProperty('--color-secondary');
      html.style.removeProperty('--color-accent');
      html.style.removeProperty('--color-base-100');
      return;
    }
  }

  // Custom colors: use default theme and override vars
  html.setAttribute('data-theme', 'nightrave');
  const vars = generateDaisyTheme(theme);
  for (const [prop, value] of Object.entries(vars)) {
    html.style.setProperty(prop, value);
  }
}
