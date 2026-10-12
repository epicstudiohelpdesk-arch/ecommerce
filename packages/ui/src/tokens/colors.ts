/**
 * Master UI/UX Design System - Color Tokens
 * Handcrafted Multi-Vendor Marketplace
 *
 * Semantic color palette capturing contemporary Indian craftsmanship:
 * - Terracotta / Clay: Primary artisan warmth
 * - Warm Amber / Ochre: Secondary accent & commerce action
 * - Forest Emerald: Verified artisan credential & success
 * - Stone Neutrals: Balanced, readable warm-slate canvas
 */

export const colors = {
  // Brand Terracotta (Warm clay, ceramics, pottery heritage)
  brand: {
    terracotta: {
      50: '#FDF6F4',
      100: '#FAECE8',
      200: '#F4D6CE',
      300: '#EAB6A7',
      400: '#DC8E78',
      500: '#C25E3E', // Primary artisan brand
      600: '#AB4E31',
      700: '#8E3F27',
      800: '#733423',
      900: '#5E2D20',
      950: '#3D1B12',
    },
    // Warm Amber (Mustard seed, brass, marigold, sunny woodcraft)
    amber: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706', // Primary commerce / CTA
      700: '#B45309',
      800: '#92400E',
      900: '#78350F',
      950: '#451A03',
    },
    // Forest Emerald (Organic dyes, green glass, verified badge)
    emerald: {
      50: '#ECFDF5',
      100: '#D1FAE5',
      200: '#A7F3D0',
      300: '#6EE7B7',
      400: '#34D399',
      500: '#10B981',
      600: '#059669', // Verified artisan credential
      700: '#047857',
      800: '#065F46',
      900: '#064E3B',
      950: '#022C22',
    },
  },

  // Neutral Stone Palette (Warm, non-sterile slate/sandstone)
  stone: {
    50: '#FAFAF9',
    100: '#F5F5F4',
    200: '#E7E5E4',
    300: '#D6D3D1',
    400: '#A8A29E',
    500: '#78716C',
    600: '#57534E',
    700: '#44403C',
    800: '#292524',
    900: '#1C1917',
    950: '#0C0A09',
  },

  // Semantic Feedback States
  semantic: {
    success: {
      fg: '#047857',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      solid: '#059669',
    },
    warning: {
      fg: '#B45309',
      bg: '#FFFBEB',
      border: '#FDE68A',
      solid: '#D97706',
    },
    error: {
      fg: '#BE123C',
      bg: '#FFF1F2',
      border: '#FECDD3',
      solid: '#E11D48',
    },
    info: {
      fg: '#3730A3',
      bg: '#EEF2FF',
      border: '#C7D2FE',
      solid: '#4F46E5',
    },
  },
} as const;

export type ColorTokens = typeof colors;
