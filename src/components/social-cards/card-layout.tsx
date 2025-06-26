import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/common/theming";
import "@/index.css";

interface CardLayoutProps {
  children: ReactNode;
}

export default function CardLayout({ children }: CardLayoutProps) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <div className="min-h-screen bg-background antialiased social-card-layout">
        {children}
      </div>
    </ThemeProvider>
  );
}