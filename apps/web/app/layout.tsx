import "./globals.css";
import type { Metadata, Viewport } from "next";
import Sidebar from "@/components/layout/Sidebar";
import JarvisOverlay from "@/components/JarvisOverlay";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Jarvis Command Center",
  description: "Local-first AI productivity cockpit",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jarvis",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "msapplication-TileColor": "#0d0f14",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const isProduction = process.env.NODE_ENV === "production";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body className="bg-[#0d0f14] text-slate-100 antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto min-w-0">
            {children}
          </main>
        </div>
        <JarvisOverlay />
        {isProduction ? (
          <Script id="sw-register" strategy="afterInteractive">{`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
          `}</Script>
        ) : (
          <Script id="sw-unregister-dev" strategy="beforeInteractive">{`
            (async () => {
              const hadController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
              if ('serviceWorker' in navigator) {
                await navigator.serviceWorker.getRegistrations()
                  .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
                  .catch(() => {});
              }
              if ('caches' in window) {
                await caches.keys()
                  .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
                  .catch(() => {});
              }
              if (hadController && !sessionStorage.getItem('sw-dev-cleaned')) {
                sessionStorage.setItem('sw-dev-cleaned', '1');
                window.location.reload();
              } else {
                sessionStorage.removeItem('sw-dev-cleaned');
              }
            })();
          `}</Script>
        )}
      </body>
    </html>
  );
}
