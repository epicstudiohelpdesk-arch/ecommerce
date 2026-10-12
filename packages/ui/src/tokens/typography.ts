/**
 * Master UI/UX Design System - Typography Tokens
 * Handcrafted Multi-Vendor Marketplace
 *
 * Strict typographic scale ensuring readable, balanced editorial hierarchy
 * from micro labels (10px) to hero display typography (36-48px).
 */

export const typography = {
  fontFamilies: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },

  fontSizes: {
    micro: {
      fontSize: '0.625rem', // 10px
      lineHeight: '0.875rem', // 14px
      letterSpacing: '0.05em',
    },
    xs: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1rem', // 16px
      letterSpacing: '0.025em',
    },
    sm: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.25rem', // 20px
      letterSpacing: '0em',
    },
    base: {
      fontSize: '1rem', // 16px
      lineHeight: '1.5rem', // 24px
      letterSpacing: '0em',
    },
    lg: {
      fontSize: '1.125rem', // 18px
      lineHeight: '1.75rem', // 28px
      letterSpacing: '-0.01em',
    },
    xl: {
      fontSize: '1.25rem', // 20px
      lineHeight: '1.75rem', // 28px
      letterSpacing: '-0.015em',
    },
    '2xl': {
      fontSize: '1.5rem', // 24px
      lineHeight: '2rem', // 32px
      letterSpacing: '-0.02em',
    },
    '3xl': {
      fontSize: '1.875rem', // 30px
      lineHeight: '2.25rem', // 36px
      letterSpacing: '-0.025em',
    },
    '4xl': {
      fontSize: '2.25rem', // 36px
      lineHeight: '2.5rem', // 40px
      letterSpacing: '-0.03em',
    },
    '5xl': {
      fontSize: '3rem', // 48px
      lineHeight: '1.15',
      letterSpacing: '-0.035em',
    },
  },

  fontWeights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

export type TypographyTokens = typeof typography;
