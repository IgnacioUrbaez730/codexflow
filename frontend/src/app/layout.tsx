import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CodexFlow',
  description: 'Sistema Inteligente de Indexación',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
