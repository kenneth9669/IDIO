import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'IDIO • Digital Camera Rental Management System | Butuan City',
  description: 'Specialized Digital Camera Rental Management System for creators, studios, and photographers in Butuan City, Agusan del Norte.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-zinc-50/50 text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">
          <AuthProvider>
            {children}
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

