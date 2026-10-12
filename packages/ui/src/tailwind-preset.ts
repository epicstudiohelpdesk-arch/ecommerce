import { colors } from './tokens/colors';
import { radii, elevation, breakpoints } from './tokens/spacing';

export const artisanTailwindPreset = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        stone: colors.stone,
        craft: {
          terracotta: colors.brand.terracotta[500],
          amber: colors.brand.amber[600],
          emerald: colors.brand.emerald[600],
        },
      },
      borderRadius: radii,
      boxShadow: {
        craft: elevation.craft,
        focus: elevation.focus,
      },
      screens: breakpoints,
    },
  },
};

export default artisanTailwindPreset;
