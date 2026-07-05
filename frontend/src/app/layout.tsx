/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ibm-plex-sans' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ibm-plex-mono' });
import { ThemeProvider } from '@/components/ThemeProvider';
import RenderWakeupBanner from '@/components/RenderWakeupBanner';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'PanelFlow — Interview Panel Scheduling',
  description: 'Schedule interviews with multiple interviewers. Built on top of PanelFlow.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} font-body antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <RenderWakeupBanner />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
