import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        line: '#e5e7eb',
        muted: '#6b7280',
        accent: '#111827',
        good: '#15803d',
        warn: '#b45309',
        bad: '#b91c1c',
      },
    },
  },
  plugins: [],
};

export default config;
