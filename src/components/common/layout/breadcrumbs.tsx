import React from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useIsMobile } from '@/lib/utils/mobile-detection';
import { cn } from '@/lib/utils';

const breadcrumbNameMap: { [key: string]: string } = {
  '': 'home',
  'activity': 'activity',
  'contributions': 'activity',
  'health': 'health',
  'lottery': 'health',
  'distribution': 'distribution',
  'feed': 'feed',
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const params = useParams();
  const { owner, repo, org } = params;
  const isMobile = useIsMobile();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const breadcrumbs = pathnames.map((value, index) => {
    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
    const isLast = index === pathnames.length - 1;
    let name = breadcrumbNameMap[value] || value;

    // Handle organization page
    if (index === 0 && org) name = org;
    // Handle repository pages
    if (index === 0 && owner) name = owner;
    if (index === 1 && repo) name = repo;

    return {
      name,
      to,
      isLast,
      isStatic: false,
    };
  });

  const homeBreadcrumb = { name: 'home', to: '/', isLast: pathnames.length === 0, isStatic: false };
  const allBreadcrumbs = [homeBreadcrumb, ...breadcrumbs];

  // Mobile-optimized breadcrumb logic
  const getMobileBreadcrumbs = () => {
    if (allBreadcrumbs.length <= 2) {
      return allBreadcrumbs;
    }
    
    // For mobile, show: Home > ... > Current (max 3 items)
    const current = allBreadcrumbs[allBreadcrumbs.length - 1];
    const parent = allBreadcrumbs[allBreadcrumbs.length - 2];
    
    return [
      homeBreadcrumb,
      ...(allBreadcrumbs.length > 3 ? [{ name: '…', to: '', isLast: false, isStatic: true }] : []),
      ...(parent ? [parent] : []),
      current
    ];
  };

  const displayBreadcrumbs = isMobile ? getMobileBreadcrumbs() : allBreadcrumbs;
  
  // Back button for mobile navigation
  const getBackButton = () => {
    if (!isMobile || allBreadcrumbs.length <= 1) return null;
    
    const parentCrumb = allBreadcrumbs[allBreadcrumbs.length - 2];
    // Only truncate if the name is actually long (> 20 chars)
    const shouldTruncate = parentCrumb.name.length > 20;
    
    return (
      <Link
        to={parentCrumb.to}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        aria-label={`Go back to ${parentCrumb.name}`}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className={cn(shouldTruncate && "truncate max-w-[200px]")}>{parentCrumb.name}</span>
      </Link>
    );
  };

  const items = displayBreadcrumbs.map((crumb) => (
    <React.Fragment key={crumb.to || crumb.name}>
      <BreadcrumbItem>
        {crumb.isLast ? (
          <BreadcrumbPage className={cn(isMobile && 'text-sm font-medium')}>{crumb.name}</BreadcrumbPage>
        ) : crumb.isStatic ? (
          <span className="text-muted-foreground">{crumb.name}</span>
        ) : (
          <BreadcrumbLink asChild>
            <Link to={crumb.to} className={cn(isMobile && 'text-sm')}>{crumb.name}</Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
      {!crumb.isLast && <BreadcrumbSeparator />}
    </React.Fragment>
  ));

  // Use dynamic origin for JSON-LD to support different environments
  const origin = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://contributor.info';
    
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': allBreadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': crumb.name,
      'item': `${origin}${crumb.to}`,
    })),
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      
      {/* Mobile: Pinned breadcrumb with back button */}
      {isMobile ? (
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b md:hidden">
          <div className="container px-4 py-2">
            {getBackButton()}
            <div 
              className="overflow-x-auto overflow-y-hidden scrollbar-hide"
              aria-label="Breadcrumb navigation"
              role="navigation"
            >
              <Breadcrumb className="whitespace-nowrap">
                <BreadcrumbList className="flex-nowrap">{items}</BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
        </div>
      ) : (
        /* Desktop: Standard breadcrumb */
        <Breadcrumb className="hidden md:flex mb-4">
          <BreadcrumbList>{items}</BreadcrumbList>
        </Breadcrumb>
      )}
    </>
  );
};
