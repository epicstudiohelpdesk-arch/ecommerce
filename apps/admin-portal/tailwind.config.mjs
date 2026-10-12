/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          terracotta: {
            50: '#FDF6F4',
            100: '#FAECE8',
            200: '#F4D6CE',
            300: '#EAB6A7',
            400: '#DC8E78',
            500: '#C25E3E',
            600: '#AB4E31',
            700: '#8E3F27',
            800: '#733423',
            900: '#5E2D20',
          },
          amber: {
            50: '#FFFBEB',
            100: '#FEF3C7',
            200: '#FDE68A',
            300: '#FCD34D',
            400: '#FBBF24',
            500: '#F59E0B',
            600: '#D97706',
            700: '#B45309',
            800: '#92400E',
            900: '#78350F',
          },
          emerald: {
            50: '#ECFDF5',
            100: '#D1FAE5',
            200: '#A7F3D0',
            500: '#10B981',
            600: '#059669',
            700: '#047857',
            800: '#065F46',
          },
        },
        craft: {
          terracotta: '#C25E3E',
          amber: '#D97706',
          emerald: '#059669',
        },
      },
      boxShadow: {
        craft: '0 12px 24px -4px rgba(194, 94, 62, 0.08), 0 4px 8px -2px rgba(28, 25, 23, 0.04)',
        focus: '0 0 0 3px rgba(217, 119, 6, 0.35)',
      },
    },
  },
  plugins: [],
};
