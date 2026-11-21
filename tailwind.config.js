/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        raised: token('raised'),
        overlay: token('overlay'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        'ink-3': token('ink-3'),
        accent: token('accent'),
        'accent-strong': token('accent-strong'),
        'accent-ink': token('accent-ink'),
        ok: token('ok'),
        bad: token('bad'),
        warn: token('warn'),
        fire: token('fire'),
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', '"Cascadia Code"', 'monospace'],
      },
      fontSize: {
        question: ['1.1875rem', { lineHeight: '1.65', fontWeight: '600' }],
        'question-lg': ['1.3125rem', { lineHeight: '1.6', fontWeight: '600' }],
      },
      borderRadius: { card: '14px', control: '10px' },
      boxShadow: {
        raised: '0 1px 0 rgb(255 255 255 / .03) inset, 0 8px 24px -12px rgb(0 0 0 / .6)',
        pop: '0 24px 60px -20px rgb(0 0 0 / .75)',
      },
      transitionTimingFunction: { out: 'cubic-bezier(.16, 1, .3, 1)' },
    },
  },
  plugins: [],
}
