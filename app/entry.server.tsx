// Edge function entry point for Netlify
// This enables SSR on Netlify's global edge network for better LCP performance
// See: https://docs.netlify.com/build/frameworks/framework-setup-guides/react-router/
export { default } from 'virtual:netlify-server-entry';
