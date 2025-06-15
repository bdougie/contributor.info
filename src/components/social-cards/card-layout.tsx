import { ThemeProvider } from "@/components/theme-provider";
import "@/index.css";

interface CardLayoutProps {
  children: React.ReactNode;
}

export default function CardLayout({ children }: CardLayoutProps) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <div className="min-h-screen bg-background antialiased">
        {children}
      </div>
    </ThemeProvider>
  );
}