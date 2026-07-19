import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#eb5160',
        'accent-soft': '#fdeeef',
        ink: '#071013'
      },
      boxShadow: {
        soft: '0 20px 60px rgba(7, 16, 19, 0.12)'
      }
    }
  },
  plugins: []
};

export default config;
