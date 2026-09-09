import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const interfaceFont = IBM_Plex_Sans({
  variable: "--font-interface",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const editorialFont = Newsreader({
  variable: "--font-editorial",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cinematic Research Workspace",
  description:
    "An evidence-backed cinematic reference research workspace for filmmakers and serious film fans.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interfaceFont.variable} ${editorialFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}

