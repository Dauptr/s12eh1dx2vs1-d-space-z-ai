import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 's12eh1dx2vs1-d-space-z-ai',
  description: 'Cloned project from Mind Key',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
