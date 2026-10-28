import "./globals.css";

export const metadata = { title: "serie-studio" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
