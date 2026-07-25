import type { Metadata } from "next";
import { Sansation } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeHotkey } from "@/components/theme-hotkey";
import { OnlineUsersProvider } from "@/contexts/OnlineUsersContext";
import { PresenceTracker } from "@/components/presence-tracker";
import { EnvBanner } from "@/components/env-banner";
import { ClarityAnalytics } from "@/components/clarity-analytics";
import { VersionTag } from "@/components/version-tag";
import { isProdEnv } from "@/utils/env";

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
  // Dev builds must never get indexed — bootcamp-dev.nodrize.dev is publicly
  // reachable but isn't the real site.
  robots: isProdEnv()
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      }
    : {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
};

import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="es" suppressHydrationWarning>
        <body
          className={`${sansation.variable} ${sansation.className} antialiased ${isProdEnv() ? "" : "pt-6"}`}
        >
          <EnvBanner />
          <ClarityAnalytics />
          <VersionTag />
          <ConvexClientProvider>
            <ThemeProvider
              attribute="data-theme"
              defaultTheme="dark"
              enableSystem={false}
              disableTransitionOnChange
            >
              <ThemeHotkey />
              <PresenceTracker />
              <OnlineUsersProvider>
                {children}
              </OnlineUsersProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
