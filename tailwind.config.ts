import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fff8ef',
        clay: '#b8694f',
        sage: '#617d62',
        ink: '#20201f'
      },
      boxShadow: {
        soft: '0 20px 60px rgba(32, 32, 31, 0.10)'
      }
    }
  },
  plugins: []
};

export default config;
