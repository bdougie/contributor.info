import { Helmet } from 'react-helmet-async';
import {
  generateSchemaMarkup,
  getPlatformSchemas,
  type Organization,
  type SoftwareApplication,
  type WebSite,
} from '@/lib/schema-org';

interface SchemaMarkupProps {
  /**
   * Additional schemas to include beyond the default platform schemas
   */
  additionalSchemas?: (Organization | SoftwareApplication | WebSite)[];
  /**
   * Whether to include the default platform schemas (SoftwareApplication + WebSite)
   * @default true
   */
  includePlatformSchemas?: boolean;
}

/**
 * Component that injects schema.org JSON-LD markup into the page head
 * Automatically includes platform-level schemas (SoftwareApplication, WebSite, Organization)
 * and allows for additional page-specific schemas
 */
export function SchemaMarkup({
  additionalSchemas = [],
  includePlatformSchemas = true,
}: SchemaMarkupProps) {
  const schemas = [...(includePlatformSchemas ? getPlatformSchemas() : []), ...additionalSchemas];

  if (schemas.length === 0) {
    return null;
  }

  const jsonLd = generateSchemaMarkup(schemas);

  return (
    <Helmet>
      <script type="application/ld+json">{jsonLd}</script>
    </Helmet>
  );
}
