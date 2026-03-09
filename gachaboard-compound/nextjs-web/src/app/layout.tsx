import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "./components/auth/AuthProvider";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { ThemeToggleFloating } from "./components/theme/ThemeToggleFloating";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXTAUTH_URL ?? "https://gachaboard.example.com";

export const metadata: Metadata = {
  title: "Gachaboard",
  description: "音楽・映像・デザインファイルを貼り付けて、みんなで一緒に使えるホワイトボード",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Gachaboard",
    description: "音楽・映像・デザインファイルを貼り付けて、みんなで一緒に使えるホワイトボード",
    images: ["/ogp.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gachaboard",
    description: "音楽・映像・デザインファイルを貼り付けて、みんなで一緒に使えるホワイトボード",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;try{var s=JSON.parse(localStorage.getItem("COMPOUND_USER_DATA_v3")||"null");d.classList.toggle("dark",!!s?.user?.isDarkMode);}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
            <ThemeToggleFloating />
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
