import type { Metadata } from "next";
import { Sansation } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeHotkey } from "@/components/theme-hotkey";

const sansation = Sansation({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-sansation",
});

export const metadata: Metadata = {
  metadataBase: process.env.VERCEL_URL 
    ? new URL(`https://${process.env.VERCEL_URL}`) 
    : new URL('http://localhost:3000'),
  title: {
    default: "Synaptia - Plataforma de Gestión del Conocimiento",
    template: "%s | Synaptia"
  },
  description: "Plataforma premium de gestión del conocimiento, bootcamps y educación corporativa interactiva.",
  keywords: ["Synaptia", "Bootcamp", "Plataforma de educación", "Gestión del conocimiento", "E-learning", "LMS"],
  authors: [{ name: "Synaptia Team" }],
  creator: "Synaptia",
  icons: {
    icon: "/brand/favicon.png",
    shortcut: "/brand/favicon.png",
    apple: "/brand/favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://synaptia.academy",
    title: "Synaptia - Plataforma de Gestión del Conocimiento",
    description: "Optimiza el aprendizaje de tu equipo con bootcamps estructurados, evaluaciones avanzadas y certificados integrados.",
    siteName: "Synaptia",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Synaptia - Plataforma de Gestión del Conocimiento",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Synaptia - Plataforma de Gestión del Conocimiento",
    description: "Optimiza el aprendizaje de tu equipo con bootcamps estructurados, evaluaciones avanzadas y certificados integrados.",
    images: ["/og-image.png"],
  },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${sansation.variable} ${sansation.className} antialiased`}
      >
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ThemeHotkey />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
