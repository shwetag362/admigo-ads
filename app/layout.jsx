import { Geist, Geist_Mono, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "./providers/SessionProvider";
import QueryProvider from "./providers/QueryProvider";

// ── Existing fonts (unchanged) ────────────────────────────────────────────────
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ── Admigo brand fonts (used by login page + any future branded pages) ────────
const sora = Sora({
  variable: "--adm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--adm-mono",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

// ── Metadata (unchanged) ──────────────────────────────────────────────────────
export const metadata = {
  title: {
    default: "Admigo – Meta Automation Platform",
    template: "%s | Admigo",
  },
  description:
    "Admigo helps you manage Meta ads, pixels, events, and automations with ease. Built for marketers, agencies, and developers.",
  keywords: [
    "Admigo",
    "Meta Automation",
    "Facebook Pixel",
    "Meta Ads",
    "Next.js SaaS",
  ],
  metadataBase: new URL("https://admigo.net"),
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "Admigo – Meta Automation Platform",
    description:
      "Manage Meta ads, pixels, and automations effortlessly with Admigo.",
    url: "https://admigo.net",
    siteName: "Admigo",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Admigo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Admigo – Meta Automation Platform",
    description: "Simplify Meta ads, pixels, and automations with Admigo.",
    images: ["/og-image.png"],
  },
};

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          ${sora.variable}
          ${jetbrainsMono.variable}
          antialiased
        `}
      >
        <AuthProvider>
          <QueryProvider>
          {children}
          </QueryProvider>
          <Toaster
            position="top-center"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "500",
                padding: "16px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              },
              success: {
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#ffffff",
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#ffffff",
                },
              },
              loading: {
                duration: Infinity,
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
