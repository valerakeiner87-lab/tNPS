import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "ATC Digital · Claro Guatemala",
  description: "Plataforma de análisis de satisfacción y gamificación del contact center de Claro Guatemala.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#DA291C" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

// Script inline para prevenir FOUC del tema (light/dark + paleta).
// Se ejecuta antes del primer paint. Lee de localStorage `atc-tema` y
// aplica la clase `.dark` + los CSS vars de la paleta.
const themeScript = `
(function() {
  try {
    var raw = localStorage.getItem('atc-tema');
    var cfg = raw ? JSON.parse(raw) : { tipo: 'light', paleta: 'claro' };
    var paletas = {
      claro: { primary: '#DA291C', accent: '#7B0F08' },
      femenino: { primary: '#E91E63', accent: '#9C27B0' },
      masculino: { primary: '#2196F3', accent: '#1976D2' },
      ocean: { primary: '#009688', accent: '#00695C' },
      sunset: { primary: '#FF5722', accent: '#E64A19' }
    };
    var p = paletas[cfg.paleta] || paletas.claro;
    var root = document.documentElement;
    if (cfg.tipo === 'dark') root.classList.add('dark');
    root.setAttribute('data-paleta', cfg.paleta || 'claro');
    root.style.setProperty('--primary', p.primary);
    root.style.setProperty('--ring', p.primary);
    root.style.setProperty('--sidebar-primary', p.primary);
    root.style.setProperty('--sidebar-ring', p.primary);
    root.style.setProperty('--chart-1', p.primary);
    root.style.setProperty('--chart-2', p.accent);
    root.style.setProperty('--primary-foreground', '#ffffff');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
