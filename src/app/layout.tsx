import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  // Per-page titles fill the %s slot, so the browser tab reflects the section.
  title: { default: "VigilEye AI", template: "%s · VigilEye AI" },
  description:
    "AI-powered structural health monitoring — detect, measure and forecast cracks in bridges, dams and buildings.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "VigilEye AI",
    description: "AI-powered structural health monitoring for critical infrastructure.",
    type: "website",
  },
  robots: { index: false, follow: false }, // app is private; marketing pages opt in separately
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Toaster
          theme="light"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border) / 0.6)",
              borderRadius: "16px",
              boxShadow: "rgba(205, 208, 223, 0.4) 0px 2px 48px 0px",
            },
          }}
        />
      </body>
    </html>
  );
}
