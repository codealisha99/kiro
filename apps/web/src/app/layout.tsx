import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "../styles/primitives.css";

export const metadata: Metadata = {
  title: { default: "Kiro — Company knowledge, with the source", template: "%s" },
  description: "A permission-aware company knowledge desk. Ask questions of your documents and inspect the evidence behind each answer.",
  applicationName: "Kiro",
  creator: "Alisha Karma",
  authors: [{ name: "Alisha Karma", url: "https://github.com/codealisha99" }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Serif:ital,wght@0,400;0,500;1,400&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
