import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const navigate = useNavigate();
  const [showCursor, setShowCursor] = useState(true);
  const [showEnterPrompt, setShowEnterPrompt] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set focus to the container when component mounts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  // Show "Press Enter" prompt after a delay
  useEffect(() => {
    const promptTimer = setTimeout(() => {
      setShowEnterPrompt(true);
    }, 1500);

    return () => clearTimeout(promptTimer);
  }, []);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRedirecting) {
      setIsRedirecting(true);
      
      // Simulate a brief loading delay before redirecting
      setTimeout(() => {
        navigate("/");
      }, 500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl shadow-lg border-gray-800 dark:border-gray-700">
        {/* Terminal title bar */}
        <div className="bg-gray-800 dark:bg-gray-900 text-white p-2 rounded-t-lg flex items-center">
          <Terminal className="h-4 w-4 mr-2" />
          <div className="text-sm font-mono">contributor.info - Terminal</div>
          <div className="ml-auto flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        
        <CardContent 
          className="p-0 overflow-hidden"
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          role="region"
          aria-label="404 Not Found Terminal"
        >
          <div 
            className={cn(
              "font-mono text-sm sm:text-base p-4 sm:p-6 bg-gray-900/95 text-green-400 min-h-[300px]",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50",
              "transition-all duration-200"
            )}
          >
            <div className="mb-2 text-gray-400">Last login: {new Date().toLocaleString()}</div>
            
            <div className="flex items-start">
              <span className="text-blue-400 mr-2">$</span>
              <div className="flex-1">
                <span>git rebase HEAD~1</span>
                {showCursor && <span className="inline-block w-2 h-4 ml-1 bg-green-400 animate-pulse-subtle"></span>}
              </div>
            </div>
            
            {isRedirecting ? (
              <div className="mt-4 text-yellow-300 animate-pulse">
                Rebasing... Redirecting to home page...
              </div>
            ) : (
              showEnterPrompt && (
                <div className="mt-6 text-gray-400 animate-bounce-gentle">
                  Press <span className="px-2 py-1 bg-gray-800 rounded text-white">Enter</span> to go back to the home page
                </div>
              )
            )}
            
            <div className="mt-8 text-red-400">
              <div>fatal: 404 Not Found</div>
              <div className="mt-2">The page you're looking for doesn't exist or has been moved.</div>
            </div>
            
            <div className="mt-6 text-gray-400">
              <div>Tip: Try running <span className="text-green-400">git checkout main</span> to return to the main branch.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}