import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { TranslationsProvider } from "@/components/translation-context";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iThink - AI Powered Debates",
  description: "Experience real-time AI debates on any topic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning
    >
      <body
        className={`${inter.className} min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TranslationsProvider>
            <Navbar />
            {children}
          </TranslationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
