import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ESCUCHAR - ACOMPAÑAR - TRANSFORMAR | Un Espacio Seguro para Vos",
  description: "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos y necesidades.",
  // === OpenGraph (redes sociales: Facebook, WhatsApp, LinkedIn, etc.) ===
  openGraph: {
    title: "ESCUCHAR - ACOMPAÑAR - TRANSFORMAR | Un Espacio Seguro para Vos",
    description: "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos y necesidades.",
    type: "website",
    locale: "es_AR",
    siteName: "Red Escucha Psicológica",
    url: "https://www.redescuchapsicologica.com",
  },
  // === Twitter Card ===
  twitter: {
    card: "summary_large_image",
    title: "ESCUCHAR - ACOMPAÑAR - TRANSFORMAR | Un Espacio Seguro para Vos",
    description: "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos y necesidades.",
  },
  // === Keywords (ayuda a indexación, aunque Google dice que ya no las usa
  //     directamente, otros buscadores sí las consideran) ===
  keywords: [
    "terapia psicológica",
    "psicólogo Buenos Aires",
    "terapia individual",
    "terapia de pareja",
    "terapia familiar",
    "terapia grupal",
    "salud mental",
    "Red Escucha Psicológica",
  ],
  // === Metadata robots: indexar y seguir links ===
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // === Canonical URL ===
  alternates: {
    canonical: "https://www.redescuchapsicologica.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        {/* Google Tag (gtag.js) - AW-18195001096
            Reemplazo de la cuenta anterior AW-1017920443 (commit de hoy).
            Recordatorio: cuando agreguemos eventos de conversión en
            landing-page.tsx, hay que usar el nuevo ID y generar nuevos
            labels de conversión desde Google Ads → Herramientas →
            Conversiones. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18195001096"
          strategy="afterInteractive"
        />
        <Script id="google-gtag-config" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-18195001096');`}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
