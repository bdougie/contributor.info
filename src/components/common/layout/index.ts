export { default as Layout } from './layout';
export { default as Home } from './home';
export { default as NotFound } from './not-found';
export { MetaTagsProvider, SocialMetaTags } from './meta-tags-provider';
export { SchemaMarkup } from './schema-markup';
// NOTE: Markdown is NOT exported here to prevent eager loading of react-markdown bundle (143KB)
// Import directly from '@/components/common/layout/markdown' when needed
