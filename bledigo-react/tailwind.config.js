/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        dm:   ['DM Sans', 'sans-serif'],
      },
      colors: {
        primary:  { DEFAULT:'#1A3C6B', light:'#2B5FA8', dark:'#122D52' },
        accent:   { DEFAULT:'#E8873A', light:'#FFF0E4', dark:'#C46A22' },
        success:  { DEFAULT:'#1D8C5E', light:'#E1F5EE' },
        warning:  { DEFAULT:'#B8760D', light:'#FEF3DB' },
        danger:   { DEFAULT:'#E24B4A', light:'#FDECEA' },
        surface:  { DEFAULT:'#FFFFFF', 2:'#F8F9FC' },
        muted:    '#F2F5FB',
        border:   { DEFAULT:'#EEF1F8', 2:'#DDE3EE' },
        t1: '#0D1B33',
        t2: '#4A5672',
        t3: '#8C96AE',
      },
      boxShadow: {
        card:          '0 2px 12px rgba(26,60,107,0.08)',
        modal:         '0 20px 60px rgba(13,27,51,0.2)',
        'btn-primary': '0 4px 14px rgba(26,60,107,0.25)',
        'btn-accent':  '0 4px 14px rgba(232,135,58,0.30)',
      },
      borderRadius: {
        card: '14px',
        btn:  '9px',
      },
      keyframes: {
        fadeUp: {
          from: { opacity:'0', transform:'translateY(8px)' },
          to:   { opacity:'1', transform:'translateY(0)' },
        },
        slideIn: {
          from: { opacity:'0', transform:'translateX(28px)' },
          to:   { opacity:'1', transform:'translateX(0)' },
        },
        popIn: {
          '0%':   { transform:'scale(0.5)', opacity:'0' },
          '70%':  { transform:'scale(1.08)' },
          '100%': { transform:'scale(1)',   opacity:'1' },
        },
        float: {
          '0%,100%': { transform:'translateY(0)' },
          '50%':     { transform:'translateY(-10px)' },
        },
        shimmer: {
          from: { backgroundPosition:'-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
        grow: {
          from: { width:'0%' },
          to:   { width:'100%' },
        },
      },
      animation: {
        'fade-up':  'fadeUp 0.28s ease both',
        'slide-in': 'slideIn 0.32s cubic-bezier(0.4,0,0.2,1) both',
        'pop-in':   'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        float:      'float 3s ease-in-out infinite',
        shimmer:    'shimmer 1.4s ease infinite',
        grow:       'grow 1.8s linear forwards',
      },
    },
  },
  plugins: [],
}
