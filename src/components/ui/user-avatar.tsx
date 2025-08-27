interface UserAvatarProps {
  src: string;
  alt: string;
  size?: number;
  priority?: boolean;
  lazy?: boolean;
}

export function UserAvatar({
  src,
  alt,
  size = 48,
  priority = false,
  lazy = true,
}: UserAvatarProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full object-cover"
      loading={lazy && !priority ? 'lazy' : 'eager'}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        // Clear the onError handler to prevent infinite loops if fallback also fails
        target.onerror = null;
        target.src = `https://github.com/identicons/${encodeURIComponent(alt)}.png`;
      }}
    />
  );
}
