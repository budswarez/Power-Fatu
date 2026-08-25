import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Prevent static prerendering: Firebase initializes at module load and requires
// NEXT_PUBLIC_* env vars — they are only guaranteed in the runtime, not at build time.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Power Fatu — Projeção de Faturamento",
  description:
    "Plataforma de análise preditiva de faturamento multicanal com motor de sazonalidade",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Anti-flash: apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('power-fatu-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('unhandledrejection',function(e){if(e&&e.reason&&e.reason.name==='AbortError'){e.preventDefault();}});`,
          }}
        />
      </head>
      <body className="min-h-full flex">
        <ErrorBoundary>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
