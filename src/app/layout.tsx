import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { permitirIndexacion } from "@/lib/indexacion";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FanBase — Música en vivo",
  description: "Encuentra conciertos y bares con música en vivo por artista, género, comuna o fecha.",
  // En staging: <meta name="robots" content="noindex, nofollow"> (ver src/lib/indexacion.ts).
  robots: permitirIndexacion ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
