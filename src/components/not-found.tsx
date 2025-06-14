import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  // Handle navigation (both keyboard and button)
  const handleNavigation = () => {
    if (!isRedirecting) {
      setIsRedirecting(true);
      
      // Simulate a brief loading delay before redirecting
      setTimeout(() => {
        navigate("/");
      }, 500);
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNavigation();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        {/* Terminal title bar */}
        <div className="bg-muted text-foreground p-2 rounded-t-lg flex items-center border-b">
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
              "font-mono text-sm sm:text-base p-4 sm:p-6 bg-card text-card-foreground min-h-[300px]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-opacity-50",
              "transition-all duration-200"
            )}
          >
            <div className="mb-2 text-muted-foreground">Last login: {new Date().toLocaleString()}</div>
            
            <div className="flex items-start">
              <span className="text-primary mr-2">$</span>
              <div className="flex-1">
                <span>git rebase HEAD~1</span>
                {showCursor && <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse-subtle"></span>}
              </div>
            </div>
            
            {isRedirecting ? (
              <div className="mt-4 text-yellow-600 animate-pulse">
                Rebasing... Redirecting to home page...
              </div>
            ) : (
              showEnterPrompt && (
                <div className="mt-6 space-y-4">
                  <div className="text-muted-foreground animate-bounce-gentle">
                    Press <span className="px-2 py-1 bg-muted rounded text-foreground">Enter</span> to go back to the home page
                  </div>
                  <div className="sm:hidden">
                    <Button 
                      onClick={handleNavigation}
                      variant="default"
                      className="w-full font-mono"
                    >
                      Go Back to Home
                    </Button>
                  </div>
                </div>
              )
            )}
            
            <div className="mt-8 text-destructive">
              <div>fatal: 404 Not Found</div>
              <div className="mt-2">The page you're looking for doesn't exist or has been moved.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}