/**
 * Centralized UI component mocks for consistent testing
 * These mocks provide minimal implementations that preserve accessibility attributes
 */
import React from 'react';
import { vi } from 'vitest';

// Card components
export const Card = ({ children, role, className, ...props }: any) => (
  <div role={role} className={className} {...props}>
    {children}
  </div>
);

export const CardContent = ({ children, className }: any) => (
  <div className={className}>{children}</div>
);

export const CardHeader = ({ children, className }: any) => (
  <div className={className}>{children}</div>
);

export const CardTitle = ({ children, className }: any) => (
  <h3 className={className}>{children}</h3>
);

export const CardDescription = ({ children, className }: any) => (
  <p className={className}>{children}</p>
);

// Badge component
export const Badge = ({ children, className, variant }: any) => (
  <span className={className} data-variant={variant}>
    {children}
  </span>
);

// Avatar components
export const Avatar = React.forwardRef(({ children, className, style }: any, ref: any) => (
  <div ref={ref} className={className} style={style}>
    {children}
  </div>
));
Avatar.displayName = 'Avatar';

export const AvatarImage = ({ src, alt, onLoad, onError, className }: any) => (
  <img src={src} alt={alt} onLoad={onLoad} onError={onError} className={className} />
);

export const AvatarFallback = ({ children, className }: any) => (
  <div className={className}>{children}</div>
);

// Button component
export const Button = React.forwardRef(({ children, className, variant, size, ...props }: any, ref: any) => (
  <button ref={ref} className={className} data-variant={variant} data-size={size} {...props}>
    {children}
  </button>
));
Button.displayName = 'Button';

// Alert components  
export const Alert = ({ children, className, role = 'alert', ...props }: any) => (
  <div role={role} className={className} aria-live="assertive" {...props}>
    {children}
  </div>
);

export const AlertDescription = ({ children, className }: any) => (
  <div className={className}>{children}</div>
);

// Progress component
export const Progress = ({ value, className }: any) => (
  <div className={className} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div style={{ width: `${value}%` }} />
  </div>
);

// Skeleton component
export const Skeleton = ({ className }: any) => (
  <div className={className} aria-busy="true" aria-live="polite" />
);

// Icons (from lucide-react)
export const Trophy = () => <svg data-testid="trophy-icon" />;
export const Users = () => <svg data-testid="users-icon" />;
export const Calendar = () => <svg data-testid="calendar-icon" />;
export const TrendingUp = () => <svg data-testid="trending-icon" />;
export const AlertCircle = () => <svg data-testid="alert-circle-icon" />;
export const ChevronRight = () => <svg data-testid="chevron-right-icon" />;
export const GitPullRequest = () => <svg data-testid="git-pull-request-icon" />;
export const MessageCircle = () => <svg data-testid="message-circle-icon" />;
export const Star = () => <svg data-testid="star-icon" />;

// Utility function mock
export const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');