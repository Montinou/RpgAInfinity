import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RpgAInfinity',
  description:
    'Motor generativo infinito de juegos de rol y deducción social con IA',
  keywords: ['rpg', 'ai', 'game', 'nextjs', 'vercel', 'claude', 'anthropic'],
  authors: [{ name: 'Montinou' }],
  creator: 'Montinou',
  publisher: 'Montinou',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='es' className='h-full'>
      <body className={`${inter.className} h-full antialiased`}>
        <div id='root' className='h-full'>
          {children}
        </div>
      </body>
    </html>
  );
}
