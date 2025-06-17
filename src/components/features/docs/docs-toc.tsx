import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface DocsTocProps {
  content: string;
  className?: string;
}

export function DocsToc({ content, className }: DocsTocProps) {
  const [activeSection, setActiveSection] = useState<string>("");

  // Extract headings from markdown content
  const tocItems = useMemo(() => {
    const headingRegex = /^(#{1,2})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "") // Remove special characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .trim();

      items.push({
        id,
        title,
        level,
      });
    }

    return items;
  }, [content]);

  // Handle scroll spy functionality
  useEffect(() => {
    const handleScroll = () => {
      const headings = tocItems
        .map((item) => document.getElementById(item.id))
        .filter(Boolean);

      // Find the heading that's currently in view
      let current = "";

      for (const heading of headings) {
        if (heading) {
          const rect = heading.getBoundingClientRect();
          if (rect.top <= 100) {
            current = heading.id;
          }
        }
      }

      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [tocItems]);

  // Handle click navigation
  const handleItemClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setActiveSection(id);
    }
  };

  if (tocItems.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-64 bg-card border rounded-lg p-4", className)}>
      <nav className="space-y-1">
        {tocItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start px-2 py-1.5 h-auto text-left font-normal text-sm",
              item.level === 2 && "pl-4 text-xs",
              activeSection === item.id &&
                "bg-accent text-accent-foreground font-medium"
            )}
            onClick={() => handleItemClick(item.id)}
          >
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{item.title}</span>
            </div>
          </Button>
        ))}
      </nav>
    </div>
  );
}
