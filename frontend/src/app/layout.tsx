import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CodexFlow — Plataforma Inteligente de Digitalización e Indexación de Archivos Históricos',
  description:
    'Preservación patrimonial y transcripción asistida por Inteligencia Artificial para diócesis, archivos notariales y registros civiles con ergonomía extrema y seguridad RLS.',
  keywords: [
    'CodexFlow',
    'Archivos Históricos',
    'Transcripción Paleográfica',
    'Libros Parroquiales',
    'Bautismos',
    'Indexación',
    'Active Learning',
    'Visor Dual',
  ],
  authors: [{ name: 'CodexFlow Team' }],
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://codexflow.app',
    title: 'CodexFlow — Digitalización e Indexación de Archivos Históricos',
    description:
      'Acelera la catalogación y transcripción de fondos históricos con visor dual ergonómico e IA asistida con Active Learning.',
    siteName: 'CodexFlow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodexFlow — Digitalización de Archivos Históricos',
    description:
      'Plataforma SaaS para la indexación y preservación de documentos históricos y parroquiales.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="bg-gray-50 text-gray-900 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
