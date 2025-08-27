import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/common/theming';
import { SocialMetaTags } from '@/components/common/layout/meta-tags-provider';
import '@/index.css';

interface CardLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export default function CardLayout({
  children,
  title = 'contributor.info - Open Source Contributions',
  description = 'Visualizing GitHub contributors and their contributions.',
  image = 'social-cards/home-card.png',
  url,
}: CardLayoutProps) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <SocialMetaTags
        title={title}
        description={description}
        image={image}
        url={url}
        type="website"
        twitterCard="summary_large_image"
      />
      <div className="min-h-screen bg-background antialiased social-card-layout">{children}</div>
    </ThemeProvider>
  );
}
