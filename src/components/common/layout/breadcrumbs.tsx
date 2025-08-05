import React from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const breadcrumbNameMap: { [key: string]: string } = {
  '': 'Home',
  'activity': 'Activity',
  'contributions': 'Contributions',
  'health': 'Health',
  'distribution': 'Distribution',
  'feed': 'Feed',
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const params = useParams();
  const { owner, repo } = params;
  const pathnames = location.pathname.split('/').filter((x) => x);

  const breadcrumbs = pathnames.map((value, index) => {
    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
    const isLast = index === pathnames.length - 1;
    let name = breadcrumbNameMap[value] || value;

    if (index === 0 && owner) name = owner;
    if (index === 1 && repo) name = repo;

    return {
      name,
      to,
      isLast,
    };
  });

  const homeBreadcrumb = { name: 'Home', to: '/', isLast: pathnames.length === 0 };
  const allBreadcrumbs = [homeBreadcrumb, ...breadcrumbs];

  const items = allBreadcrumbs.map((crumb) => (
    <React.Fragment key={crumb.to}>
      <BreadcrumbItem>
        {crumb.isLast ? (
          <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link to={crumb.to}>{crumb.name}</Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
      {!crumb.isLast && <BreadcrumbSeparator />}
    </React.Fragment>
  ));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': allBreadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': crumb.name,
      'item': `https://contributor.info${crumb.to}`,
    })),
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <Breadcrumb className="hidden md:flex mb-4">
        <BreadcrumbList>{items}</BreadcrumbList>
      </Breadcrumb>
    </>
  );
};
