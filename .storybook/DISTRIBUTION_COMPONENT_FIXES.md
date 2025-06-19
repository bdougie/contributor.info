# Distribution Component Storybook Fixes

## Issues Identified

The Distribution component was experiencing issues in Storybook due to missing mocks for external dependencies. Here are the specific problems and solutions:

### 1. React Router DOM Dependencies

**Issue**: The Distribution component uses `useSearchParams` from `react-router-dom`, which fails in Storybook's isolated environment.

**Location**: `/src/components/features/distribution/distribution.tsx` (line 2, 24)

**Solution**: Created mock file `/Users/briandouglas/code/contributor.info/.storybook/mocks/react-router-dom.ts` with mocked implementations of:
- `useSearchParams()` - Returns empty URLSearchParams and a mock setter
- `useNavigate()` - Returns a function that logs navigation attempts
- `useLocation()`, `useParams()` - Return default values
- `BrowserRouter`, `MemoryRouter`, `Link`, `NavLink` - Return children or mock elements

### 2. Window Object Access in Zustand Store

**Issue**: The `useTimeRange` hook from `time-range-store.ts` accesses `window.innerWidth` and adds event listeners, which can cause issues in SSR or test environments.

**Location**: `/src/lib/time-range-store.ts` (lines 12, 29-40)

**Solution**: Added window object setup in Storybook preview decorator:
- Ensures `window.innerWidth` has a default value (1200px for desktop)
- Mocks `window.addEventListener` to handle resize/load events safely

### 3. Missing React Import in Mock

**Issue**: Initial mock file had JSX syntax without proper React import, causing build errors.

**Solution**: Used `React.createElement()` instead of JSX syntax in mock components to avoid import issues.

## Files Modified

### 1. Created: `.storybook/mocks/react-router-dom.ts`
- Complete mock implementation of react-router-dom hooks and components
- Provides console logging for debugging navigation attempts
- Uses React.createElement for component mocks to avoid JSX issues

### 2. Modified: `.storybook/main.ts`
- Added alias mapping for `react-router-dom` to use the mock file
- Ensures all react-router-dom imports are redirected to the mock during Storybook builds

### 3. Modified: `.storybook/preview.ts`
- Added window object initialization in decorators
- Ensures `window.innerWidth` is available with sensible default
- Maintains event listener functionality for stores that depend on window events

## How the Fixes Work

1. **Router Mock**: When the Distribution component imports `useSearchParams`, Vite redirects to our mock which provides a functional but isolated implementation.

2. **Window Setup**: The preview decorator runs before each story, ensuring window properties are available for Zustand stores.

3. **Context Provision**: The existing Distribution stories already provide proper `RepoStatsContext` values, so no changes were needed there.

## Verification

The fixes have been verified by:
1. Successfully building Storybook (`npm run build-storybook`)
2. Starting the Storybook dev server (`npm run storybook`)
3. Confirming all Distribution stories are included in the build output

The Distribution component should now work correctly in Storybook without the dependency-related errors that were previously occurring.

## Dependencies Successfully Mocked

- ✅ `react-router-dom` - All hooks and components
- ✅ `@/lib/supabase` - Already mocked
- ✅ Window object access - Handled in preview decorator
- ✅ Zustand stores - Work with window mock
- ✅ Context providers - Already properly provided in stories

## Future Considerations

If other components have similar router dependencies, they will automatically benefit from the react-router-dom mock. The window setup in the preview decorator also helps other components that may depend on window properties.