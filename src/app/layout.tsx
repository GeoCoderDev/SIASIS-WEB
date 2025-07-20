import { Roboto } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import ProviderStore from "@/global/store/Provider";
import WindowDimensionsLabel from "../components/shared/WindowDimensionsLabel";
import { ViewTransitions } from "next-view-transitions";
import dotenv from "dotenv";
import PlantillaSegunRol from "@/components/shared/layouts/PlantillaSegunRol";
import NextTopLoader from "nextjs-toploader";
import { ColorHexadecimal } from "@/interfaces/Colors";
import { getRandomContrastColor } from "@/lib/helpers/colors/getRandomContrastColor";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";

dotenv.config();

// Configurando Fuente Roboto
const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-roboto",
  style: ["italic", "normal"],
  display: "swap", // Mejora rendimiento
});

export const metadata: Metadata = {
  // 🎯 TÍTULO OPTIMIZADO - Más directo y centrado en la institución
  title: {
    default: "I.E. 20935 Asunción 8 | Sistema SIASIS - Imperial, Cañete",
    template: "%s | I.E. 20935 Asunción 8",
  },

  // 📝 DESCRIPCIÓN OPTIMIZADA - Más específica y atractiva
  description:
    "Institución Educativa 20935 Asunción 8 de Imperial, Cañete. Sistema digital SIASIS para control de asistencia, comunicación con padres y gestión educativa. Educación primaria y secundaria de calidad.",

  // 🔍 KEYWORDS OPTIMIZADAS - Más específicas y locales
  keywords: [
    "I.E. 20935",
    "Institución Educativa 20935 Asunción 8",
    "colegio Imperial Cañete",
    "SIASIS sistema asistencia",
    "educación primaria Imperial",
    "educación secundaria Cañete",
    "colegio público Imperial",
    "control asistencia escolar",
    "gestión educativa digital",
    "sistema educativo Cañete",
    "matrícula I.E. 20935",
    "colegio Asunción 8",
  ].join(", "),

  // 🌐 Open Graph MEJORADO
  openGraph: {
    title: "I.E. 20935 Asunción 8 - Sistema SIASIS | Imperial, Cañete",
    description:
      "Institución Educativa 20935 Asunción 8 con sistema digital SIASIS. Educación de calidad en Imperial, Cañete. Información para padres, estudiantes y comunidad educativa.",
    url: "https://ie20935.siasis.org",
    siteName: "I.E. 20935 Asunción 8",
    images: [
      {
        url: "/meta/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Institución Educativa 20935 Asunción 8 - Imperial, Cañete",
      },
    ],
    locale: "es_PE",
    type: "website",
  },

  // 🐦 Twitter MEJORADO
  twitter: {
    card: "summary_large_image",
    title: "I.E. 20935 Asunción 8 - Sistema SIASIS",
    description:
      "Institución Educativa con sistema digital de gestión. Imperial, Cañete.",
    images: ["/meta/images/twitter-image.jpg"],
  },

  // 🤖 ROBOTS optimizado
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // 🔗 URL canónica
  alternates: {
    canonical: "https://ie20935.siasis.org",
  },

  // 👥 Autoría
  authors: [
    {
      name: "Institución Educativa 20935 Asunción 8",
      url: "https://ie20935.siasis.org",
    },
  ],
  publisher: "I.E. 20935 Asunción 8 - Imperial, Cañete",
  category: "Education",

  // ✅ Verificación (ya tienes Google configurado)
  verification: {
    google: "ImVWtaIkP3rzCz2k2kdPCndjCBLdY4tMBLtCxmeTap4", // ✅ Ya configurado
  },

  // 📱 PWA
  applicationName: "SIASIS I.E. 20935",
  appleWebApp: {
    capable: true,
    title: "I.E. 20935 Asunción 8",
    statusBarStyle: "default",
  },

  // 📍 Geolocalización MEJORADA
  other: {
    "geo.region": "PE-LIM", // Lima, no ICA
    "geo.placename": "Imperial, Provincia de Cañete, Lima",
    "geo.position": "-13.0594;-76.3503",
    ICBM: "-13.0594, -76.3503",
    language: "es-PE",
    "revisit-after": "7 days",
    // Datos estructurados básicos
    "theme-color": "#dd3524",
  },

  // 🎨 ICONOS mejorados
  icons: {
    icon: [{ url: "/images/svg/Logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/meta/images/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const interfazColor: ColorHexadecimal = "#dd3524";
  const contrastColor = getRandomContrastColor(interfazColor);

  return (
    <ViewTransitions>
      <html lang="es-PE" dir="ltr">
        {ENTORNO === Entorno.PRODUCCION && (
          <head>
            {/* ✅ Verificación de Google ya configurada */}
            <meta
              name="google-site-verification"
              content="ImVWtaIkP3rzCz2k2kdPCndjCBLdY4tMBLtCxmeTap4"
            />

            {/* 📊 DATOS ESTRUCTURADOS para mejorar la apariencia en búsquedas */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "EducationalOrganization",
                  name: "Institución Educativa 20935 Asunción 8",
                  alternateName: ["I.E. 20935", "SIASIS I.E. 20935"],
                  description:
                    "Institución educativa pública ubicada en Imperial, Cañete, que ofrece educación primaria y secundaria con sistema digital SIASIS",
                  url: "https://ie20935.siasis.org",
                  logo: "https://ie20935.siasis.org/images/svg/Logo.svg",
                  address: {
                    "@type": "PostalAddress",
                    streetAddress:
                      "Av. Elvira Tovar Cortijo Mza. H a.H. Asuncion 8",
                    addressLocality: "Imperial",
                    addressRegion: "Cañete",
                    addressCountry: "PE",
                  },
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: -13.0594,
                    longitude: -76.3503,
                  },
                  // telephone: "+51-XXX-XXXXXX", // Agregar teléfono real
                  // email: "contacto@ie20935.edu.pe", // Agregar email real
                  // foundingDate: "1995", // Agregar año real de fundación
                  hasOfferCatalog: {
                    "@type": "OfferCatalog",
                    name: "Servicios Educativos",
                    itemListElement: [
                      {
                        "@type": "Offer",
                        itemOffered: {
                          "@type": "Course",
                          name: "Educación Primaria",
                          description:
                            "Educación primaria completa de 1° a 6° grado",
                        },
                      },
                      {
                        "@type": "Offer",
                        itemOffered: {
                          "@type": "Course",
                          name: "Educación Secundaria",
                          description:
                            "Educación secundaria completa de 1° a 5° año",
                        },
                      },
                    ],
                  },
                  sameAs: [
                    // Agregar redes sociales cuando las tengas
                  ],
                }),
              }}
            />

            {/* 🚀 PRELOAD de recursos críticos */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin=""
            />
          </head>
        )}

        <body
          className={`${roboto.variable} font-roboto antialiased portrait:min-h-[100dvh] landscape:min-h-screen`}
        >
          <style>
            {`
              :root{
                --color-interfaz: ${interfazColor};
              }
              
              /* Mejoras de rendimiento */
              .font-roboto {
                font-display: swap;
              }
            `}
          </style>

          <NextTopLoader
            color={contrastColor}
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow={`0 0 10px ${contrastColor},0 0 5px ${contrastColor}`}
          />

          {ENTORNO !== Entorno.PRODUCCION && <WindowDimensionsLabel />}

          <ProviderStore>
            <PlantillaSegunRol>{children}</PlantillaSegunRol>
          </ProviderStore>
        </body>
      </html>
    </ViewTransitions>
  );
}
