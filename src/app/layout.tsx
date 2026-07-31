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
  themeColor: "#10B981",
};

export const metadata: Metadata = {
  title: "REP | Escuchar - Acompañar - Transformar | Un Espacio Seguro para Vos",
  description: "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos y necesidades.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "REP",
  },
  // === OpenGraph (redes sociales: Facebook, WhatsApp, LinkedIn, etc.) ===
  openGraph: {
    title: "REP | Escuchar - Acompañar - Transformar | Un Espacio Seguro para Vos",
    description: "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos y necesidades.",
    type: "website",
    locale: "es_AR",
    siteName: "Red Escucha Psicológica",
    url: "https://www.redescuchapsicologica.com",
  },
  // === Twitter Card ===
  twitter: {
    card: "summary_large_image",
    title: "REP | Escuchar - Acompañar - Transformar | Un Espacio Seguro para Vos",
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
        {/* === Favicons ===
            favicon.ico es multi-resolución real (16+32+48 px embebidos en .ico)
            generado desde el isotipo oficial REP con fondo esmeralda #10B981.
            Los PNG individuales son fallback para navegadores que no soportan .ico multi-res. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />

        {/* === Google Fonts — optimizado con preconnect ===
            preconnect establece la conexión TCP/TLS con Google Fonts
            temprano, reduciendo el tiempo de carga del CSS de fonts.
            display=swap en la URL muestra texto con fallback font primero
            y swapea cuando la font real carga (FOUT en vez de FOIT).
            Sin onLoad handler (no compatible con Server Components). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap"
        />
        {/* Google Tag (gtag.js) - AW-1017920443
            Etiqueta de Google Ads para seguimiento de conversiones. */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-1017920443"
          strategy="afterInteractive"
        />
        <Script id="google-gtag-config" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-1017920443');`}
        </Script>

        {/* === Schema.org LocalBusiness — SEO local para Google Maps ===
            Como Red Escucha Psicológica no tiene una dirección física única
            (los profesionales atienden en diferentes direcciones y también
            online), usamos:
            - @type: LocalBusiness (general, no PhysicalBusiness)
            - areaServed: áreas geográficas donde se brinda el servicio
            - availableService: tipos de terapia que se ofrecen
            - openingHours: 24/7 (atención telefónica/online permanente)
            - contactPoint: email + WhatsApp + teléfono

            Esto le dice a Google:
            1. Que somos un negocio de salud mental
            2. Dónde operamos (CABA, GBA, Argentina + Online)
            3. Cómo contactarnos (email, teléfono, WhatsApp)
            4. Qué servicios ofrecemos
            5. Horario de atención (24/7)

            Google usa estos datos para:
            - Mostrarnos en Google Maps (con el área de cobertura)
            - Mejorar el SEO local
            - Habilitar rich snippets en resultados de búsqueda
            - Conectar con Google Business Profile cuando lo creen */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "@id": "https://www.redescuchapsicologica.com/#business",
              name: "Red Escucha Psicológica",
              alternateName: "REP",
              description:
                "Plataforma de psicólogos que brindan terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Atención presencial y online en todo Argentina.",
              url: "https://www.redescuchapsicologica.com",
              email: "contacto@redescuchapsicologica.com",
              telephone: "+5491176683429",
              image: "https://www.redescuchapsicologica.com/rep-logo.png",
              logo: "https://www.redescuchapsicologica.com/rep-logo.png",
              slogan: "Escuchar - Acompañar - Transformar",
              // === Áreas de servicio ===
              // Sin dirección física única — los profesionales atienden
              // en diferentes ubicaciones. Definimos el área de cobertura.
              areaServed: [
                { "@type": "AdministrativeArea", name: "Capital Federal (CABA)" },
                { "@type": "AdministrativeArea", name: "Gran Buenos Aires (GBA)" },
                { "@type": "AdministrativeArea", name: "Provincia de Buenos Aires" },
                { "@type": "AdministrativeArea", name: "Córdoba" },
                { "@type": "AdministrativeArea", name: "Mendoza" },
                { "@type": "AdministrativeArea", name: "Santa Fe" },
                { "@type": "Country", name: "Argentina" },
                { "@type": "Place", name: "Online (videollamada a todo el país)" },
              ],
              // === Tipo de negocio ===
              additionalType: "https://schema.org/MedicalBusiness",
              // === Servicios disponibles ===
              availableService: [
                {
                  "@type": "MedicalTherapy",
                  name: "Terapia individual",
                  description:
                    "Psicoterapia individual para adolescentes, adultos y adultos mayores.",
                },
                {
                  "@type": "MedicalTherapy",
                  name: "Terapia de pareja",
                  description:
                    "Terapia vincular para parejas que buscan mejorar su relación.",
                },
                {
                  "@type": "MedicalTherapy",
                  name: "Terapia familiar",
                  description:
                    "Terapia sistémica para familias en proceso de cambio o conflicto.",
                },
                {
                  "@type": "MedicalTherapy",
                  name: "Terapia grupal",
                  description:
                    "Grupos terapéuticos coordinados por profesionales especializados.",
                },
              ],
              // === Modalidades de atención ===
              // Indicamos que ofrecemos atención presencial y online
              branchCode: "online-y-presencial",
              // === Horario de atención ===
              // 24 horas, los 365 días del año (atención telefónica y online)
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ],
                  opens: "00:00",
                  closes: "23:59",
                },
              ],
              // === Puntos de contacto ===
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "customer support",
                  email: "contacto@redescuchapsicologica.com",
                  telephone: "+5491176683429",
                  contactOption: "TollFree",
                  areaServed: "Argentina",
                  availableLanguage: ["Spanish"],
                },
                {
                  "@type": "ContactPoint",
                  contactType: "reservations",
                  email: "contacto@redescuchapsicologica.com",
                  telephone: "+5491176683429",
                  contactOption: "WhatsApp",
                  areaServed: "Argentina",
                  availableLanguage: ["Spanish"],
                },
              ],
              // === Same as (redes sociales, si las tienen) ===
              sameAs: [
                "https://www.redescuchapsicologica.com",
              ],
              // === Política de precios ===
              priceRange: "$$",
              paymentAccepted: "Transferencia, Efectivo, Tarjeta",
              currenciesAccepted: "ARS",
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
