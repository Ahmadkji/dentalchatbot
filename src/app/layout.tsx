import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://dentalgptstudio.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DentalGPT Studio — AI Front Desk for Dental Clinics",
    template: "%s | DentalGPT Studio",
  },
  description:
    "DentalGPT Studio is an AI-powered front desk for dental clinics. Answer patient questions 24/7, capture appointment requests, and track every lead automatically.",
  keywords: [
    "dental AI chatbot",
    "AI front desk for dental clinics",
    "dental clinic chatbot",
    "dental appointment booking AI",
    "patient communication automation",
    "dental lead capture",
    "after-hours dental answering service",
    "dental website widget",
    "automated patient intake",
    "dental front desk software",
  ],
  authors: [{ name: "DentalGPT Studio", url: siteUrl }],
  creator: "DentalGPT Studio",
  publisher: "DentalGPT Studio",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "DentalGPT Studio",
    title: "DentalGPT Studio — AI Front Desk for Dental Clinics",
    description:
      "Your AI front desk answers patient questions 24/7, captures appointment requests, and tracks every lead. Set up in under 5 minutes.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "DentalGPT Studio — AI Front Desk for Dental Clinics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DentalGPT Studio — AI Front Desk for Dental Clinics",
    description:
      "Your AI front desk answers patient questions 24/7, captures appointment requests, and tracks every lead.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
