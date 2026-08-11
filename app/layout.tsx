import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.360performance.in"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "192x192" }],
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  title: {
    default: "360 Performance | Personalised Fitness Coaching",
    template: "%s | 360 Performance",
  },
  description:
    "India's premium strength, rehabilitation and performance coaching platform connecting clients with verified coaches.",
  openGraph: {
    title: "360 Performance",
    description:
      "Transform your body. Elevate your performance with verified online and offline coaches.",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "360 Performance",
    description:
      "Premium personalised coaching for strength, rehabilitation and performance.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
