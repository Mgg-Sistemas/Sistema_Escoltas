/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta tomada del emblema: naranja institucional, negro y blanco.
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#ffd6ad',
          300: '#ffb36b',
          400: '#ff9138',
          500: '#ff7000',
          600: '#f25c00',
          700: '#c94a00',
          800: '#9a3a00',
          900: '#662700',
          950: '#351400',
        },
        ink: {
          950: '#0b0b0b',
          900: '#141414',
          800: '#232323',
        },
        // Gris claro tomado del emblema, legible sobre el panel negro.
        emblem: {
          gray: '#a8a8b0',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgba(102, 39, 0, 0.10), 0 1px 2px rgba(11, 11, 11, 0.05)',
        panel: '0 20px 45px rgba(11, 11, 11, 0.20)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
