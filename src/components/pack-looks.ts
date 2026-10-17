import type { PackTheme } from '../types/domain';

export interface ThemeLook {
  label: string;
  /** Crimped foil bands (top and bottom). */
  band: string;
  /** Main art background. */
  art: string;
  /** Title banner and details. */
  accent: string;
  /** Repeated background motif. */
  motif: string;
}

/** Pack designs selectable per channel (Configuración del canal). */
export const PACK_LOOKS: Record<PackTheme, ThemeLook> = {
  clasico: {
    label: 'Clásico',
    band: 'linear-gradient(90deg, #15805a, #3fd19a 40%, #1a9c6e 60%, #7ff0c4)',
    art: 'linear-gradient(170deg, #b8f3ff 0%, #58c7a0 45%, #1f6f53 100%)',
    accent: '#0f5a40',
    motif: '✦',
  },
  atardecer: {
    label: 'Atardecer',
    band: 'linear-gradient(90deg, #c2410c, #fb923c 40%, #db2777 60%, #fdba74)',
    art: 'linear-gradient(170deg, #fde68a 0%, #fb7185 50%, #7c2d55 100%)',
    accent: '#7c1d45',
    motif: '☀',
  },
  oceano: {
    label: 'Océano',
    band: 'linear-gradient(90deg, #1d4ed8, #60a5fa 40%, #0e7490 60%, #a5f3fc)',
    art: 'linear-gradient(170deg, #cffafe 0%, #38bdf8 45%, #1e3a8a 100%)',
    accent: '#132d6b',
    motif: '〰',
  },
  bosque: {
    label: 'Bosque',
    band: 'linear-gradient(90deg, #365314, #84cc16 40%, #3f6212 60%, #bef264)',
    art: 'linear-gradient(170deg, #ecfccb 0%, #65a30d 45%, #1a2e05 100%)',
    accent: '#24360b',
    motif: '❦',
  },
  vintage: {
    label: 'Vintage',
    band: 'linear-gradient(90deg, #78350f, #d6a35c 40%, #92400e 60%, #f3d9a4)',
    art: 'linear-gradient(170deg, #fdf4e3 0%, #d6a35c 50%, #4a2c12 100%)',
    accent: '#4a2c12',
    motif: '✧',
  },
  galaxia: {
    label: 'Galaxia',
    band: 'linear-gradient(90deg, #4c1d95, #a78bfa 40%, #1e1b4b 60%, #f0abfc)',
    art: 'linear-gradient(170deg, #c4b5fd 0%, #6d28d9 45%, #0b0a26 100%)',
    accent: '#2e1065',
    motif: '✶',
  },
};
