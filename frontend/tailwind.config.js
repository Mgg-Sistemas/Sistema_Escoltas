/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta oficial Golden Touch · carbón neutro descansado a la vista
        gt: {
          bg0: '#1c1f24',
          bg1: '#20242a',
          bg2: '#262a31',
          bg3: '#2d323a',
          surface: '#23272e',
          surface2: '#2b3038',
          surface3: '#353b45',
          border: '#333944',
          borderStrong: '#434a56',
        },
        // Paleta corporativa ESCOLTAS: naranja, dorado, gris metálico y negro.
        brand: {
          50: '#fff4e6',
          100: '#ffe4cc',
          200: '#ffc999',
          300: '#ffad66',
          400: '#ff8c00', // Naranja brillante
          500: '#ff6600', // Naranja intenso
          600: '#e25900',
          700: '#cc4400', // Naranja oscuro
          800: '#993300',
          900: '#662200',
          950: '#331100',
        },
        gold: {
          50: '#fffae6',
          100: '#fff5cc',
          200: '#ffeea6',
          300: '#ffeb80', // Amarillo luminoso
          400: '#ffd700', // Amarillo dorado
          500: '#ffb800', // Dorado
          600: '#cc9300',
          700: '#997000',
          800: '#664a00',
          900: '#332500',
        },
        chrome: {
          50: '#ffffff', // Blanco puro
          100: '#f2f2f2', // Blanco metálico
          200: '#d9d9d9', // Gris plata
          300: '#c0c0c0', // Gris cromado
          400: '#a6a6a6', // Gris metálico
          500: '#808080', // Gris medio
          600: '#666666',
          700: '#404040', // Gris oscuro
          800: '#25282b', // Gris grafito
          900: '#141414', // Negro carbón
          950: '#050505', // Negro profundo
          1000: '#000000', // Negro absoluto
        },
        // Se sustituye el gris azulado por la escala neutral de la paleta.
        slate: {
          50: '#fafafa',
          100: '#f2f2f2',
          200: '#d9d9d9',
          300: '#c0c0c0',
          400: '#808080',
          500: '#666666',
          600: '#404040',
          700: '#333333',
          800: '#25282b',
          900: '#141414',
          950: '#050505',
        },
        ink: {
          950: '#050505',
          900: '#141414',
          800: '#25282b',
          700: '#404040',
        },
        emblem: {
          gray: '#a6a6a6',
        },
      },
      backgroundImage: {
        'metal-claro': 'linear-gradient(180deg, #ffffff 0%, #f2f2f2 55%, #d9d9d9 100%)',
        'metal-oscuro': 'linear-gradient(145deg, #25282b 0%, #141414 52%, #050505 100%)',
        'naranja-cromado': 'linear-gradient(180deg, #ff8c00 0%, #ff6600 55%, #cc4400 100%)',
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
        card: '0 1px 3px rgba(20, 20, 20, 0.12), 0 1px 2px rgba(5, 5, 5, 0.06)',
        panel: '0 20px 45px rgba(5, 5, 5, 0.28)',
        cromado: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 8px rgba(20, 20, 20, 0.25)',
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
