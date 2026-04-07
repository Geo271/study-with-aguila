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

export const metadata = {
  title: "Study with Aguila",
  description: "Your AI-powered academic tutor",
  // 📱 FIX: Prevents mobile browsers from zooming in accidentally on inputs
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
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