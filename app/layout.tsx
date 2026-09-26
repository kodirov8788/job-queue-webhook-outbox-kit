import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Queue + Webhook Outbox Kit",
  description: "Postgres-backed job queue with signed webhook outbox, retries, and dead-letter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
