import { ReactNode, useEffect, useRef } from "react";

interface ShareableCapturePreviewProps {
  children: ReactNode;
  repository?: string;
}

export function ShareableCapturePreview({ children, repository = "test-org/awesome-project" }: ShareableCapturePreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Force light mode styles on all elements within the capture preview
    if (contentRef.current) {
      const forceLight = (element: Element) => {
        // Remove dark class and add light class
        element.classList.remove('dark');
        if (element.classList.contains('bg-background') || 
            element.classList.contains('bg-card')) {
          element.classList.add('!bg-white');
        }
        if (element.classList.contains('text-foreground') || 
            element.classList.contains('text-card-foreground')) {
          element.classList.add('!text-gray-900');
        }
        
        // Process all children
        Array.from(element.children).forEach(child => forceLight(child));
      };
      
      forceLight(contentRef.current);
      
      // Use MutationObserver to handle dynamically added content
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              forceLight(node as Element);
            }
          });
        });
      });
      
      observer.observe(contentRef.current, { childList: true, subtree: true });
      
      return () => observer.disconnect();
    }
  }, [children]);
  return (
    <div className="flex justify-center">
      {/* Wrapper with orange border matching ShareableCard capture */}
      <div 
        className="overflow-hidden"
        style={{
          border: "10px solid #f97316",
          borderRadius: "36px",
          maxWidth: "540px",
          minWidth: "540px",
          width: "540px",
          backgroundColor: "white"
        }}
      >
        {/* Black attribution header */}
        <div 
          style={{
            height: "60px",
            backgroundColor: "#202020",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            color: "white"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div 
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: "#404040",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <span style={{ fontSize: "12px" }}>📊</span>
            </div>
            <span style={{ fontSize: "16px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "280px" }}>
              {repository}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>contributor.info</span>
            <span style={{ fontSize: "18px", marginLeft: "4px" }}>🌱</span>
          </div>
        </div>
        
        {/* Content area with white background and forced light mode */}
        <div 
          style={{
            padding: "20px",
            backgroundColor: "white",
            minHeight: "300px",
            colorScheme: "light"
          }}
        >
          {/* Force light theme for all children */}
          <div 
            ref={contentRef}
            className="light-theme-override"
            style={{ 
              backgroundColor: "white",
              color: "#111827"
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              .light-theme-override * {
                color-scheme: light !important;
              }
              .light-theme-override .bg-background,
              .light-theme-override .bg-card,
              .light-theme-override .dark\\:bg-background,
              .light-theme-override .dark\\:bg-card {
                background-color: white !important;
              }
              .light-theme-override .text-foreground,
              .light-theme-override .text-card-foreground,
              .light-theme-override .dark\\:text-foreground,
              .light-theme-override .dark\\:text-card-foreground {
                color: #111827 !important;
              }
              .light-theme-override .border,
              .light-theme-override .dark\\:border {
                border-color: #e5e7eb !important;
              }
              .light-theme-override .bg-muted,
              .light-theme-override .dark\\:bg-muted {
                background-color: #f9fafb !important;
              }
              .light-theme-override .text-muted-foreground,
              .light-theme-override .dark\\:text-muted-foreground {
                color: #6b7280 !important;
              }
              .light-theme-override .bg-accent,
              .light-theme-override .dark\\:bg-accent {
                background-color: #f3f4f6 !important;
              }
              .light-theme-override svg {
                color: currentColor !important;
              }
            ` }} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}