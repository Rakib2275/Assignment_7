import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rakib | Load management, made clear",
  description:
    "Stay informed about electricity schedules and service areas with Rakib.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
