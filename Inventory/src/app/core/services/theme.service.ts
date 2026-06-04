import { Injectable, signal } from '@angular/core';

/**
 * Define un tema visual. Cada tema sobreescribe los tokens de marca
 * (primary y secondary) y sus tints/shades; los colores semánticos
 * (success/warning/danger) se mantienen estables porque comunican estado.
 */
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Color principal usado para CTAs y branding. */
  primary: string;
  primaryTint: string;
  primaryShade: string;
  primaryContrast: string;
  /** rgb sin paréntesis, ej. "63, 120, 114" */
  primaryRgb: string;
  /** Color del header del brand block en sidebar. Por defecto = primary. */
  brandBg?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'sage',
    name: 'Sage',
    description: 'Verde apagado, default editorial',
    primary: '#3F7872',
    primaryTint: '#5A9189',
    primaryShade: '#2F5E59',
    primaryContrast: '#FFFFFF',
    primaryRgb: '63, 120, 114',
  },
  {
    id: 'coral',
    name: 'Coral',
    description: 'Cálido, sugiere energía',
    primary: '#C26B5D',
    primaryTint: '#D08879',
    primaryShade: '#9E5346',
    primaryContrast: '#FFFFFF',
    primaryRgb: '194, 107, 93',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    description: 'Sobrio, profesional',
    primary: '#4F5B8C',
    primaryTint: '#6B77A4',
    primaryShade: '#3D4670',
    primaryContrast: '#FFFFFF',
    primaryRgb: '79, 91, 140',
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Monocromo, gris grafito',
    primary: '#4B5563',
    primaryTint: '#6B7280',
    primaryShade: '#374151',
    primaryContrast: '#FFFFFF',
    primaryRgb: '75, 85, 99',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Verde bosque profundo',
    primary: '#2D5F3F',
    primaryTint: '#447658',
    primaryShade: '#1E4A2E',
    primaryContrast: '#FFFFFF',
    primaryRgb: '45, 95, 63',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Azul marino tranquilo',
    primary: '#2E6E8E',
    primaryTint: '#4886A6',
    primaryShade: '#1F567A',
    primaryContrast: '#FFFFFF',
    primaryRgb: '46, 110, 142',
  },
  {
    id: 'plum',
    name: 'Plum',
    description: 'Vino apagado, elegante',
    primary: '#7A4A6E',
    primaryTint: '#9264A7',
    primaryShade: '#5F3856',
    primaryContrast: '#FFFFFF',
    primaryRgb: '122, 74, 110',
  },
  {
    id: 'mocha',
    name: 'Mocha',
    description: 'Café tostado, terroso',
    primary: '#6F4E37',
    primaryTint: '#8B6849',
    primaryShade: '#553A28',
    primaryContrast: '#FFFFFF',
    primaryRgb: '111, 78, 55',
  },
  {
    id: 'amber',
    name: 'Amber',
    description: 'Oro mostaza acogedor',
    primary: '#A8731B',
    primaryTint: '#C28A2F',
    primaryShade: '#8A5C12',
    primaryContrast: '#FFFFFF',
    primaryRgb: '168, 115, 27',
  },
  {
    id: 'crimson',
    name: 'Crimson',
    description: 'Rojo profundo, intenso',
    primary: '#8C2F39',
    primaryTint: '#A8454F',
    primaryShade: '#6E1F28',
    primaryContrast: '#FFFFFF',
    primaryRgb: '140, 47, 57',
  },
  {
    id: 'teal-vivid',
    name: 'Teal vivo',
    description: 'Teal saturado, contemporáneo',
    primary: '#0E7C7B',
    primaryTint: '#1A9594',
    primaryShade: '#066261',
    primaryContrast: '#FFFFFF',
    primaryRgb: '14, 124, 123',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Casi negro frío, mínimo',
    primary: '#1E293B',
    primaryTint: '#334155',
    primaryShade: '#0F172A',
    primaryContrast: '#FFFFFF',
    primaryRgb: '30, 41, 59',
  },
];

const STORAGE_KEY = 'atlas_theme_v1';
const DEFAULT_THEME_ID = 'sage';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly availableThemes = THEME_PRESETS;
  private readonly _currentId = signal<string>(this.readInitialId());
  readonly currentId = this._currentId.asReadonly();

  constructor() {
    this.applyTheme(this._currentId());
  }

  setTheme(id: string) {
    const preset = THEME_PRESETS.find(t => t.id === id);
    if (!preset) return;
    this._currentId.set(id);
    this.applyTheme(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }

  current(): ThemePreset {
    return THEME_PRESETS.find(t => t.id === this._currentId()) ?? THEME_PRESETS[0];
  }

  private readInitialId(): string {
    if (typeof window === 'undefined') return DEFAULT_THEME_ID;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEME_PRESETS.some(t => t.id === stored)) return stored;
    return DEFAULT_THEME_ID;
  }

  private applyTheme(id: string) {
    if (typeof document === 'undefined') return;
    const preset = THEME_PRESETS.find(t => t.id === id);
    if (!preset) return;
    const root = document.documentElement.style;
    root.setProperty('--ui-primary', preset.primary);
    root.setProperty('--ui-primary-tint', preset.primaryTint);
    root.setProperty('--ui-primary-shade', preset.primaryShade);
    root.setProperty('--ui-primary-contrast', preset.primaryContrast);
    root.setProperty('--ui-transit', preset.primary);
    root.setProperty('--ui-transit-tint', this.hexToTint(preset.primary));
    // Ionic palette sync
    root.setProperty('--ion-color-primary', preset.primary);
    root.setProperty('--ion-color-primary-rgb', preset.primaryRgb);
    root.setProperty('--ion-color-primary-contrast', preset.primaryContrast);
    root.setProperty('--ion-color-primary-shade', preset.primaryShade);
    root.setProperty('--ion-color-primary-tint', preset.primaryTint);
  }

  /** Genera una variante muy clara del color para usar como tint de fondo. */
  private hexToTint(hex: string): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    // mezclar 92% blanco + 8% color
    const mix = (c: number) => Math.round(c * 0.08 + 255 * 0.92);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }
}
