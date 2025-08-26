import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, TrendingUp, ChevronRight, ChevronDown } from "@/components/ui/icon";
import { DOCS_METADATA } from "./docs-loader";

interface DocsSidebarProps {
  className?: string;
}

export function DocsSidebar({ className }: DocsSidebarProps) {
  const location = useLocation();
  const [featuresExpanded, setFeaturesExpanded] = useState(true);
  const [insightsExpanded, setInsightsExpanded] = useState(true);
  
  const getDocSlug = (filename: string) => {
    return filename.replace('.md', '').replace(/^(feature-|insight-)/, '');
  };

  // Group docs by category
  const featureDocs = DOCS_METADATA.filter(doc => doc.category === "feature");
  const insightDocs = DOCS_METADATA.filter(doc => doc.category === "insight");

  const isActive = (slug: string) => {
    return location.pathname === `/docs/${slug}`;
  };

  const isDocsHome = location.pathname === '/docs';

  return (
    <aside className={cn("w-64 shrink-0 hidden lg:block", className)}>
      <nav className="sticky top-20 space-y-6 max-h-[calc(100vh-6rem)] overflow-y-auto pr-4 bg-transparent" style={{ backgroundColor: 'transparent' }}>
        {/* All Docs Link */}
        <div>
          <Link 
            to="/docs"
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isDocsHome 
                ? "text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>All Documentation</span>
            {isDocsHome && <ChevronRight className="h-4 w-4" />}
          </Link>
        </div>

        {/* Features Section */}
        <div>
          <button
            onClick={() => setFeaturesExpanded(!featuresExpanded)}
            className="flex items-center gap-2 px-3 mb-2 w-full hover:opacity-80 transition-opacity"
          >
            {featuresExpanded
? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )
: (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Features
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {featureDocs.length}
            </span>
          </button>
          {featuresExpanded && (
            <ul className="space-y-1">
              {featureDocs.map((doc) => {
                const slug = getDocSlug(doc.file);
                const active = isActive(slug);
                
                return (
                  <li key={doc.file}>
                    <Link
                      to={`/docs/${slug}`}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                        active 
                          ? "text-foreground font-medium" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{doc.title}</span>
                      {active && <ChevronRight className="h-4 w-4 shrink-0" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Insights Section */}
        <div>
          <button
            onClick={() => setInsightsExpanded(!insightsExpanded)}
            className="flex items-center gap-2 px-3 mb-2 w-full hover:opacity-80 transition-opacity"
          >
            {insightsExpanded
? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )
: (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Insights
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {insightDocs.length}
            </span>
          </button>
          {insightsExpanded && (
            <ul className="space-y-1">
              {insightDocs.map((doc) => {
                const slug = getDocSlug(doc.file);
                const active = isActive(slug);
                
                return (
                  <li key={doc.file}>
                    <Link
                      to={`/docs/${slug}`}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                        active 
                          ? "text-foreground font-medium" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{doc.title}</span>
                      {active && <ChevronRight className="h-4 w-4 shrink-0" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>
    </aside>
  );
}