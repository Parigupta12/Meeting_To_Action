import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeetingToAction",
  description:
    "Voice-first meeting-to-execution agent: dictate with Wispr Flow, Gemini finds decisions, owners and deadlines, catches conflicts with past decisions, and asks before it guesses.",
  openGraph: {
    title: "MeetingToAction",
    description:
      "Say it in the meeting. Watch it get done. A voice-first agent that turns meetings into confirmed decisions and tasks.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
