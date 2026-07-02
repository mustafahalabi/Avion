import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
// avion brutalist design system (tokens + .av-* component classes).
import "../styles/avion-ui.css";

// Avion brand typography: Space Grotesk (display/wordmark) + JetBrains Mono (labels/mono).
// CSS variable names are kept stable so globals.css / Tailwind need no further edits.
const brandSans = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const brandMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Avion",
    default: "Avion",
  },
  description: "Your virtual software company.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${brandSans.variable} ${brandMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
