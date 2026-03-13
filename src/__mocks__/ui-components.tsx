/**
 * Centralized UI component mocks for consistent testing
 * These mocks provide minimal implementations that preserve accessibility attributes
 */
import React from 'react';

interface MockProps {
  children?: React.ReactNode;
  className?: string;
}

// Card components
export const Card = ({
  children,
  role,
  className,
  ...props
}: MockProps & React.HTMLAttributes<HTMLDivElement>) => (
  <div role={role} className={className} {...props}>
    {children}
  </div>
);

export const CardContent = ({ children, className }: MockProps) => (
  <div className={className}>{children}</div>
);

export const CardHeader = ({ children, className }: MockProps) => (
  <div className={className}>{children}</div>
);

export const CardTitle = ({ children, className }: MockProps) => (
  <h3 className={className}>{children}</h3>
);

export const CardDescription = ({ children, className }: MockProps) => (
  <p className={className}>{children}</p>
);

// Badge component
export const Badge = ({ children, className, variant }: MockProps & { variant?: string }) => (
  <span className={className} data-variant={variant}>
    {children}
  </span>
);

// Avatar components
export const Avatar = React.forwardRef<HTMLDivElement, MockProps & { style?: React.CSSProperties }>(
  ({ children, className, style }, ref) => (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
);
Avatar.displayName = 'Avatar';

export const AvatarImage = ({
  src,
  alt,
  onLoad,
  onError,
  className,
}: {
  src?: string;
  alt?: string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  className?: string;
}) => <img src={src} alt={alt} onLoad={onLoad} onError={onError} className={className} />;

export const AvatarFallback = ({ children, className }: MockProps) => (
  <div className={className}>{children}</div>
);

// Button component
export const Button = React.forwardRef<
  HTMLButtonElement,
  MockProps & { variant?: string; size?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, className, variant, size, ...props }, ref) => (
  <button ref={ref} className={className} data-variant={variant} data-size={size} {...props}>
    {children}
  </button>
));
Button.displayName = 'Button';

// Alert components
export const Alert = ({
  children,
  className,
  role = 'alert',
  ...props
}: MockProps & React.HTMLAttributes<HTMLDivElement>) => (
  <div role={role} className={className} aria-live="assertive" {...props}>
    {children}
  </div>
);

export const AlertDescription = ({ children, className }: MockProps) => (
  <div className={className}>{children}</div>
);

// Progress component
export const Progress = ({ value, className }: { value?: number; className?: string }) => (
  <div
    className={className}
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div style={{ width: `${value}%` }} />
  </div>
);

// Skeleton component
export const Skeleton = ({ className }: { className?: string }) => (
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

// eslint-disable-next-line react-refresh/only-export-components -- mock utility, not a component
export const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ');
