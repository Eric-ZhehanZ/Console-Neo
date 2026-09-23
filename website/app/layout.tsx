import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "A calm, synchronized desktop console for Model United Nations—chairing, projection, collaboration, motions, speakers, documents, voting, and complete bilingual guides.";

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Console Neo — MUN Meeting Console",
      template: "%s · Console Neo",
    },
    description,
    applicationName: "Console Neo",
    keywords: [
      "Console Neo",
      "Model United Nations",
      "MUN",
      "meeting console",
      "conference chairing",
      "模拟联合国",
      "会场控制台",
    ],
    icons: {
      icon: "/icon.png",
      shortcut: "/icon.png",
      apple: "/icon.png",
    },
    alternates: {
      languages: {
        "zh-CN": "/?lang=zh",
        en: "/?lang=en",
      },
    },
    openGraph: {
      type: "website",
      title: "Console Neo — Run the room. Keep everyone in sync.",
      description,
      locale: "zh_CN",
      alternateLocale: ["en_US"],
      images: [{ url: `${origin}/og.png`, width: 1744, height: 908, alt: "Console Neo controller and synchronized room cast" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Console Neo — Run the room. Keep everyone in sync.",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
