# User Experience Documentation

This directory contains UX guidelines, patterns, and implementation strategies for contributor.info user interface design.

## Purpose

User Experience documentation helps developers:
- **Create consistent interfaces** - Standardized UX patterns and components
- **Improve usability** - Evidence-based design decisions and user feedback
- **Implement accessibility** - Inclusive design practices and compliance
- **Optimize performance** - User-centered performance improvements

## Documentation Index

### 📋 UX Guidelines & Patterns
- **[Implementation Checklist](./implementation-checklist.md)** - UX implementation validation checklist with enhanced patterns
- **[Feature Template](./feature-template.md)** - Standardized UX pattern template
- **[Invisible Data Loading](./invisible-data-loading.md)** - Netflix-like background data loading UX (Updated)
- **[New Repository Discovery](./new-repository-discovery.md)** - User experience guide for automatic repository setup **NEW**

### 📊 UX Analysis & Reports
- **[UX Summary](./SUMMARY.md)** - User experience analysis and improvements summary

## UX Design Principles

### 1. Invisible, Netflix-like Experience
The application follows a **database-first, background-processing** approach where users get immediate value while enhancements happen invisibly.

#### Core Principles:
- **Immediate value** - Show cached data instantly
- **Progressive enhancement** - Improve data quality in background
- **Subtle notifications** - Keep users informed without interruption
- **No manual intervention** - Automatic detection and improvement

#### Implementation Pattern:
```typescript
const useProgressiveData = (repository: string) => {
  const [data, setData] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  useEffect(() => {
    // 1. Show cached data immediately
    getCachedData(repository).then(setData);
    
    // 2. Enhance data in background
    setIsEnhancing(true);
    enhanceDataInBackground(repository)
      .then(enhancedData => {
        setData(enhancedData);
        showSubtleNotification('Data updated');
      })
      .finally(() => setIsEnhancing(false));
  }, [repository]);
  
  return { data, isEnhancing };
};
```

### 2. Mobile-First Responsive Design
All interfaces are designed mobile-first with progressive enhancement for larger screens.

#### Breakpoint Strategy:
```css
/* Mobile first (default) */
.component { 
  padding: 1rem; 
  grid-template-columns: 1fr;
}

/* Tablet and up */
@media (min-width: 768px) {
  .component { 
    padding: 2rem;
    grid-template-columns: 1fr 1fr;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .component { 
    padding: 3rem;
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 3. Performance-First UX
User experience is optimized for perceived performance and actual performance.

#### Performance UX Patterns:
- **Skeleton screens** - Show layout structure while loading
- **Progressive loading** - Load critical content first
- **Optimistic updates** - Show expected results immediately
- **Intelligent prefetching** - Predict and preload likely next actions

### 4. Accessible by Default
All components are built with accessibility as a foundational requirement, not an afterthought.

#### Accessibility Standards:
- **WCAG 2.1 AA compliance** - Meet international accessibility standards
- **Keyboard navigation** - Full keyboard operability
- **Screen reader support** - Semantic HTML and ARIA labels
- **Color contrast** - Minimum 4.5:1 contrast ratio

## Component UX Patterns

### Loading States

#### Skeleton Loading Pattern
```typescript
const SkeletonCard = () => (
  <div className=\"animate-pulse\">
    <div className=\"h-12 w-12 bg-gray-200 rounded-full mb-3\"></div>
    <div className=\"h-4 bg-gray-200 rounded w-3/4 mb-2\"></div>
    <div className=\"h-4 bg-gray-200 rounded w-1/2\"></div>
  </div>
);

const ContributorCard = ({ contributor }) => {
  if (!contributor) return <SkeletonCard />;
  
  return (
    <div className=\"contributor-card\">
      <img src={contributor.avatar_url} alt={contributor.username} />
      <h3>{contributor.username}</h3>
      <p>{contributor.contributions} contributions</p>
    </div>
  );
};
```

#### Progressive Enhancement Pattern
```typescript
const RepositoryView = ({ repository }) => {
  const { data: basicData } = useCachedData(repository);
  const { data: enhancedData, isLoading } = useEnhancedData(repository);
  
  const displayData = enhancedData || basicData;
  
  return (
    <div className=\"repository-view\">
      {displayData && (
        <>
          <RepositoryHeader data={displayData} />
          <ContributorList contributors={displayData.contributors} />
          {isLoading && (
            <SubtleNotification>
              Updating contributor data...
            </SubtleNotification>
          )}
        </>
      )}
    </div>
  );
};
```

### Error States

#### Graceful Error Handling
```typescript
const ErrorBoundary = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (error) => {
      console.error('UI Error:', error);
      setHasError(true);
      
      // Log error but don't break user experience
      Sentry.captureException(error);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return fallback || <DefaultErrorFallback />;
  }
  
  return children;
};

const DefaultErrorFallback = () => (
  <div className=\"error-state\">
    <h3>Something went wrong</h3>
    <p>We're working to fix this issue. Please try refreshing the page.</p>
    <button onClick={() => window.location.reload()}>
      Refresh Page
    </button>
  </div>
);
```

### Interactive States

#### Button States Pattern
```typescript
const Button = ({ 
  children, 
  loading = false, 
  disabled = false, 
  variant = 'primary',
  ...props 
}) => {
  return (
    <button
      className={cn(
        'btn',
        `btn-${variant}`,
        loading && 'btn-loading',
        disabled && 'btn-disabled'
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className=\"mr-2\" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};
```

## Data Visualization UX

### Chart Accessibility
```typescript
const AccessibleChart = ({ data, title, description }) => {
  return (
    <div className=\"chart-container\">
      <h3 id=\"chart-title\">{title}</h3>
      <p id=\"chart-description\">{description}</p>
      
      <div 
        role=\"img\" 
        aria-labelledby=\"chart-title\"
        aria-describedby=\"chart-description\"
      >
        <ResponsiveChart data={data} />
      </div>
      
      {/* Provide data table fallback */}
      <details className=\"chart-data-table\">
        <summary>View data table</summary>
        <table>
          <thead>
            <tr>
              {Object.keys(data[0] || {}).map(key => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {Object.values(row).map((value, i) => (
                  <td key={i}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};
```

### Interactive Data Exploration
```typescript\nconst InteractiveContributorList = ({ contributors }) => {\n  const [filters, setFilters] = useState({ search: '', sortBy: 'contributions' });\n  const [selectedContributor, setSelectedContributor] = useState(null);\n  \n  const filteredContributors = useMemo(() => {\n    return contributors\n      .filter(c => c.username.toLowerCase().includes(filters.search.toLowerCase()))\n      .sort((a, b) => b[filters.sortBy] - a[filters.sortBy]);\n  }, [contributors, filters]);\n  \n  return (\n    <div className=\"contributor-explorer\">\n      <div className=\"filters\">\n        <SearchInput \n          value={filters.search}\n          onChange={(search) => setFilters(f => ({ ...f, search }))}\n          placeholder=\"Search contributors...\"\n        />\n        <SortSelect\n          value={filters.sortBy}\n          onChange={(sortBy) => setFilters(f => ({ ...f, sortBy }))}\n          options={[\n            { value: 'contributions', label: 'Contributions' },\n            { value: 'recent_activity', label: 'Recent Activity' }\n          ]}\n        />\n      </div>\n      \n      <div className=\"contributor-grid\">\n        {filteredContributors.map(contributor => (\n          <ContributorCard\n            key={contributor.id}\n            contributor={contributor}\n            selected={selectedContributor?.id === contributor.id}\n            onClick={() => setSelectedContributor(contributor)}\n          />\n        ))}\n      </div>\n      \n      {selectedContributor && (\n        <ContributorDetailModal\n          contributor={selectedContributor}\n          onClose={() => setSelectedContributor(null)}\n        />\n      )}\n    </div>\n  );\n};\n```\n\n## Performance UX Optimization\n\n### Virtualization for Large Lists\n```typescript\nimport { FixedSizeList as List } from 'react-window';\n\nconst VirtualizedContributorList = ({ contributors }) => {\n  const itemHeight = 80;\n  const containerHeight = 400;\n  \n  const Row = ({ index, style }) => (\n    <div style={style}>\n      <ContributorCard contributor={contributors[index]} />\n    </div>\n  );\n  \n  return (\n    <List\n      height={containerHeight}\n      itemCount={contributors.length}\n      itemSize={itemHeight}\n      itemData={contributors}\n    >\n      {Row}\n    </List>\n  );\n};\n```\n\n### Image Optimization\n```typescript\nconst OptimizedAvatar = ({ src, alt, size = 48 }) => {\n  const [loaded, setLoaded] = useState(false);\n  const [error, setError] = useState(false);\n  \n  return (\n    <div className=\"avatar-container\" style={{ width: size, height: size }}>\n      {!loaded && !error && (\n        <div className=\"avatar-skeleton animate-pulse bg-gray-200\" />\n      )}\n      \n      <img\n        src={`${src}&s=${size * 2}`} // 2x for high DPI\n        alt={alt}\n        width={size}\n        height={size}\n        loading=\"lazy\"\n        onLoad={() => setLoaded(true)}\n        onError={() => setError(true)}\n        className={cn(\n          'avatar',\n          loaded ? 'opacity-100' : 'opacity-0',\n          'transition-opacity duration-200'\n        )}\n      />\n      \n      {error && (\n        <div className=\"avatar-fallback\">\n          {alt?.[0]?.toUpperCase() || '?'}\n        </div>\n      )}\n    </div>\n  );\n};\n```\n\n## Notification System\n\n### Subtle Notification Pattern\n```typescript\nconst NotificationSystem = () => {\n  const { notifications, removeNotification } = useNotifications();\n  \n  return (\n    <div className=\"notification-container fixed top-4 right-4 z-50\">\n      <AnimatePresence>\n        {notifications.map(notification => (\n          <motion.div\n            key={notification.id}\n            initial={{ opacity: 0, y: -50 }}\n            animate={{ opacity: 1, y: 0 }}\n            exit={{ opacity: 0, y: -50 }}\n            className={cn(\n              'notification',\n              `notification-${notification.type}`,\n              'mb-2 p-3 rounded-lg shadow-lg'\n            )}\n          >\n            <div className=\"notification-content\">\n              {notification.icon && (\n                <notification.icon className=\"w-5 h-5 mr-2\" />\n              )}\n              <span>{notification.message}</span>\n            </div>\n            \n            {notification.action && (\n              <button\n                onClick={notification.action.onClick}\n                className=\"notification-action\"\n              >\n                {notification.action.label}\n              </button>\n            )}\n            \n            <button\n              onClick={() => removeNotification(notification.id)}\n              className=\"notification-close\"\n              aria-label=\"Close notification\"\n            >\n              ×\n            </button>\n          </motion.div>\n        ))}\n      </AnimatePresence>\n    </div>\n  );\n};\n```\n\n## Mobile UX Considerations\n\n### Touch-Friendly Interactions\n```css\n/* Minimum touch target size */\n.touch-target {\n  min-height: 44px;\n  min-width: 44px;\n}\n\n/* Touch feedback */\n.interactive:active {\n  transform: scale(0.98);\n  opacity: 0.8;\n}\n\n/* Prevent zoom on inputs */\ninput, select, textarea {\n  font-size: 16px; /* Prevents zoom on iOS */\n}\n```\n\n### Mobile Navigation Pattern\n```typescript\nconst MobileNavigation = () => {\n  const [isOpen, setIsOpen] = useState(false);\n  \n  return (\n    <>\n      <button\n        className=\"mobile-menu-button md:hidden\"\n        onClick={() => setIsOpen(!isOpen)}\n        aria-label=\"Toggle navigation menu\"\n      >\n        <MenuIcon />\n      </button>\n      \n      <AnimatePresence>\n        {isOpen && (\n          <motion.nav\n            initial={{ x: '-100%' }}\n            animate={{ x: 0 }}\n            exit={{ x: '-100%' }}\n            className=\"mobile-nav fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg\"\n          >\n            <div className=\"mobile-nav-content p-4\">\n              {/* Navigation items */}\n            </div>\n          </motion.nav>\n        )}\n      </AnimatePresence>\n      \n      {/* Backdrop */}\n      {isOpen && (\n        <div\n          className=\"fixed inset-0 bg-black bg-opacity-50 z-40\"\n          onClick={() => setIsOpen(false)}\n        />\n      )}\n    </>\n  );\n};\n```\n\n## UX Testing & Validation\n\n### User Testing Integration\n```typescript\n// A/B testing for UX improvements\nconst useABTest = (testName: string, variants: string[]) => {\n  const [variant] = useState(() => {\n    const stored = localStorage.getItem(`ab-test-${testName}`);\n    if (stored && variants.includes(stored)) return stored;\n    \n    const randomVariant = variants[Math.floor(Math.random() * variants.length)];\n    localStorage.setItem(`ab-test-${testName}`, randomVariant);\n    \n    // Track assignment\n    trackEvent('ab_test_assigned', {\n      test_name: testName,\n      variant: randomVariant\n    });\n    \n    return randomVariant;\n  });\n  \n  return variant;\n};\n\n// Usage\nconst ContributorListVariant = () => {\n  const variant = useABTest('contributor-list-layout', ['grid', 'list']);\n  \n  return variant === 'grid' ? (\n    <ContributorGrid contributors={contributors} />\n  ) : (\n    <ContributorList contributors={contributors} />\n  );\n};\n```\n\n### UX Metrics Collection\n```typescript\n// Performance UX metrics\nconst useUXMetrics = () => {\n  useEffect(() => {\n    // Time to interactive\n    const observer = new PerformanceObserver((list) => {\n      const entries = list.getEntries();\n      entries.forEach((entry) => {\n        if (entry.entryType === 'navigation') {\n          trackEvent('ux_timing', {\n            metric: 'time_to_interactive',\n            value: entry.loadEventEnd - entry.fetchStart\n          });\n        }\n      });\n    });\n    \n    observer.observe({ entryTypes: ['navigation'] });\n    \n    // User engagement\n    const startTime = Date.now();\n    return () => {\n      const sessionDuration = Date.now() - startTime;\n      trackEvent('ux_engagement', {\n        session_duration: sessionDuration\n      });\n    };\n  }, []);\n};\n```\n\n## Related Documentation\n\n- [Implementation Checklist](./implementation-checklist.md) - UX validation checklist\n- [Feature Template](./feature-template.md) - Standardized UX patterns\n- [Testing Documentation](../testing/) - UX testing strategies\n- [Accessibility Guidelines](../setup/) - Accessibility implementation\n\n---\n\n**UX Philosophy**: Design for the user's success, not just the interface's beauty. Every interaction should feel effortless and purposeful.