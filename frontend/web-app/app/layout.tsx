import type { Metadata } from "next";
import "./globals.css";
import Navbar from './nav/NavBar';

export const metadata: Metadata = {
  title: "MotorBid",
  description: "MotorBid is a platform for buying and selling cars",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className='container mx-auto px-5 pt-10'>
          {children}
        </main>
      </body>
    </html>
  );
}
