/**
 * AI Wake Design System Tokens
 * Strict color palette, 8px spatial grid, radius scales, and elevations
 */

export const tokens = {
  colors: {
    // Canvas & Surfaces
    pageBackground: '#FFFFFF',
    tileBackground: '#F3F3F5',
    tileHover: '#EAEBED',
    surfaceSubtle: '#F9FAFB',
    borderLight: '#F0F1F3',
    borderMuted: '#E2E4E9',

    // Gradients
    headerGradientFrom: '#3F4080',
    headerGradientVia: '#353676',
    headerGradientTo: '#2E2F6B',

    heroGradientFrom: '#2A2B5C',
    heroGradientVia: '#35366D',
    heroGradientTo: '#4A4F7A',

    // Primary Accents
    plum: '#9C1C7C',
    plumHover: '#86176a',
    plumSubtle: 'rgba(156, 28, 124, 0.10)',
    plumBorder: 'rgba(156, 28, 124, 0.20)',

    // Raised Center & Primary Actions
    darkIndigo: '#3B3D78',
    darkIndigoHover: '#2E2F6B',
    darkIndigoShadow: 'rgba(59, 61, 120, 0.40)',

    // Typography
    textPrimary: '#1E1B4B',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textWhite: '#FFFFFF',
    textPurpleLight: '#E0E7FF',

    // Semantic & Category Accents
    teal: '#12A6A0',
    tealSubtle: 'rgba(18, 166, 160, 0.12)',
    orange: '#F57C1F',
    orangeSubtle: 'rgba(245, 124, 31, 0.12)',
    yellow: '#F5B800',
    yellowSubtle: 'rgba(245, 184, 0, 0.15)',
    magenta: '#B0207F',
    emerald: '#10B981',
    emeraldSubtle: 'rgba(16, 185, 129, 0.12)',
    rose: '#EF4444',
  },

  radius: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '20px',
    tile: '22px',
    card: '24px',
    hero: '28px',
    sheet: '32px',
    full: '9999px',
  },

  shadows: {
    subtle: '0 2px 8px rgba(30, 27, 75, 0.04)',
    card: '0 4px 20px rgba(30, 27, 75, 0.06)',
    hero: '0 16px 36px rgba(42, 43, 92, 0.28)',
    bottomBar: '0 -8px 30px rgba(30, 27, 75, 0.08)',
    sheet: '0 -12px 40px rgba(0, 0, 0, 0.18)',
    button: '0 8px 20px rgba(59, 61, 120, 0.35)',
    plum: '0 4px 14px rgba(156, 28, 124, 0.35)',
  },

  // 8px Spatial System
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },

  typography: {
    fontFamilySans: 'var(--font-sans)',
    fontFamilyMono: 'var(--font-mono)',
  },
} as const;
