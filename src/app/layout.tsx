import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mind Key - Universal Access Engine",
  description: "A powerful browser preview tool that works with any URL, including localhost and internal network targets. Bypass CORS and access development servers seamlessly.",
  keywords: ["Mind Key", "proxy", "browser", "localhost", "development", "CORS", "preview", "web development"],
  authors: [{ name: "Mind Key Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Mind Key - Universal Access Engine",
    description: "Access any URL including localhost through a server-side proxy",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
