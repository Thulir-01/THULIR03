/**
 * Tailwind config for apps/web — maps design tokens and enables JIT content
 */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx,css}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-accent-700)",
        "primary-500": "var(--color-accent-500)",
        surface: "var(--color-surface-0)",
        border: "var(--color-line-200)",
        "text-muted": "var(--color-ink-600)",
        success: "var(--color-green-500)",
        warning: "var(--color-amber-500)",
        danger: "var(--color-red-500)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Source Sans 3', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        control: '8px',
        card: '12px',
        panel: '16px'
      }
    }
  },
  plugins: [],
}
