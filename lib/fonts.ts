import localFont from 'next/font/local';

export const cairo = localFont({
  src: '../public/fonts/Cairo-VariableFont_slnt,wght.ttf',
  variable: '--font-cairo',
  display: 'swap',
  preload: true,
});
