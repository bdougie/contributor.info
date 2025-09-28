/**
 * Reusable Permission Upgrade CTA Component
 * Displays upgrade prompts and permission denial messages consistently across the app
 */

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Crown,
  LogIn,
  Users,
  Shield,
  Settings,
  Database,
  BarChart3,
} from '@/components/ui/icon';
type IconComponent = (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { UpgradeMessage } from '@/lib/copy/upgrade-messages';

export interface PermissionUpgradeCTAProps {
  /**
   * The upgrade message configuration
   */
  message: UpgradeMessage;
  /**
   * Visual variant of the component
   */
  variant?: 'card' | 'alert' | 'inline' | 'modal';
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Optional icon override
   */
  icon?: IconComponent;
  /**
   * Optional click handler for custom actions
   */
  onAction?: () => void;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Whether to show the action button
   */
  showAction?: boolean;
}

/**
 * Get appropriate icon based on action type
 */
function getActionIcon(actionType?: string, fallback?: IconComponent): IconComponent {
  if (fallback) return fallback;

  switch (actionType) {
    case 'upgrade':
      return Crown;
    case 'login':
      return LogIn;
    case 'contact':
      return Users;
    default:
      return Shield;
  }
}

/**
 * Get appropriate button variant based on action type
 */
function getButtonVariant(actionType?: string): 'default' | 'outline' | 'secondary' | 'destructive' {
  switch (actionType) {
    case 'upgrade':
      return 'default';
    case 'login':
      return 'default'; // Changed to default to support orange styling
    case 'contact':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function PermissionUpgradeCTA({
  message,
  variant = 'card',
  size = 'md',
  icon,
  onAction,
  className,
  showAction = true,
}: PermissionUpgradeCTAProps) {
  const IconComponent = getActionIcon(message.actionType, icon);
  const buttonVariant = getButtonVariant(message.actionType);

  const ActionButton = () => {
    if (!showAction) return null;

    // Add orange styling for login buttons
    const buttonClassName = message.actionType === 'login'
      ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600'
      : '';

    if (message.actionHref && !onAction) {
      return (
        <Button
          asChild
          variant={buttonVariant}
          size={size === 'sm' ? 'sm' : 'default'}
          className={buttonClassName}
        >
          <Link to={message.actionHref}>{message.actionText}</Link>
        </Button>
      );
    }

    return (
      <Button
        onClick={onAction}
        disabled={!onAction}
        variant={buttonVariant}
        size={size === 'sm' ? 'sm' : 'default'}
        className={buttonClassName}
      >
        {message.actionText}
      </Button>
    );
  };

  // Modal variant (for use in dialogs)
  if (variant === 'modal') {
    return (
      <div className={cn('p-6 space-y-4 text-center', className)}>
        <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-muted">
          <IconComponent className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{message.title}</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">{message.description}</p>
        </div>
        <div className="flex justify-center pt-2">
          <ActionButton />
        </div>
      </div>
    );
  }

  // Inline variant (for replacing buttons or small UI elements)
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconComponent className="w-4 h-4" />
          <span>{message.title}</span>
        </div>
        <ActionButton />
      </div>
    );
  }

  // Alert variant
  if (variant === 'alert') {
    return (
      <Alert className={className}>
        <IconComponent className="h-4 w-4" />
        <AlertTitle>{message.title}</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-sm mb-3">{message.description}</p>
          <ActionButton />
        </AlertDescription>
      </Alert>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className={cn('pb-4', size === 'sm' && 'pb-2')}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-muted',
              size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
            )}
          >
            <IconComponent
              className={cn(
                'text-muted-foreground',
                size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
              )}
            />
          </div>
          <div className="flex-1">
            <CardTitle
              className={cn(
                'text-base',
                size === 'sm' && 'text-sm',
                size === 'lg' && 'text-lg'
              )}
            >
              {message.title}
            </CardTitle>
            <CardDescription
              className={cn(
                'mt-1',
                size === 'sm' && 'text-xs',
                size === 'lg' && 'text-sm'
              )}
            >
              {message.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {showAction && (
        <CardContent className={cn('pt-0', size === 'sm' && 'pb-3')}>
          <ActionButton />
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Specific CTA variants for common use cases
 */
export function GroupManagementCTA(props: Omit<PermissionUpgradeCTAProps, 'icon'>) {
  return <PermissionUpgradeCTA {...props} icon={Users} />;
}

export function AnalyticsCTA(props: Omit<PermissionUpgradeCTAProps, 'icon'>) {
  return <PermissionUpgradeCTA {...props} icon={BarChart3} />;
}

export function DataExportCTA(props: Omit<PermissionUpgradeCTAProps, 'icon'>) {
  return <PermissionUpgradeCTA {...props} icon={Database} />;
}

export function SettingsCTA(props: Omit<PermissionUpgradeCTAProps, 'icon'>) {
  return <PermissionUpgradeCTA {...props} icon={Settings} />;
}