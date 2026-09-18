import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Anton, Geist } from "next/font/google";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import "./components.css";
import "./expanded-components.css";
import "./modal-overrides.css";
import "./access-auth.css";
import "./country-control.css";
import "./asset-control.css";
import "./scrollbars.css";
import "./dashboard-shell.css";
import "./admin-ops.css";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const antonDisplay = Anton({
  variable: "--font-anton-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "Operations", template: "%s | StrivePay Ops" },
  description: "StrivePay operations cockpit for customers, transactions, and runtime readiness.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${antonDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
