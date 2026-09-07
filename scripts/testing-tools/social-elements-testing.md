# social elements testing

comprehensive testing suite for dub.co link shortening and social card generation systems.

## overview

this documentation covers the testing tools and procedures for validating the social sharing functionality in contributor.info, including:

- social card generation and delivery speed
- dub.co url shortening api integration
- open graph metadata verification
- performance benchmarking

## test files

### core testing scripts

located in `/scripts/testing-tools/`:

#### `test-social-card-speed.js`
comprehensive speed testing for social card generation from fly.io service.

**usage:**
```bash
node scripts/testing-tools/test-social-card-speed.js
```

**what it tests:**
- response times for 8 different card types
- cache header validation
- success rate monitoring
- network timing analysis
- performance assessment and recommendations

**sample output:**
```
🚀 Social Card Speed Test
Testing Home Card... ✅ 712ms (688-745ms)
Testing React Repo... ✅ 557ms (518-626ms)
Average Response Time: 579ms
Overall Success Rate: 100.0%
```

#### `test-dub-api-direct.js`
direct testing of dub.co api functionality without application dependencies.

**usage:**
```bash
# with api key
VITE_DUB_CO_KEY="dub_xxxxx" node scripts/testing-tools/test-dub-api-direct.js

# without api key (shows configuration info)
node scripts/testing-tools/test-dub-api-direct.js
```

**what it tests:**
- api key configuration validation
- url shortening functionality
- analytics endpoint access
- api response speed performance
- error handling scenarios

#### `test-social-elements.html`
interactive browser-based test suite for manual validation.

**usage:**
```bash
# start dev server
npm run dev

# open in browser
open http://localhost:5174/test-social-elements.html
```

**features:**
- environment variable validation
- interactive dub.co api testing
- social card url generation testing
- meta tags verification
- custom url testing with live preview

## testing procedures

### 1. social card speed testing

**objective:** ensure social cards load within acceptable time limits (<300ms target, <1s acceptable)

**process:**
1. run speed test script
2. analyze response times by card type
3. verify cache headers are present
4. check data source (database vs fallback)
5. assess overall performance grade

**key metrics:**
- average response time
- success rate percentage
- cache hit efficiency
- server processing time

### 2. dub.co integration testing

**objective:** validate url shortening works correctly in all environments

**process:**
1. verify api key configuration
2. test url shortening with various patterns
3. validate utm parameter injection
4. check analytics endpoint access
5. measure api response times

**environments:**
- development: should return original urls (no api calls)
- production: should create short urls with `oss.fyi` domain

### 3. meta tags validation

**objective:** ensure proper open graph and twitter card metadata

**process:**
1. check required og: properties
2. validate twitter card tags
3. verify image urls resolve correctly
4. test social card url generation
5. validate canonical urls

## performance benchmarks

### current performance standards

**social cards:**
- ✅ excellent: <200ms average
- 🟡 good: <500ms average  
- 🟠 fair: <1000ms average
- 🔴 poor: >1000ms average

**dub.co api:**
- ✅ excellent: <100ms
- 🟡 good: <300ms
- 🟠 fair: <500ms
- 🔴 poor: >500ms

### current test results (latest)

**social cards:** 🟠 fair (579ms average)
- fastest: next.js repo (497ms)
- slowest: home card (712ms)
- success rate: 100%

**dub.co:** ⚠️ configuration issue
- api key missing in development
- code structure: ✅ excellent
- fallback behavior: ✅ working

## troubleshooting

### common issues

#### social cards loading slowly
- check fly.io service status
- verify database connectivity
- analyze cache hit rates
- consider using fallback data

#### dub.co links not shortening
- verify `VITE_DUB_CO_KEY` environment variable
- check api key format (must start with `dub_`)
- confirm domain configuration (`oss.fyi` vs `dub.sh`)
- test api endpoint accessibility

#### meta tags not updating
- clear browser cache
- verify helmet configuration
- check react-helmet-async setup
- validate social meta provider

### debugging commands

```bash
# check social card service health
curl https://contributor-info-social-cards.fly.dev/health

# test specific social card
curl -I "https://contributor-info-social-cards.fly.dev/social-cards/repo?owner=facebook&repo=react"

# verify netlify environment
netlify env:list

# check browser console for errors
# (open browser dev tools on test page)
```

## environment configuration

### required environment variables

**development:**
```bash
VITE_DUB_CO_KEY="dub_xxxxx"  # optional, falls back gracefully
```

**production (netlify):**
```bash
VITE_DUB_CO_KEY="dub_xxxxx"  # required for url shortening
VITE_SUPABASE_URL="https://..."  # for social card data
VITE_SUPABASE_ANON_KEY="..."  # for social card data
```

### service dependencies

**social cards:**
- fly.io service: `contributor-info-social-cards.fly.dev`
- supabase database (optional, has fallbacks)
- cdn caching (cloudflare/netlify)

**dub.co integration:**
- dub.co api: `api.dub.co`
- custom domain: `oss.fyi` (production)
- analytics tracking (optional)

## maintenance

### regular checks

- **weekly:** run speed tests to monitor performance
- **monthly:** verify api key validity and quotas
- **quarterly:** review performance benchmarks and optimization opportunities

### optimization opportunities

1. **pre-generate popular repository cards**
2. **implement edge caching for faster delivery**
3. **optimize database queries for real-time data**
4. **add performance monitoring dashboard**

## related documentation

- `/docs/implementations/social-cards-deployment.md` - deployment guide
- `/fly-social-cards/README.md` - service architecture
- `/src/lib/dub.ts` - integration code
- `/src/components/features/sharing/shareable-card.tsx` - ui components