import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manual de Usuario & Centro de Ayuda — CodexFlow',
  description:
    'Manual interactivo, centro de ayuda y guía operativa diocesana para la digitalización, transcripción ergonómica e indexación de archivos históricos en CodexFlow.',
};

export default function ManualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
