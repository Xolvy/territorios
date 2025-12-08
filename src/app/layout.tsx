// Import Firebase interceptor FIRST to prevent initialization
import "@/lib/firebase-interceptor";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ConfirmationProvider } from "@/components/ui/ConfirmationProvider";
import UnifiedAppProvider from "@/context/UnifiedAppContext";
import FirebaseConnectionWrapper from "@/components/FirebaseConnectionWrapper";
import BrowserDiagnostic from "@/components/debug/BrowserDiagnostic";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "App Conductores - Sistema de Gestión Territorial",
  description:
    "Sistema completo de gestión de territorios y predicación telefónica optimizado para Azure Static Web Apps. Interfaz moderna, funciones avanzadas de exportación y análisis inteligente.",
  keywords: [
    "app conductores",
    "gestión territorial",
    "predicación telefónica",
    "azure static web apps",
    "next.js",
    "sistema moderno",
    "exportación datos",
    "análisis inteligente",
  ],
  authors: [{ name: "App Conductores Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
    shortcut: "/favicon.ico",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  robots: "index, follow",
  openGraph: {
    title: "App Conductores - Sistema de Gestión Territorial",
    description:
      "Sistema completo de gestión de territorios optimizado para Azure SWA",
    url: "https://lively-hill-009fd0b0f.2.azurestaticapps.net",
    siteName: "App Conductores",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "App Conductores - Sistema de Gestión Territorial",
    description:
      "Sistema completo de gestión territorial con funciones avanzadas",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <FirebaseConnectionWrapper>
          <UnifiedAppProvider>
            <ToastProvider>
              <ConfirmationProvider>
                {children}
                <BrowserDiagnostic />
              </ConfirmationProvider>
            </ToastProvider>
          </UnifiedAppProvider>
        </FirebaseConnectionWrapper>
      </body>
    </html>
  );
}
