import { ReactNode } from "react";

interface ShareableCapturePreviewProps {
  children: ReactNode;
  repository?: string;
}

export function ShareableCapturePreview({ children, repository = "test-org/awesome-project" }: ShareableCapturePreviewProps) {
  return (
    <div className="flex justify-center">
      {/* Clean card layout for capture preview */}
      <div 
        className="overflow-hidden shadow-lg bg-background border border-gray-200 dark:border-gray-700"
        style={{
          borderRadius: "12px",
          maxWidth: "540px",
          minWidth: "540px",
          width: "540px"
        }}
      >
        {/* Attribution header - theme aware: black on light mode, almost white on dark mode */}
        <div 
          className="h-[60px] bg-black dark:bg-gray-50 text-white dark:text-gray-900 flex items-center justify-between px-5"
          style={{
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 dark:bg-gray-200 rounded flex items-center justify-center">
              <span className="text-xs">📊</span>
            </div>
            <span className="text-base font-bold truncate max-w-[380px]">
              {repository}
            </span>
          </div>
          <div className="flex items-center flex-shrink-0">
            <span className="text-sm font-medium">contributor.info</span>
            <span className="text-lg ml-1">🌱</span>
          </div>
        </div>
        
        {/* Content area that adapts to theme */}
        <div className="p-5 bg-background min-h-[300px]">
          {children}
        </div>
      </div>
    </div>
  );
}