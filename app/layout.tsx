import type { ReactNode } from "react";

export const metadata = {
  title: "AI Portfolio Factory",
  description: "Autonomous software development agent controller."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
