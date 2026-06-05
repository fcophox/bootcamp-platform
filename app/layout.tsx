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
  title: "Synaptia",
  description: "Plataforma de gestión del conocimiento",
  icons: {
    icon: "/brand/favicon.png",
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
