import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Just the SEO text goes here now
export const metadata = {
  title: 'Study with Aguila',
  description: 'AI-powered study assistant and PDF reviewer',
  // 🌟 ADD THIS LINE:
  icons: {
    icon: '/logo.png',
  },
}

// 2. 📱 The viewport gets its very own dedicated export!
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-full h-full bg-neutral-950 flex flex-col`} 
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}