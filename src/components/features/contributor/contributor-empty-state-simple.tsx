/**
 * Simplified, testable version of ContributorEmptyState
 * This is a pure presentational component with no external dependencies
 */
import { 
  getEmptyStateContent, 
  getBadgeLabel, 
  getBadgeColorClasses,
  type EmptyStateType 
} from "@/lib/contributor-empty-state-config";

interface EmptyStateProps {
  type: EmptyStateType;
  message?: string;
  suggestion?: string;
  className?: string;
  // Inject icon as a prop instead of importing from lucide-react
  renderIcon?: (iconName: string, iconColor: string) => React.ReactNode;
}

export function ContributorEmptyStateSimple({
  type,
  message,
  suggestion,
  className = "",
  renderIcon,
}: EmptyStateProps) {
  const content = getEmptyStateContent(type, message, suggestion);
  
  // Default icon renderer (just returns the icon name as text for testing)
  const iconRenderer = renderIcon || ((name, color) => (
    <div className={`icon-placeholder ${color}`} data-icon={name}>
      {name}
    </div>
  ));

  return (
    <div
      className={`contributor-empty-state ${className}`}
      role={content.severity === "error" ? "alert" : "status"}
      aria-live={content.severity === "error" ? "assertive" : "polite"}
    >
      <div className="empty-state-header">
        <h3 className="empty-state-title">
          <span className="icon-wrapper">
            {iconRenderer("trophy", "text-white")}
          </span>
          <span>Contributor of the Month</span>
        </h3>
      </div>

      <div className="empty-state-content">
        <div className={`content-wrapper bg-gradient-to-br ${content.bgColor}`}>
          <div className="icon-container">
            {iconRenderer(content.iconName, content.iconColor)}
          </div>

          <h3 className="content-title">{content.title}</h3>
          <p className="content-description">{content.description}</p>

          {content.suggestionText && (
            <div className="suggestion-wrapper">
              <span className={`badge ${getBadgeColorClasses(content.severity)}`}>
                {getBadgeLabel(content.severity)}
              </span>
              <p className="suggestion-text">{content.suggestionText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}