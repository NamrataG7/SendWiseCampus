import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SendWise Campus Dashboard',
  description: 'Aggregate wellbeing monitoring for student cohorts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
