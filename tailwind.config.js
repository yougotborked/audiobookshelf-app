/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['components/**/*.vue', 'layouts/**/*.vue', 'pages/**/*.vue', 'mixins/**/*.js', 'plugins/**/*.js'],
  theme: {
    screens: {
      short: { raw: '(max-height: 500px)' }
    },
    extend: {
      /* ── Backward-compat semantic colours (components use these class names) ── */
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        'bg-hover': 'rgb(var(--color-bg-hover) / <alpha-value>)',
        fg: 'rgb(var(--color-fg) / <alpha-value>)',
        'fg-muted': 'rgb(var(--color-fg-muted) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'bg-toggle': 'rgb(var(--color-bg-toggle) / <alpha-value>)',
        'bg-toggle-selected': 'rgb(var(--color-bg-toggle-selected) / <alpha-value>)',
        'track-cursor': 'rgb(var(--color-track-cursor) / <alpha-value>)',
        track: 'rgb(var(--color-track) / <alpha-value>)',
        'track-buffered': 'rgb(var(--color-track-buffered) / <alpha-value>)',
        accent: '#1ad691',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        successDark: '#3b8a3e',
        warning: '#FB8C00',
        /* ── M3 surface levels (direct use in Phase 2+ components) ── */
        'md-surface-0': 'rgb(var(--md-surface-0) / <alpha-value>)',
        'md-surface-1': 'rgb(var(--md-surface-1) / <alpha-value>)',
        'md-surface-2': 'rgb(var(--md-surface-2) / <alpha-value>)',
        'md-surface-3': 'rgb(var(--md-surface-3) / <alpha-value>)',
        'md-surface-4': 'rgb(var(--md-surface-4) / <alpha-value>)',
        'md-surface-5': 'rgb(var(--md-surface-5) / <alpha-value>)',
        'md-primary': 'rgb(var(--md-primary) / <alpha-value>)',
        'md-on-primary': 'rgb(var(--md-on-primary) / <alpha-value>)',
        'md-primary-container': 'rgb(var(--md-primary-container) / <alpha-value>)',
        'md-on-primary-container': 'rgb(var(--md-on-primary-container) / <alpha-value>)',
        'md-on-surface': 'rgb(var(--md-on-surface) / <alpha-value>)',
        'md-on-surface-variant': 'rgb(var(--md-on-surface-variant) / <alpha-value>)',
        'md-outline': 'rgb(var(--md-outline) / <alpha-value>)',
        'md-outline-variant': 'rgb(var(--md-outline-variant) / <alpha-value>)',
        'md-error': 'rgb(var(--md-error) / <alpha-value>)',
        'md-error-container': 'rgb(var(--md-error-container) / <alpha-value>)',
        'dynamic-primary': 'rgb(var(--dynamic-primary) / <alpha-value>)',
        'dynamic-surface': 'rgb(var(--dynamic-surface) / <alpha-value>)',
      },
      cursor: {
        none: 'none'
      },
      /* ── M3 Type Scale ── */
      fontSize: {
        '1.5xl':        ['1.375rem', {}],
        xxs:            ['0.625rem', {}],
        'md-display-l': ['3.5625rem',  { lineHeight: '4rem',    letterSpacing: '-0.015625rem', fontWeight: '400' }],
        'md-display-m': ['2.8125rem',  { lineHeight: '3.25rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-display-s': ['2.25rem',    { lineHeight: '2.75rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-headline-l':['2rem',       { lineHeight: '2.5rem',  letterSpacing: '0',            fontWeight: '400' }],
        'md-headline-m':['1.75rem',    { lineHeight: '2.25rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-headline-s':['1.5rem',     { lineHeight: '2rem',    letterSpacing: '0',            fontWeight: '400' }],
        'md-title-l':   ['1.375rem',   { lineHeight: '1.75rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-title-m':   ['1rem',       { lineHeight: '1.5rem',  letterSpacing: '0.009375rem',  fontWeight: '500' }],
        'md-title-s':   ['0.875rem',   { lineHeight: '1.25rem', letterSpacing: '0.00625rem',   fontWeight: '500' }],
        'md-body-l':    ['1rem',       { lineHeight: '1.5rem',  letterSpacing: '0.03125rem',   fontWeight: '400' }],
        'md-body-m':    ['0.875rem',   { lineHeight: '1.25rem', letterSpacing: '0.015625rem',  fontWeight: '400' }],
        'md-body-s':    ['0.75rem',    { lineHeight: '1rem',    letterSpacing: '0.025rem',     fontWeight: '400' }],
        'md-label-l':   ['0.875rem',   { lineHeight: '1.25rem', letterSpacing: '0.00625rem',   fontWeight: '500' }],
        'md-label-m':   ['0.75rem',    { lineHeight: '1rem',    letterSpacing: '0.03125rem',   fontWeight: '500' }],
        'md-label-s':   ['0.6875rem',  { lineHeight: '1rem',    letterSpacing: '0.03125rem',   fontWeight: '500' }],
      },
      /* ── M3 Shape (border-radius utilities) ── */
      borderRadius: {
        'md-xs':   'var(--md-shape-xs)',
        'md-sm':   'var(--md-shape-sm)',
        'md-md':   'var(--md-shape-md)',
        'md-lg':   'var(--md-shape-lg)',
        'md-xl':   'var(--md-shape-xl)',
        'md-2xl':  '36px',
        'md-full': 'var(--md-shape-full)',
      },
      fontFamily: {
        sans: ['Source Sans Pro', 'sans-serif'],
        mono: ['Ubuntu Mono', 'monospace'],
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
      },
      minWidth: {
        '1': '0.25rem',
        '2': '0.5rem',
        '2.5': '0.625rem',
        '3': '0.75rem',
        '4': '1rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
      },
      minHeight: { '12': '3rem' },
      maxWidth: { '24': '6rem' },
      height: { '18': '4.5rem' },
    }
  },
  plugins: []
}
