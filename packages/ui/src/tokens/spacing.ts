/**
 * Master UI/UX Design System - Spacing, Radii, Elevation & Motion Tokens
 * Handcrafted Multi-Vendor Marketplace
 *
 * 4px baseline grid, accessible focus rings, and tactile elevation.
 */

export const spacing = {
  // 4px baseline scale
  px: '1px',
  0: '0px',
  0.5: '0.125rem', // 2px
  1: '0.25rem', // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem', // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem', // 12px
  3.5: '0.875rem', // 14px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  7: '1.75rem', // 28px
  8: '2rem', // 32px
  9: '2.25rem', // 36px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  14: '3.5rem', // 56px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
} as const;

export const radii = {
  none: '0px',
  sm: '0.25rem', // 4px (badges, small tags)
  md: '0.375rem', // 6px (buttons, inputs)
  lg: '0.5rem', // 8px (cards, dialogs)
  xl: '0.75rem', // 12px (feature surfaces, modals)
  '2xl': '1rem', // 16px (editorial showcase cards)
  full: '9999px', // pills, circular avatars
} as const;

export const elevation = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
  // Warm artisan shadow with clay ambient undertone
  craft: '0 12px 24px -4px rgba(194, 94, 62, 0.08), 0 4px 8px -2px rgba(28, 25, 23, 0.04)',
  focus: '0 0 0 3px rgba(217, 119, 6, 0.35)',
} as const;

export const breakpoints = {
  sm: '640px', // Mobile landscape / small tablets
  md: '768px', // Portrait tablets / narrow screens
  lg: '1024px', // Landscape tablets / laptops
  xl: '1280px', // Standard desktop / wide screens
  '2xl': '1536px', // Large monitor displays
} as const;

export const motion = {
  transitionProperty:
    'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform',
  timing: {
    instant: '75ms cubic-bezier(0, 0, 0.2, 1)',
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;
