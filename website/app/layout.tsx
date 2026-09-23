import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "The meeting console for Model UN. The chair works in the controller, the room follows on the cast, and co-chairs collaborate live from their own devices.";

  return {
    metadataBase: new URL(origin),
    title: "Console Neo",
    description,
    applicationName: "Console Neo",
    keywords: ["Console Neo", "Model United Nations", "MUN", "模拟联合国", "会议控制台"],
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
      apple: "/apple-icon.png",
    },
    alternates: {
      languages: {
        "zh-CN": "/?lang=zh",
        en: "/?lang=en",
      },
    },
    openGraph: {
      type: "website",
      title: "Console Neo",
      description,
      locale: "zh_CN",
      alternateLocale: ["en_US"],
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Console Neo" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Console Neo",
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
