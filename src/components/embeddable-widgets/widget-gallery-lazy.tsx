import { lazy, Suspense } from 'react';
import { WidgetGallerySkeleton } from './WidgetGallerySkeleton';

// Lazy load the widget gallery with all its chart dependencies
const WidgetGalleryInner = lazy(() => 
  import('./widget-gallery').then(module => ({
    default: module.WidgetGallery
  }))
);

interface WidgetGalleryProps {
  owner?: string;
  repo?: string;
  data?: any;
}

export function LazyWidgetGallery(props: WidgetGalleryProps) {
  return (
    <Suspense fallback={<WidgetGallerySkeleton />}>
      <WidgetGalleryInner {...props} />
    </Suspense>
  );
}