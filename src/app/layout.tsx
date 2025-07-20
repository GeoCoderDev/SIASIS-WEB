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
});

export const metadata: Metadata = {
  title:
    "SIASIS - Sistema de Asistencia I.E. 20935 Asunción 8 | Imperial, Cañete",
  description:
    "Sistema digital de control de asistencia y gestión educativa para la Institución Educativa 20935 Asunción 8 de Imperial, Cañete. Plataforma integral para directivos, profesores, personal del colegio en general y padres de familia.",
  keywords: [
    "sistema de asistencia",
    "I.E. 20935",
    "Institución Educativa Asunción 8",
    "Imperial Cañete",
    "control de asistencia escolar",
    "gestión educativa digital",
    "colegio Imperial",
    "SIASIS",
    "asistencia estudiantil",
    "plataforma educativa Perú",
  ].join(", "),

  // Open Graph para redes sociales
  openGraph: {
    title: "SIASIS - Sistema de Asistencia I.E. 20935 Asunción 8",
    description:
      "Plataforma digital de gestión educativa para la I.E. 20935 Asunción 8 de Imperial, Cañete",
    url: "https://ie20935.siasis.org",
    siteName: "SIASIS I.E. 20935",
    images: [
      {
        url: "/meta/images/og-image.jpg", // Crear esta imagen
        width: 1200,
        height: 630,
        alt: "SIASIS - Sistema de Asistencia I.E. 20935 Asunción 8",
      },
    ],
    locale: "es_PE",
    type: "website",
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "SIASIS - Sistema de Asistencia I.E. 20935 Asunción 8",
    description: "Sistema digital de control de asistencia y gestión educativa",
    images: ["/meta/images/twitter-image.jpg"],
  },

  // Información adicional
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

  // Canonical URL
  alternates: {
    canonical: "https://ie20935.siasis.org",
  },

  // Otros metadatos importantes
  authors: [{ name: "I.E. 20935 Asunción 8" }],
  publisher: "Institución Educativa 20935 Asunción 8",
  category: "Education",

  // Verificación de herramientas
  verification: {
    google: "tu-codigo-de-verificacion-google", // Agregar después de configurar Search Console
    // yandex: "codigo-yandex",
    // yahoo: "codigo-yahoo",
  },

  // Configuración de aplicación
  applicationName: "SIASIS",
  appleWebApp: {
    capable: true,
    title: "SIASIS I.E. 20935",
    statusBarStyle: "default",
  },

  // Metadatos específicos del sitio
  other: {
    "geo.region": "PE-ICA",
    "geo.placename": "Imperial, Cañete",
    "geo.position": "-13.0594;-76.3503", // Coordenadas aproximadas de Imperial
    ICBM: "-13.0594, -76.3503",
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
      <html lang="es">
        {ENTORNO === Entorno.PRODUCCION && (
          <head>
            <meta
              name="google-site-verification"
              content="ImVWtaIkP3rzCz2k2kdPCndjCBLdY4tMBLtCxmeTap4"
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
