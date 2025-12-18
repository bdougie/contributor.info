# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.1](https://github.com/bdougie/contributor.info/compare/v4.0.0...v4.0.1) (2025-12-18)


### 🐛 Bug Fixes

* enable automatic releases on push to main ([f3799ea](https://github.com/bdougie/contributor.info/commit/f3799ea58a57f31aa42093c5e3cc97671e171ff2)), closes [#1413](https://github.com/bdougie/contributor.info/issues/1413)
* refactor polar-webhook to use @polar-sh/sdk directly ([#1412](https://github.com/bdougie/contributor.info/issues/1412)) ([809a794](https://github.com/bdougie/contributor.info/commit/809a7940974e2b1e0e6e6f39435ef30f224bb08c))


### 🔧 Maintenance

* update tracked repositories list [skip ci] ([f2d0e76](https://github.com/bdougie/contributor.info/commit/f2d0e76776242a5d367729ec14e6e30e8e18094f))

## [4.0.0](https://github.com/bdougie/contributor.info/compare/v3.0.0...v4.0.0) (2025-12-18)


### ⚠ BREAKING CHANGES

* Webhook-based Slack integrations are no longer supported.
All integrations must use OAuth flow via 'Add to Slack' button.

* cleanup: remove Netlify env var documentation

Removed temporary documentation files for Netlify 4KB limit fix

* fix: address critical security and functionality issues in Slack integration

Security Fixes:
- Add OAuth state validation to prevent CSRF attacks
- Store OAuth states in database with expiration
- Validate state exists, hasn't expired, and hasn't been used

Functionality Fixes:
- Restore webhook support alongside OAuth integration
- Fix channel selection UI after OAuth flow
- Add pagination support for Slack channels API (cursor-based)
- Fix weekly scheduling calculation (Sunday -> Monday = 1 day, not 8)
- Handle both bot_token and webhook_url in cron jobs

Database & Type Fixes:
- Add oauth_states table with proper constraints
- Update type definitions to support both OAuth and webhook
- Fix unique constraint handling for NULL values
- Include all required fields in database queries

Documentation:
- Update .env.example with SLACK_WEBHOOK_ENCRYPTION_KEY
- Clarify server-side vs client-side environment variables

### 🚀 Features

* add alerting and monitoring for repository tracking ([#1338](https://github.com/bdougie/contributor.info/issues/1338)) ([633878a](https://github.com/bdougie/contributor.info/commit/633878a1343ac43c0fda193029559bf06477b516)), closes [#1326](https://github.com/bdougie/contributor.info/issues/1326)
* Add confidence tracking over time infrastructure ([#1170](https://github.com/bdougie/contributor.info/issues/1170)) ([13cc59f](https://github.com/bdougie/contributor.info/commit/13cc59f736e0a36c8c9761967ead3bc6c30838a4)), closes [#139](https://github.com/bdougie/contributor.info/issues/139) [#139](https://github.com/bdougie/contributor.info/issues/139)
* add copyable suggestions to docs review action ([#1126](https://github.com/bdougie/contributor.info/issues/1126)) ([8f8fca5](https://github.com/bdougie/contributor.info/commit/8f8fca5da91e03992b61e910bf9d01e9f27aefff)), closes [/github.com/bdougie/contributor.info/pull/862#discussion_r2389945230](https://github.com/bdougie//github.com/bdougie/contributor.info/pull/862/issues/discussion_r2389945230)
* Add heatmap visualization for file activity tracking ([#1181](https://github.com/bdougie/contributor.info/issues/1181)) ([5616b65](https://github.com/bdougie/contributor.info/commit/5616b659f629edca9f13e3bf971a250bdc8328ea)), closes [#1180](https://github.com/bdougie/contributor.info/issues/1180)
* add missing find_similar_pull_requests_in_workspace function ([#1139](https://github.com/bdougie/contributor.info/issues/1139)) ([6e9f5e9](https://github.com/bdougie/contributor.info/commit/6e9f5e90af392442949ca94137d9bd624d90b825)), closes [#1128](https://github.com/bdougie/contributor.info/issues/1128) [#1128](https://github.com/bdougie/contributor.info/issues/1128)
* add Netlify Edge Function for dynamic social meta tags ([#1308](https://github.com/bdougie/contributor.info/issues/1308)) ([172ed95](https://github.com/bdougie/contributor.info/commit/172ed9508f9224d724496d481df502264211eedd)), closes [#1304](https://github.com/bdougie/contributor.info/issues/1304)
* add non-blocking Sentry error tracking integration ([#1200](https://github.com/bdougie/contributor.info/issues/1200)) ([b2eac93](https://github.com/bdougie/contributor.info/commit/b2eac93fec5224d6ec556073971b2415c3a2c97a))
* add observability for repository tracking flow ([#1323](https://github.com/bdougie/contributor.info/issues/1323)) ([#1331](https://github.com/bdougie/contributor.info/issues/1331)) ([dfb4c34](https://github.com/bdougie/contributor.info/commit/dfb4c341b60b7dd71e5ee1263f49aedab13f81f5))
* Add pagination to my work ([#1167](https://github.com/bdougie/contributor.info/issues/1167)) ([724bfc3](https://github.com/bdougie/contributor.info/commit/724bfc31e826c42c0f5fdeace5ceb72c83645119)), closes [#3386416639](https://github.com/bdougie/contributor.info/issues/3386416639) [#1](https://github.com/bdougie/contributor.info/issues/1) [#2](https://github.com/bdougie/contributor.info/issues/2)
* add Playwright chart screenshot service and delete orphaned stub ([#1321](https://github.com/bdougie/contributor.info/issues/1321)) ([3a7eba7](https://github.com/bdougie/contributor.info/commit/3a7eba773f8f9f8eefb1442aba30d5fd2fc580e7)), closes [#1306](https://github.com/bdougie/contributor.info/issues/1306)
* add S3 persistent storage for edge functions ([#1300](https://github.com/bdougie/contributor.info/issues/1300)) ([87016d1](https://github.com/bdougie/contributor.info/commit/87016d1bca118a2adcff347c5492cd70a9077b4c)), closes [#908](https://github.com/bdougie/contributor.info/issues/908)
* add Sentry error tracking to edge functions ([#1302](https://github.com/bdougie/contributor.info/issues/1302)) ([ee11b29](https://github.com/bdougie/contributor.info/commit/ee11b29bf7e03c78538bce78bb33e5bed349d40d)), closes [#1301](https://github.com/bdougie/contributor.info/issues/1301)
* Add Sentry error tracking to Netlify Edge Functions ([#1316](https://github.com/bdougie/contributor.info/issues/1316)) ([657cf27](https://github.com/bdougie/contributor.info/commit/657cf27bca502ed352e9c563cc5461468c62c47a)), closes [#1309](https://github.com/bdougie/contributor.info/issues/1309)
* add shareable card functionality to Activity Metrics and Trends ([#1329](https://github.com/bdougie/contributor.info/issues/1329)) ([8ed095a](https://github.com/bdougie/contributor.info/commit/8ed095a28fb950af0f6f6c7712ae2e0a1f984bf9))
* add side-by-side charts with expand/collapse in TrendChart story ([#1230](https://github.com/bdougie/contributor.info/issues/1230)) ([783e41c](https://github.com/bdougie/contributor.info/commit/783e41cae34547977ed5729332f7aa84dfd2c0e9))
* add Slack integration for workspace issue assignee reports ([#1193](https://github.com/bdougie/contributor.info/issues/1193)) ([6c410fc](https://github.com/bdougie/contributor.info/commit/6c410fc3f8a25d65a6a2dac3cbeca736109dc603)), closes [/github.com/bdougie/contributor.info/pull/1193#issuecomment-3505408572](https://github.com/bdougie//github.com/bdougie/contributor.info/pull/1193/issues/issuecomment-3505408572)
* add workspace spam tab with horizontally scrollable table ([#1334](https://github.com/bdougie/contributor.info/issues/1334)) ([7131c6d](https://github.com/bdougie/contributor.info/commit/7131c6d4ef3da66404ba34b3f603c0fd39932d10))
* AI-Powered Contributor Enrichment System ([#1146](https://github.com/bdougie/contributor.info/issues/1146)) ([af36410](https://github.com/bdougie/contributor.info/commit/af3641081fbd75e0e5a216a4e883d41250161794)), closes [#1145](https://github.com/bdougie/contributor.info/issues/1145)
* **analytics:** add PLG tracking for high-value user flows ([#1251](https://github.com/bdougie/contributor.info/issues/1251)) ([fe67a68](https://github.com/bdougie/contributor.info/commit/fe67a68690434af8104792a35296a355cf794bcd)), closes [#1236](https://github.com/bdougie/contributor.info/issues/1236)
* **analytics:** add PostHog tracking for workspace sync ([#1385](https://github.com/bdougie/contributor.info/issues/1385)) ([df3ff01](https://github.com/bdougie/contributor.info/commit/df3ff01775cff827493e5d9440ff1a971e05f3eb))
* **billing:** add observability to billing flow ([#1391](https://github.com/bdougie/contributor.info/issues/1391)) ([85152fa](https://github.com/bdougie/contributor.info/commit/85152fa960ab89c45cdcc3fb55ac8330715dfbde))
* **deps:** update react-router-dom to 6.30.2 for React 19 compatibility ([#1297](https://github.com/bdougie/contributor.info/issues/1297)) ([1b39b85](https://github.com/bdougie/contributor.info/commit/1b39b858d98ed32cdfbffb589ca3b16e6141511f)), closes [#1189](https://github.com/bdougie/contributor.info/issues/1189) [#1294](https://github.com/bdougie/contributor.info/issues/1294)
* Edge SSR for public pages (LCP improvement) ([#1379](https://github.com/bdougie/contributor.info/issues/1379)) ([52764b7](https://github.com/bdougie/contributor.info/commit/52764b7b1ba4397135a683fcd51ca1d4a7505122)), closes [#1374](https://github.com/bdougie/contributor.info/issues/1374) [#1378](https://github.com/bdougie/contributor.info/issues/1378)
* Enhance AI contributor summaries with discussion and issue context ([#1140](https://github.com/bdougie/contributor.info/issues/1140)) ([6465448](https://github.com/bdougie/contributor.info/commit/6465448a30488f3aaa985d57484d7d2805ecf587))
* enhance contributor summary specificity and fix truncation ([#1141](https://github.com/bdougie/contributor.info/issues/1141)) ([7266f85](https://github.com/bdougie/contributor.info/commit/7266f8560f467174eda45b4378a9bba570381539)), closes [#803](https://github.com/bdougie/contributor.info/issues/803)
* **error-handling:** complete Sentry error logging migration in workspace.service.ts ([#1221](https://github.com/bdougie/contributor.info/issues/1221)) ([6dd5e04](https://github.com/bdougie/contributor.info/commit/6dd5e042136c6c59901694dc09b9aca38464621f))
* include linked issues from comments in similarity embeddings ([#1373](https://github.com/bdougie/contributor.info/issues/1373)) ([1ce5e67](https://github.com/bdougie/contributor.info/commit/1ce5e6743e96c055efe094c6d5d666a0528594c6))
* Limit Issue Assignee Distribution to 5 visible items ([#1288](https://github.com/bdougie/contributor.info/issues/1288)) ([fcdc213](https://github.com/bdougie/contributor.info/commit/fcdc213f69f178e2d05fd3aada001932c32c3bdc))
* migrate to CodeBunny for code reviews ([#1152](https://github.com/bdougie/contributor.info/issues/1152)) ([ed9c7bd](https://github.com/bdougie/contributor.info/commit/ed9c7bd2cadbf4c6ed458c29d38662f667461195))
* **performance:** optimize assignee distribution chart with database aggregation ([#1184](https://github.com/bdougie/contributor.info/issues/1184)) ([5b5e5f6](https://github.com/bdougie/contributor.info/commit/5b5e5f685ba140e3d49d438e71d9114016bfa85c)), closes [#1182](https://github.com/bdougie/contributor.info/issues/1182)
* Phase 2 AI-powered contributor enrichment ([#803](https://github.com/bdougie/contributor.info/issues/803)) ([#1143](https://github.com/bdougie/contributor.info/issues/1143)) ([f07f7ac](https://github.com/bdougie/contributor.info/commit/f07f7ac8643e294b36e9c1bc3a99e4122738fdf0))
* remove Storybook dependencies and configuration ([#1328](https://github.com/bdougie/contributor.info/issues/1328)) ([a3a5a56](https://github.com/bdougie/contributor.info/commit/a3a5a56b1aeb168244c00191f67fbc98fa846cfc)), closes [#1324](https://github.com/bdougie/contributor.info/issues/1324)
* **router:** add React Router v7 future flags to prevent breaking changes ([#1240](https://github.com/bdougie/contributor.info/issues/1240)) ([2871a71](https://github.com/bdougie/contributor.info/commit/2871a71d62bcbd9458e9476e436cd2f4fa270d45))
* **sentry:** add centralized error logging integration ([#1218](https://github.com/bdougie/contributor.info/issues/1218)) ([468b609](https://github.com/bdougie/contributor.info/commit/468b6096324d3c34af1a8c4da407df18aac892a9))
* **slack:** add channel search and disconnect integration button ([#1211](https://github.com/bdougie/contributor.info/issues/1211)) ([5deb870](https://github.com/bdougie/contributor.info/commit/5deb870d50fa90b7b59e11cf1aefd3ae4e56f7ad))
* **social-cards:** simplify design to match public/social.png ([2f8c657](https://github.com/bdougie/contributor.info/commit/2f8c6578cdd3a204a7bde5156ce0d8b88d2822ef))
* Standardize embedding dimensions to 384 across all entities ([#1142](https://github.com/bdougie/contributor.info/issues/1142)) ([4856e56](https://github.com/bdougie/contributor.info/commit/4856e569c62247de69dc8714ec1068469da0ebd2))
* **ui:** add user profile information to contributor profile modal ([#1138](https://github.com/bdougie/contributor.info/issues/1138)) ([ed8c298](https://github.com/bdougie/contributor.info/commit/ed8c2986d34606b5646710849baf5e3132daa8b1)), closes [#1129](https://github.com/bdougie/contributor.info/issues/1129) [#1129](https://github.com/bdougie/contributor.info/issues/1129)
* **ui:** display title and issue number in Similar Items modal ([#1120](https://github.com/bdougie/contributor.info/issues/1120)) ([be70354](https://github.com/bdougie/contributor.info/commit/be703547c36ca0782cff0f5dc59e28998d15236a))
* **ui:** make issue/discussion numbers clickable links in similar items modal ([90a272c](https://github.com/bdougie/contributor.info/commit/90a272cda472743ec27a7cab53020d5e8a798b70)), closes [#123](https://github.com/bdougie/contributor.info/issues/123)
* **ui:** replace pgvector with TanStack/table in example repos ([#1375](https://github.com/bdougie/contributor.info/issues/1375)) ([3c8d804](https://github.com/bdougie/contributor.info/commit/3c8d804ae16c4de333c7ae4bfe91e4b73d859f48))
* upgrade to React 19 ([#1299](https://github.com/bdougie/contributor.info/issues/1299)) ([87b6571](https://github.com/bdougie/contributor.info/commit/87b657109f761e40faed12089b02814ff81022cb)), closes [#1232](https://github.com/bdougie/contributor.info/issues/1232) [#1295](https://github.com/bdougie/contributor.info/issues/1295)
* workspace-level backfill for Extended Data Retention addon ([#1154](https://github.com/bdougie/contributor.info/issues/1154)) ([d7b349c](https://github.com/bdougie/contributor.info/commit/d7b349ce18020f9dcd613298940da4d646634553)), closes [#1153](https://github.com/bdougie/contributor.info/issues/1153) [#3438082308](https://github.com/bdougie/contributor.info/issues/3438082308)
* **workspace:** add faster issue assignee refresh with page visibility sync ([#1124](https://github.com/bdougie/contributor.info/issues/1124)) ([61f21fc](https://github.com/bdougie/contributor.info/commit/61f21fcff9705b04a90e37d741b60313a46465f1))
* **workspace:** add issues tabs with response filtering and refactoring ([#1130](https://github.com/bdougie/contributor.info/issues/1130)) ([0b0a39a](https://github.com/bdougie/contributor.info/commit/0b0a39af661e24c75825a17d77ba32369f269cc2))
* **workspace:** add shareable cards to workspace metrics ([#1350](https://github.com/bdougie/contributor.info/issues/1350)) ([5a57431](https://github.com/bdougie/contributor.info/commit/5a574311f58908d287afd5da8a54af915429c615))
* **workspace:** auto-sync comments for Replies tab with quality improvements ([#1137](https://github.com/bdougie/contributor.info/issues/1137)) ([7df9201](https://github.com/bdougie/contributor.info/commit/7df92016d6b1b5515082d374fc3782c5f1fdeaae)), closes [#1131](https://github.com/bdougie/contributor.info/issues/1131) [#1131](https://github.com/bdougie/contributor.info/issues/1131) [#1131](https://github.com/bdougie/contributor.info/issues/1131)
* **workspace:** calculate total stars for workspaces in list view ([#1355](https://github.com/bdougie/contributor.info/issues/1355)) ([b1473c8](https://github.com/bdougie/contributor.info/commit/b1473c8aaa7eaef34671907cb220b2ed41b356c9))
* **workspace:** make remaining workspace charts shareable ([#1356](https://github.com/bdougie/contributor.info/issues/1356)) ([f3d064e](https://github.com/bdougie/contributor.info/commit/f3d064e2ea9ea2303f3fb18094abae6ced9a9bdd))
* **workspace:** make remaining workspace charts shareable ([#1361](https://github.com/bdougie/contributor.info/issues/1361)) ([94fe50c](https://github.com/bdougie/contributor.info/commit/94fe50c0368126cc76d9273b84b6cc5572520b5b)), closes [#1341](https://github.com/bdougie/contributor.info/issues/1341)


### 🐛 Bug Fixes

* actions/continue-docs-review/package.json & actions/continue-docs-review/package-lock.json to reduce vulnerabilities ([#1241](https://github.com/bdougie/contributor.info/issues/1241)) ([536e060](https://github.com/bdougie/contributor.info/commit/536e06062e6f8524589df2ea31fab611ff1dc618))
* add @types/papaparse to TypeScript types array ([#1229](https://github.com/bdougie/contributor.info/issues/1229)) ([3fbffac](https://github.com/bdougie/contributor.info/commit/3fbffac8aef6677734a1154c609d47b36cc2c7aa))
* add missing workspace user relations and foreign keys ([#1148](https://github.com/bdougie/contributor.info/issues/1148)) ([0af272f](https://github.com/bdougie/contributor.info/commit/0af272fd266de94060a363cb3410fd8e193d5882)), closes [#1147](https://github.com/bdougie/contributor.info/issues/1147) [#1147](https://github.com/bdougie/contributor.info/issues/1147) [#1147](https://github.com/bdougie/contributor.info/issues/1147) [#1147](https://github.com/bdougie/contributor.info/issues/1147)
* add rate limit handling for discussion capture with exponential … ([#1150](https://github.com/bdougie/contributor.info/issues/1150)) ([b40ba79](https://github.com/bdougie/contributor.info/commit/b40ba79b9be7a89901b12454082b5bca31c9e6b3))
* add retry logic for browser page creation race condition ([f1a4737](https://github.com/bdougie/contributor.info/commit/f1a4737ac503dc5ea2f486e886d44a8421d4dcbb))
* add service_role INSERT policy for issues table ([#1163](https://github.com/bdougie/contributor.info/issues/1163)) ([6ccb785](https://github.com/bdougie/contributor.info/commit/6ccb785274cba652e8f54e7425e277b86e8c9b0e))
* add skeleton loaders to Issues tab to prevent CLS ([#1262](https://github.com/bdougie/contributor.info/issues/1262)) ([#1266](https://github.com/bdougie/contributor.info/issues/1266)) ([f106535](https://github.com/bdougie/contributor.info/commit/f106535b5ddc8caa2c8c99e84d0f24efc8ee70f9))
* add Slack CDN to CSP for workspace settings button ([#1201](https://github.com/bdougie/contributor.info/issues/1201)) ([1399421](https://github.com/bdougie/contributor.info/commit/1399421c8506e2b4b5e75754cc80b2e38b2b1d22)), closes [#4A154](https://github.com/bdougie/contributor.info/issues/4A154)
* add trash icon to Remove from Workspace menu item ([#1204](https://github.com/bdougie/contributor.info/issues/1204)) ([27b1661](https://github.com/bdougie/contributor.info/commit/27b16619f8fd2ab2f4d0fbe30e6dbcbae36dda9d))
* **api:** add optional supabaseClient parameter to validateRepository ([#1169](https://github.com/bdougie/contributor.info/issues/1169)) ([e644a3a](https://github.com/bdougie/contributor.info/commit/e644a3a554569e2244bb7c862a27cd5bdf7c4003))
* **api:** Fix trending 502 error and add Sentry tracking ([#1245](https://github.com/bdougie/contributor.info/issues/1245)) ([24c4823](https://github.com/bdougie/contributor.info/commit/24c482329c9f024579d0f7af98ce270a01134e02))
* auto-reconnect browser when disconnected ([8f08914](https://github.com/bdougie/contributor.info/commit/8f08914ab3680ffd7b8a061fcd53aaf758d52d1f))
* **build:** remove @types/papaparse from types array in tsconfig ([#1247](https://github.com/bdougie/contributor.info/issues/1247)) ([b10341a](https://github.com/bdougie/contributor.info/commit/b10341af551def40b9d985899b334addeb61358d))
* **build:** use dynamic import for rollup-plugin-visualizer ([#1396](https://github.com/bdougie/contributor.info/issues/1396)) ([0ee98f3](https://github.com/bdougie/contributor.info/commit/0ee98f3f528737bc5c0e1b423b9eeae19659ffc5)), closes [#1395](https://github.com/bdougie/contributor.info/issues/1395) [#1395](https://github.com/bdougie/contributor.info/issues/1395)
* cache linked PRs to reduce GraphQL API calls ([#1273](https://github.com/bdougie/contributor.info/issues/1273)) ([26b6cf7](https://github.com/bdougie/contributor.info/commit/26b6cf74faff5d1b682343d816e3e64d80343e84)), closes [#1261](https://github.com/bdougie/contributor.info/issues/1261) [#1261](https://github.com/bdougie/contributor.info/issues/1261)
* **ci:** adjust Lighthouse thresholds to reduce flakiness ([#1359](https://github.com/bdougie/contributor.info/issues/1359)) ([6789073](https://github.com/bdougie/contributor.info/commit/67890731949e7c1257e16d4b3020cf9edd010791)), closes [#1358](https://github.com/bdougie/contributor.info/issues/1358) [#18](https://github.com/bdougie/contributor.info/issues/18)
* clean up orphaned Dub.co code ([#1305](https://github.com/bdougie/contributor.info/issues/1305)) ([#1314](https://github.com/bdougie/contributor.info/issues/1314)) ([735eb46](https://github.com/bdougie/contributor.info/commit/735eb46b90f74c9e8cb9e7f39e2273c3c237f2b3))
* correct user ID lookup in workspace team plan detection ([#1162](https://github.com/bdougie/contributor.info/issues/1162)) ([63cfbba](https://github.com/bdougie/contributor.info/commit/63cfbbaa34f0e4e06ca5312efc38ba7d9094543a))
* create RPC function for assignee distribution ([#1187](https://github.com/bdougie/contributor.info/issues/1187)) ([#1191](https://github.com/bdougie/contributor.info/issues/1191)) ([3fd9bac](https://github.com/bdougie/contributor.info/commit/3fd9bac2231f6067329530e286ef547c9c6f3e89))
* **csp:** add SHA256 hashes for React inline styles ([#1203](https://github.com/bdougie/contributor.info/issues/1203)) ([8659ef3](https://github.com/bdougie/contributor.info/commit/8659ef3b7ae1b09fd48fa4f0390dcdbdf19a9eb6))
* **css:** resolve CSS minifier warnings with Tailwind selectors ([#1248](https://github.com/bdougie/contributor.info/issues/1248)) ([1d7ca9e](https://github.com/bdougie/contributor.info/commit/1d7ca9ed701297ba46bb91eefdfca8c8b83286e4))
* **deps:** upgrade tar-fs to fix high severity vulnerabilities ([#1176](https://github.com/bdougie/contributor.info/issues/1176)) ([64900cc](https://github.com/bdougie/contributor.info/commit/64900ccc21328c3b2b2857e9775d7e5302679788)), closes [#1171](https://github.com/bdougie/contributor.info/issues/1171)
* **dub:** enhance URL shortening with retry logic and analytics tracking ([#1237](https://github.com/bdougie/contributor.info/issues/1237)) ([5ea2f60](https://github.com/bdougie/contributor.info/commit/5ea2f60c3e3f9996a6b0b19818829430f17528a9)), closes [#1234](https://github.com/bdougie/contributor.info/issues/1234)
* enable changelog display by copying CHANGELOG.md to public directory ([#1253](https://github.com/bdougie/contributor.info/issues/1253)) ([e91688c](https://github.com/bdougie/contributor.info/commit/e91688c7f3cdf05819a0afd27a7eeb8d3d076b69))
* enable RLS on public tables missing row-level security ([#1363](https://github.com/bdougie/contributor.info/issues/1363)) ([#1371](https://github.com/bdougie/contributor.info/issues/1371)) ([b39559e](https://github.com/bdougie/contributor.info/commit/b39559ee203df5dc114a1574311f117597502edb))
* formatting of embeddable widgets section ([#1270](https://github.com/bdougie/contributor.info/issues/1270)) ([d5971d0](https://github.com/bdougie/contributor.info/commit/d5971d074447ee774da6a6e087c9f995739068c2))
* handle duplicate short link (409) by returning existing link ([#1315](https://github.com/bdougie/contributor.info/issues/1315)) ([c2601f1](https://github.com/bdougie/contributor.info/commit/c2601f14b63440194dcbc3caa73c2d167a7dee6d)), closes [#1305](https://github.com/bdougie/contributor.info/issues/1305)
* identify and label bot accounts in lottery factor card ([#1165](https://github.com/bdougie/contributor.info/issues/1165)) ([#1166](https://github.com/bdougie/contributor.info/issues/1166)) ([cd989c8](https://github.com/bdougie/contributor.info/commit/cd989c8fe928278707c619fb81addd41942ba0e6))
* implement auto-sync for workspace discussions ([#1119](https://github.com/bdougie/contributor.info/issues/1119)) ([288424a](https://github.com/bdougie/contributor.info/commit/288424ab657919f504b3916d1d61098afab48711))
* map auth.users.id to app_users.id for workspace queries ([#1149](https://github.com/bdougie/contributor.info/issues/1149)) ([df93fcf](https://github.com/bdougie/contributor.info/commit/df93fcf6bb45324ec792ebbe3bab562880a2aff9)), closes [#1148](https://github.com/bdougie/contributor.info/issues/1148) [#1148](https://github.com/bdougie/contributor.info/issues/1148) [#1148](https://github.com/bdougie/contributor.info/issues/1148) [#1148](https://github.com/bdougie/contributor.info/issues/1148)
* **netlify:** use SUPABASE_URL env var for server-side functions ([#1382](https://github.com/bdougie/contributor.info/issues/1382)) ([8f17f4c](https://github.com/bdougie/contributor.info/commit/8f17f4c206c90e6030a116513553ff9bf55c3fdc))
* package.json & package-lock.json to reduce vulnerabilities ([#1252](https://github.com/bdougie/contributor.info/issues/1252)) ([140a5f8](https://github.com/bdougie/contributor.info/commit/140a5f8f66f2094dd024a66d85185cb26b6a964f))
* **performance:** prevent triple initialization of smart notifications ([#1190](https://github.com/bdougie/contributor.info/issues/1190)) ([4bd400d](https://github.com/bdougie/contributor.info/commit/4bd400d376689e8cc03a132c7d8ab3145604f207)), closes [#1186](https://github.com/bdougie/contributor.info/issues/1186)
* prevent empty src attributes causing network requests ([#1358](https://github.com/bdougie/contributor.info/issues/1358)) ([6587b64](https://github.com/bdougie/contributor.info/commit/6587b644474dadc40d1994dd1fc929b210d60c45)), closes [#1352](https://github.com/bdougie/contributor.info/issues/1352) [#301](https://github.com/bdougie/contributor.info/issues/301) [#301](https://github.com/bdougie/contributor.info/issues/301)
* prevent unstyled landing page flash on repo routes during SSR ([#1398](https://github.com/bdougie/contributor.info/issues/1398)) ([ab37b82](https://github.com/bdougie/contributor.info/commit/ab37b82304a4463a20f7ea422a3d43b26620c080)), closes [#1394](https://github.com/bdougie/contributor.info/issues/1394)
* remove SECURITY DEFINER from 5 views ([#1370](https://github.com/bdougie/contributor.info/issues/1370)) ([b55dd27](https://github.com/bdougie/contributor.info/commit/b55dd27d6a8554eec8d31ff14de963675d42e616)), closes [#1362](https://github.com/bdougie/contributor.info/issues/1362)
* replace next-themes with internal useTheme hook ([#1312](https://github.com/bdougie/contributor.info/issues/1312)) ([ea65206](https://github.com/bdougie/contributor.info/commit/ea652062150f58bd9549909c32d6a878794da126))
* replace seedling icon with favicon-style logo in social cards ([e12167f](https://github.com/bdougie/contributor.info/commit/e12167fcd8314b41bcc15fef4a64d03640788a76))
* resolve GitHub avatar CORS issues in shareable card capture ([#1327](https://github.com/bdougie/contributor.info/issues/1327)) ([4d7a8bc](https://github.com/bdougie/contributor.info/commit/4d7a8bc92a47653d4e6b14bf9e58ef27744c2403)), closes [#1](https://github.com/bdougie/contributor.info/issues/1)
* resolve Netlify build heap out of memory error ([#1311](https://github.com/bdougie/contributor.info/issues/1311)) ([18e6953](https://github.com/bdougie/contributor.info/commit/18e69539f7103115bc88bbbfe97516b8cb94237e)), closes [#1310](https://github.com/bdougie/contributor.info/issues/1310)
* resolve social card visual regressions ([649174d](https://github.com/bdougie/contributor.info/commit/649174d2626d667fdb0c7c566fbd98390d8ea479))
* resolve workspace permission errors for repository management ([#1175](https://github.com/bdougie/contributor.info/issues/1175)) ([79cbc30](https://github.com/bdougie/contributor.info/commit/79cbc304b1aeadfa9b4cf098b3c71a58c69f63b4))
* **security:** upgrade dependencies to address CVE vulnerabilities ([#1178](https://github.com/bdougie/contributor.info/issues/1178)) ([f25ba67](https://github.com/bdougie/contributor.info/commit/f25ba67ef793d24016944b2da50cc6fd243698fb)), closes [#1173](https://github.com/bdougie/contributor.info/issues/1173)
* **security:** upgrade dependencies to address CVE-2024-37890 and other vulnerabilities ([#1177](https://github.com/bdougie/contributor.info/issues/1177)) ([39e9d07](https://github.com/bdougie/contributor.info/commit/39e9d078a344e67d8071a7b51b909d1a8447db8e)), closes [#1172](https://github.com/bdougie/contributor.info/issues/1172) [#1172](https://github.com/bdougie/contributor.info/issues/1172)
* **slack:** add optional chaining to channel filter includes() call ([#1223](https://github.com/bdougie/contributor.info/issues/1223)) ([e9c2e56](https://github.com/bdougie/contributor.info/commit/e9c2e56e29e5e66800e6568f7d44d268a34a0351)), closes [#1213](https://github.com/bdougie/contributor.info/issues/1213)
* **slack:** correct RLS policies to join through app_users table ([#1209](https://github.com/bdougie/contributor.info/issues/1209)) ([f135fd8](https://github.com/bdougie/contributor.info/commit/f135fd8414f5aa5372e1a4b48e9fa831b51cd5bf)), closes [#1207](https://github.com/bdougie/contributor.info/issues/1207)
* **slack:** enable scheduled Slack messages and test button ([#1231](https://github.com/bdougie/contributor.info/issues/1231)) ([df1f2a2](https://github.com/bdougie/contributor.info/commit/df1f2a2370d80fee236e1aa88a66d3af93947a96))
* **slack:** improve input validation and logging ([#1214](https://github.com/bdougie/contributor.info/issues/1214)) ([77859c5](https://github.com/bdougie/contributor.info/commit/77859c50516e2a0487b09c9769f8e98c3e92ad57))
* **slack:** properly configure JWT verification for OAuth callback ([#1207](https://github.com/bdougie/contributor.info/issues/1207)) ([bc0a6b9](https://github.com/bdougie/contributor.info/commit/bc0a6b95bc106469d8c5d570f21286e51ab8d70f))
* **slack:** update CORS headers for slack-list-channels Edge Function ([#1210](https://github.com/bdougie/contributor.info/issues/1210)) ([e3addb9](https://github.com/bdougie/contributor.info/commit/e3addb9464f61957c29e9a73860767106e2f1004))
* **slack:** use absolute URLs for OAuth callback redirects ([#1206](https://github.com/bdougie/contributor.info/issues/1206)) ([a40afb8](https://github.com/bdougie/contributor.info/commit/a40afb842693c8933ca16bdb9ecc40e48d7aa059))
* **slack:** use Promise.allSettled for disconnect all to prevent partial failures ([#1225](https://github.com/bdougie/contributor.info/issues/1225)) ([ca2a3dd](https://github.com/bdougie/contributor.info/commit/ca2a3dd3aa378841312322ba14ec0bc45e397a03)), closes [#1212](https://github.com/bdougie/contributor.info/issues/1212) [#1224](https://github.com/bdougie/contributor.info/issues/1224) [#1212](https://github.com/bdougie/contributor.info/issues/1212) [#1224](https://github.com/bdougie/contributor.info/issues/1224)
* **social-cards:** add libvips for PNG conversion ([#1256](https://github.com/bdougie/contributor.info/issues/1256)) ([a6f0301](https://github.com/bdougie/contributor.info/commit/a6f0301d422d8aea6e3b7aaa7a864a03208cebd3)), closes [#1235](https://github.com/bdougie/contributor.info/issues/1235)
* sort discussions by created_at to show newest first ([#1164](https://github.com/bdougie/contributor.info/issues/1164)) ([a1e7d3e](https://github.com/bdougie/contributor.info/commit/a1e7d3e15d206ec81b2f574e5d7ae5e76e5534c4))
* **ssr:** match home page SSR UI to client-side design ([#1392](https://github.com/bdougie/contributor.info/issues/1392)) ([c67bcae](https://github.com/bdougie/contributor.info/commit/c67bcae5698a488a00113735288475a90e2de9b0))
* Subscription Activation Failures After Purchase ([#1105](https://github.com/bdougie/contributor.info/issues/1105)) ([#1155](https://github.com/bdougie/contributor.info/issues/1155)) ([397acfa](https://github.com/bdougie/contributor.info/commit/397acfaf9dee74f27efff745312ed52bc45a11eb))
* sync package-lock.json with playwright dependency ([4e0fca7](https://github.com/bdougie/contributor.info/commit/4e0fca7cd205317a7d623a089b4bc98816953085))
* throttle GraphQL requests for linked PRs to prevent network saturation ([#1265](https://github.com/bdougie/contributor.info/issues/1265)) ([b5c0011](https://github.com/bdougie/contributor.info/commit/b5c00112975d381fde75058a2b808f95f55b711f)), closes [#1260](https://github.com/bdougie/contributor.info/issues/1260)
* **tracking:** improve repository tracking pipeline reliability ([#1337](https://github.com/bdougie/contributor.info/issues/1337)) ([b72b84c](https://github.com/bdougie/contributor.info/commit/b72b84c42be0ab58559fa14e93ef865868e7b2f5)), closes [#1325](https://github.com/bdougie/contributor.info/issues/1325)
* **tracking:** properly report errors to Sentry and PostHog ([#1380](https://github.com/bdougie/contributor.info/issues/1380)) ([c7a3a45](https://github.com/bdougie/contributor.info/commit/c7a3a4557dac3cd0c03a5c8f108abd475941ee8a))
* trending page showing no repos ([#1254](https://github.com/bdougie/contributor.info/issues/1254)) ([82806b5](https://github.com/bdougie/contributor.info/commit/82806b552d1a5e596b02fabcee1741d50683871e))
* **types:** add explicit papaparse type reference for Netlify builds ([#1249](https://github.com/bdougie/contributor.info/issues/1249)) ([74ff43f](https://github.com/bdougie/contributor.info/commit/74ff43f17b8fa0d09c37caddfe888f8b03faa4ca))
* **types:** use inline papaparse type declarations ([#1250](https://github.com/bdougie/contributor.info/issues/1250)) ([10d07dd](https://github.com/bdougie/contributor.info/commit/10d07dd161413fbd4744e69e54a709114201c5aa))
* **ui:** change no notifications icon from mail to bell ([#1122](https://github.com/bdougie/contributor.info/issues/1122)) ([d62dc3f](https://github.com/bdougie/contributor.info/commit/d62dc3fc2378e9b3af7f91d1540bfb329139a777))
* **ui:** correct Monthly Leaderboard visibility and add workspace button ([#1123](https://github.com/bdougie/contributor.info/issues/1123)) ([1dc01a4](https://github.com/bdougie/contributor.info/commit/1dc01a497f256b8c15468721558312f4607d5a1e))
* **ui:** use constant default observer options in ProgressiveChart to prevent re-renders ([#1357](https://github.com/bdougie/contributor.info/issues/1357)) ([2b9ad29](https://github.com/bdougie/contributor.info/commit/2b9ad2992244e277bc102423ccc6488d4a9877b8))
* update @polar-sh/sdk to fix high severity vulnerability ([#1255](https://github.com/bdougie/contributor.info/issues/1255)) ([9874179](https://github.com/bdougie/contributor.info/commit/98741799fa93c8e4fa14acabcb7b61328b0f31e2))
* update Playwright base image to v1.57.0 ([3f17c8c](https://github.com/bdougie/contributor.info/commit/3f17c8c5d8f3ce4c46c905b7dc818d9fb9803a93))
* update RLS policy for repository_confidence_history table ([#1298](https://github.com/bdougie/contributor.info/issues/1298)) ([047128b](https://github.com/bdougie/contributor.info/commit/047128b193aaa29c751ce992293ed1000fa631d6)), closes [#1296](https://github.com/bdougie/contributor.info/issues/1296)
* update social card design to match React components ([#1313](https://github.com/bdougie/contributor.info/issues/1313)) ([ae84c86](https://github.com/bdougie/contributor.info/commit/ae84c8601ce699f8b0689dac3ddaa6dba57ae810)), closes [#22C55](https://github.com/bdougie/contributor.info/issues/22C55)
* upgrade @polar-sh/nextjs from 0.4.11 to 0.8.0 ([#1318](https://github.com/bdougie/contributor.info/issues/1318)) ([dd2a72f](https://github.com/bdougie/contributor.info/commit/dd2a72fe3e11f51b4ad4bd575cc9f36afab0aa09))
* upgrade @radix-ui/react-alert-dialog from 1.1.1 to 1.1.15 ([#1272](https://github.com/bdougie/contributor.info/issues/1272)) ([3e82ce2](https://github.com/bdougie/contributor.info/commit/3e82ce2562b5b29930ea1eb35b7e125b750be318))
* upgrade @radix-ui/react-collapsible from 1.1.11 to 1.1.12 ([#1197](https://github.com/bdougie/contributor.info/issues/1197)) ([80d2530](https://github.com/bdougie/contributor.info/commit/80d253061ca8645881e18baca675561ac8572a06))
* upgrade @radix-ui/react-context-menu from 2.2.15 to 2.2.16 ([#1135](https://github.com/bdougie/contributor.info/issues/1135)) ([8c0292c](https://github.com/bdougie/contributor.info/commit/8c0292cc7d626ede34080dab5b383e3903977d5d))
* upgrade @radix-ui/react-dialog from 1.1.14 to 1.1.15 ([#1271](https://github.com/bdougie/contributor.info/issues/1271)) ([825c575](https://github.com/bdougie/contributor.info/commit/825c5752a1b6170c55a022dff3e2dadb1f848a2a))
* upgrade @radix-ui/react-dropdown-menu from 2.1.15 to 2.1.16 ([#1136](https://github.com/bdougie/contributor.info/issues/1136)) ([2daed75](https://github.com/bdougie/contributor.info/commit/2daed75db7dec01b06633ccd1b9246f4877a26e9))
* upgrade @radix-ui/react-hover-card from 1.1.14 to 1.1.15 ([#1157](https://github.com/bdougie/contributor.info/issues/1157)) ([f131a3f](https://github.com/bdougie/contributor.info/commit/f131a3fd61c475faee032dc02a026e7efef8aaf8))
* upgrade @radix-ui/react-menubar from 1.1.15 to 1.1.16 ([#1158](https://github.com/bdougie/contributor.info/issues/1158)) ([d303600](https://github.com/bdougie/contributor.info/commit/d303600d3835c21f8b1b9ce4f51dbc8ccd591375))
* upgrade @radix-ui/react-popover from 1.1.14 to 1.1.15 ([#1159](https://github.com/bdougie/contributor.info/issues/1159)) ([31b9048](https://github.com/bdougie/contributor.info/commit/31b90480eeba7569a94aba1049a68aff00daebb0))
* upgrade @radix-ui/react-select from 2.2.5 to 2.2.6 ([#1160](https://github.com/bdougie/contributor.info/issues/1160)) ([480610c](https://github.com/bdougie/contributor.info/commit/480610cfc5014e0acda2ce4b2e811cabbc673a17))
* upgrade @radix-ui/react-tooltip from 1.2.7 to 1.2.8 ([#1196](https://github.com/bdougie/contributor.info/issues/1196)) ([8a80116](https://github.com/bdougie/contributor.info/commit/8a80116f9d0c468254f24955fdaee88fad4d0374))
* upgrade @supabase/supabase-js from 2.57.4 to 2.75.0 ([#1174](https://github.com/bdougie/contributor.info/issues/1174)) ([969ad42](https://github.com/bdougie/contributor.info/commit/969ad42091e63e0cf33e2c9f933a466540ac161a))
* upgrade @supabase/supabase-js from 2.75.0 to 2.75.1 ([#1194](https://github.com/bdougie/contributor.info/issues/1194)) ([726c910](https://github.com/bdougie/contributor.info/commit/726c9109bc62c3dfb9c10b865fd0ec336e64b97f))
* upgrade @supabase/supabase-js from 2.75.1 to 2.81.1 ([#1257](https://github.com/bdougie/contributor.info/issues/1257)) ([ba88cdf](https://github.com/bdougie/contributor.info/commit/ba88cdfc2294a144785bfe35a83c81d312fa9e95))
* upgrade @supabase/supabase-js from 2.81.1 to 2.84.0 ([#1320](https://github.com/bdougie/contributor.info/issues/1320)) ([72d48d0](https://github.com/bdougie/contributor.info/commit/72d48d049c98a767fa9a9aee36872d0b59e6907c))
* upgrade dub from 0.66.5 to 0.68.0 ([#1319](https://github.com/bdougie/contributor.info/issues/1319)) ([78a5d15](https://github.com/bdougie/contributor.info/commit/78a5d15d7aa10d54183c935490836fae0a00d101))
* upgrade glob from 9.0.0 to 9.3.5 ([#1242](https://github.com/bdougie/contributor.info/issues/1242)) ([59dbd23](https://github.com/bdougie/contributor.info/commit/59dbd23c3826b23db6998c9fd35eae26c54f2f2a))
* upgrade inngest from 3.41.0 to 3.44.5 ([#1243](https://github.com/bdougie/contributor.info/issues/1243)) ([832e651](https://github.com/bdougie/contributor.info/commit/832e6512fdd907870c95ce50614f42f50245abfd))
* upgrade lucide-react from 0.544.0 to 0.554.0 ([#1317](https://github.com/bdougie/contributor.info/issues/1317)) ([c0b1476](https://github.com/bdougie/contributor.info/commit/c0b147673c549deb84e9d2d42ba8a06c80157933))
* upgrade posthog-js from 1.265.0 to 1.268.6 ([#1134](https://github.com/bdougie/contributor.info/issues/1134)) ([8599fe3](https://github.com/bdougie/contributor.info/commit/8599fe378e76997ac1fb7f1189cb9ce8bd062f58))
* upgrade posthog-js from 1.268.6 to 1.285.0 ([#1244](https://github.com/bdougie/contributor.info/issues/1244)) ([c510955](https://github.com/bdougie/contributor.info/commit/c510955b960c6c5227c5bc3cee3da7434a426b1a))
* upgrade sharp from 0.33.5 to 0.34.5 ([#1258](https://github.com/bdougie/contributor.info/issues/1258)) ([ee6390c](https://github.com/bdougie/contributor.info/commit/ee6390c819e52cbdb407e92593148435f2d90340))
* use actual favicon pixel art in social cards ([ad44636](https://github.com/bdougie/contributor.info/commit/ad44636db004b10012850349ec2a6d06f0ad76ff))
* use Dockerfile for Fly.io build instead of Heroku builder ([4e084ac](https://github.com/bdougie/contributor.info/commit/4e084ac284c7bd440b9dbf2b233aac9362a5c4c9))
* use first_tracked_at column in repository-status API ([#1345](https://github.com/bdougie/contributor.info/issues/1345)) ([33565e1](https://github.com/bdougie/contributor.info/commit/33565e1d039a10677f05708600bc1bacd43cdbe0)), closes [#1199](https://github.com/bdougie/contributor.info/issues/1199)
* use jammy base image (focal no longer available) ([b6160ff](https://github.com/bdougie/contributor.info/commit/b6160ff1eebf95c99cd13b947d94743e71f58bd8))
* **ux:** keep header and search visible during page loading ([#1381](https://github.com/bdougie/contributor.info/issues/1381)) ([3fcc83b](https://github.com/bdougie/contributor.info/commit/3fcc83bc764868f28734267ea558d6a617b8d13b))
* **webhooks:** ensure PR embeddings are generated on webhook events ([#1372](https://github.com/bdougie/contributor.info/issues/1372)) ([3a4d055](https://github.com/bdougie/contributor.info/commit/3a4d055613586ffa5ad91c525428d786aee22165)), closes [#1340](https://github.com/bdougie/contributor.info/issues/1340)
* **workspace:** change Issue Assignee Distribution max visible to 6 ([#1185](https://github.com/bdougie/contributor.info/issues/1185)) ([98a4814](https://github.com/bdougie/contributor.info/commit/98a48144aeb1067eed458dbbd807491da5945506))
* **workspace:** improve member name display in workspace settings ([#1205](https://github.com/bdougie/contributor.info/issues/1205)) ([1636e59](https://github.com/bdougie/contributor.info/commit/1636e597f88bc4e25572c1ccaea61ef0fda92651))
* **workspace:** prevent infinite loading timeout with Promise.race ([#1222](https://github.com/bdougie/contributor.info/issues/1222)) ([dffd16d](https://github.com/bdougie/contributor.info/commit/dffd16d025f49fc8b654a8efd993c4d8ec898465)), closes [#1208](https://github.com/bdougie/contributor.info/issues/1208)
* **workspace:** use actual event URLs instead of # placeholder in activity table ([#1179](https://github.com/bdougie/contributor.info/issues/1179)) ([4036586](https://github.com/bdougie/contributor.info/commit/4036586ece9277248609733454c19d2f0ed1854e))


### ⚡ Performance Improvements

* **db:** optimize spam query performance for workspace spam tab ([#1335](https://github.com/bdougie/contributor.info/issues/1335)) ([d6b79b7](https://github.com/bdougie/contributor.info/commit/d6b79b764d5a653c2b38b56c36706c7626c4cee3)), closes [#1334](https://github.com/bdougie/contributor.info/issues/1334)
* debounce state updates in useWorkspaceIssues hook ([#1275](https://github.com/bdougie/contributor.info/issues/1275)) ([0132139](https://github.com/bdougie/contributor.info/commit/01321392993d1bf7bff7a1cd2f4acfa74cbe171f)), closes [#1263](https://github.com/bdougie/contributor.info/issues/1263)
* defer non-critical JS loading (phases 2-4) ([#1405](https://github.com/bdougie/contributor.info/issues/1405)) ([53b2f38](https://github.com/bdougie/contributor.info/commit/53b2f387e627130ba9d5da0a80489eaca8bf050c)), closes [#1402](https://github.com/bdougie/contributor.info/issues/1402)
* defer non-critical JS loading (phases 2-4) ([#1407](https://github.com/bdougie/contributor.info/issues/1407)) ([4a9bd4c](https://github.com/bdougie/contributor.info/commit/4a9bd4cadb0a9a49fb5f501a3f35be3dfa4cf2ee)), closes [#1400](https://github.com/bdougie/contributor.info/issues/1400)
* defer query-client persistence to improve initial render ([#1367](https://github.com/bdougie/contributor.info/issues/1367)) ([f1b1ed3](https://github.com/bdougie/contributor.info/commit/f1b1ed3172d63cd6f9037bf3c2fe7c26d178b94f)), closes [#1347](https://github.com/bdougie/contributor.info/issues/1347)
* defer Supabase client initialization for faster LCP ([#1282](https://github.com/bdougie/contributor.info/issues/1282)) ([01bc3ec](https://github.com/bdougie/contributor.info/commit/01bc3ec6e28f49555fe5b71d34764d6558a68e5b)), closes [#1278](https://github.com/bdougie/contributor.info/issues/1278) [#1283](https://github.com/bdougie/contributor.info/issues/1283) [#1283](https://github.com/bdougie/contributor.info/issues/1283)
* extend PostHog deferral to improve LCP ([#1281](https://github.com/bdougie/contributor.info/issues/1281)) ([5c6c0b7](https://github.com/bdougie/contributor.info/commit/5c6c0b7ca76801cffc9683f2ff775bd44511f746)), closes [#1276](https://github.com/bdougie/contributor.info/issues/1276)
* fix markdown bundle lazy loading to reduce initial page size ([#1287](https://github.com/bdougie/contributor.info/issues/1287)) ([06aeee5](https://github.com/bdougie/contributor.info/commit/06aeee5321040c4f743c410e2e192d235327044e)), closes [#1279](https://github.com/bdougie/contributor.info/issues/1279)
* implement request deduplication for auth and workspace hooks ([#1292](https://github.com/bdougie/contributor.info/issues/1292)) ([af4c792](https://github.com/bdougie/contributor.info/commit/af4c79266925a12a6d5d785e09c6b403f1a0128d)), closes [#1188](https://github.com/bdougie/contributor.info/issues/1188)
* improve First Contentful Paint (FCP) performance ([#1364](https://github.com/bdougie/contributor.info/issues/1364)) ([a9c602a](https://github.com/bdougie/contributor.info/commit/a9c602aa70531e4f83ec640df52ab78812137732)), closes [#1343](https://github.com/bdougie/contributor.info/issues/1343)
* lazy load modal components to reduce initial bundle size ([#1403](https://github.com/bdougie/contributor.info/issues/1403)) ([2824579](https://github.com/bdougie/contributor.info/commit/2824579869a7925c985464ee092615004b546820)), closes [#1402](https://github.com/bdougie/contributor.info/issues/1402)
* lazy load workspace tabs to improve TTI ([#1353](https://github.com/bdougie/contributor.info/issues/1353)) ([613cbb6](https://github.com/bdougie/contributor.info/commit/613cbb6ce322861a9b1d1c8e9a2be6740dd0115e)), closes [#1344](https://github.com/bdougie/contributor.info/issues/1344)
* migrate 95 files from sync supabase to async getSupabase() ([#1291](https://github.com/bdougie/contributor.info/issues/1291)) ([11eda6b](https://github.com/bdougie/contributor.info/commit/11eda6ba74df79a5f3454d1d07742d9e59c85d0d)), closes [#1283](https://github.com/bdougie/contributor.info/issues/1283)
* Optimize chart bundle loading to reduce initial load ([#1289](https://github.com/bdougie/contributor.info/issues/1289)) ([9ba49d7](https://github.com/bdougie/contributor.info/commit/9ba49d727fef5d258f650d5608eab8b1dbe85f32)), closes [#1277](https://github.com/bdougie/contributor.info/issues/1277)
* optimize PRs table with caching and virtualization ([#1354](https://github.com/bdougie/contributor.info/issues/1354)) ([fb71ac8](https://github.com/bdougie/contributor.info/commit/fb71ac8921624181b3c5f502025b41b7c63bffab)), closes [#1349](https://github.com/bdougie/contributor.info/issues/1349)
* reduce bundle size and improve TTFB ([#1388](https://github.com/bdougie/contributor.info/issues/1388)) ([8b76c4b](https://github.com/bdougie/contributor.info/commit/8b76c4b38756dc4ce9a6a8c75014037884568af2)), closes [#1383](https://github.com/bdougie/contributor.info/issues/1383)
* reduce Total Blocking Time (TBT) by ~30-65ms ([#1366](https://github.com/bdougie/contributor.info/issues/1366)) ([ece6f3a](https://github.com/bdougie/contributor.info/commit/ece6f3a64faa21878c2c2c120a9978048b7ab3ab)), closes [#1346](https://github.com/bdougie/contributor.info/issues/1346)
* remove 6 unused Radix UI components ([#1286](https://github.com/bdougie/contributor.info/issues/1286)) ([6ab6d7c](https://github.com/bdougie/contributor.info/commit/6ab6d7c0e5f6124ec2cb31a6ec95c78c615f2a61))
* show cached issues immediately, sync in background ([#1274](https://github.com/bdougie/contributor.info/issues/1274)) ([ca6a3cb](https://github.com/bdougie/contributor.info/commit/ca6a3cbbbd50464cfd9f99e5c8b37392f47507ad)), closes [#1264](https://github.com/bdougie/contributor.info/issues/1264)
* **ssr:** parallelize asset/data fetching and optimize db queries ([#1406](https://github.com/bdougie/contributor.info/issues/1406)) ([10b05ef](https://github.com/bdougie/contributor.info/commit/10b05efb3b98e11b595d75377e807fdfdab25482))


### ♻️ Code Refactoring

* migrate forwardRef to React 19 ref-as-prop pattern ([#1293](https://github.com/bdougie/contributor.info/issues/1293)) ([#1295](https://github.com/bdougie/contributor.info/issues/1295)) ([0b8dee6](https://github.com/bdougie/contributor.info/commit/0b8dee68cf91458dcd23c771b8abd35a318a62e3))
* **ui:** simplify notification content and use relative time ([#1389](https://github.com/bdougie/contributor.info/issues/1389)) ([677ed5f](https://github.com/bdougie/contributor.info/commit/677ed5f158ade651cac9e0a9f30eb6552aff5a61))


### 📚 Documentation

* add LCP improvements postmortem and update best practices ([#1369](https://github.com/bdougie/contributor.info/issues/1369)) ([0fcba50](https://github.com/bdougie/contributor.info/commit/0fcba505127a6730e3cf1b5f5da8dd603f753c51)), closes [#1342-1347](https://github.com/bdougie/contributor.info/issues/1342-1347)
* add performance audit for PR [#1282](https://github.com/bdougie/contributor.info/issues/1282) (Supabase lazy loading) ([0334abe](https://github.com/bdougie/contributor.info/commit/0334abebbe4183ea14557651e5781653a0513e60))
* add PostHog LCP monitoring implementation summary ([49cbde3](https://github.com/bdougie/contributor.info/commit/49cbde31aa469542d349302d80176606f6ff5e3b)), closes [#1282](https://github.com/bdougie/contributor.info/issues/1282)
* add PostHog LCP monitoring setup and alerting configuration ([4173920](https://github.com/bdougie/contributor.info/commit/417392033e36b8888a86d321a789f50956c48b35)), closes [#1282](https://github.com/bdougie/contributor.info/issues/1282) [#1282](https://github.com/bdougie/contributor.info/issues/1282)
* document analytics chunk separation rationale ([#1290](https://github.com/bdougie/contributor.info/issues/1290)) ([cc9788c](https://github.com/bdougie/contributor.info/commit/cc9788cf054bb29663fd6e2aea5ac53919c421b6)), closes [#1280](https://github.com/bdougie/contributor.info/issues/1280)
* establish Netlify performance baseline audit (Dec 2025) ([91a0ce0](https://github.com/bdougie/contributor.info/commit/91a0ce0f8a395db814e6c0e449b72b40a96ca8f1))
* restructure performance README with monitoring focus ([2ae8061](https://github.com/bdougie/contributor.info/commit/2ae8061c17115560b6ce677ee01eaaf358c44458)), closes [#1282](https://github.com/bdougie/contributor.info/issues/1282)


### 🔧 Maintenance

* update tracked repositories list [skip ci] ([d8a6dcf](https://github.com/bdougie/contributor.info/commit/d8a6dcffc758a9dd72c02073dd890b73f12ce755))


### ✅ Tests

* add comprehensive workspace invitation lifecycle E2E tests ([#1121](https://github.com/bdougie/contributor.info/issues/1121)) ([b6051d3](https://github.com/bdougie/contributor.info/commit/b6051d33629a0c6609ac7e40222ceff9154315ad)), closes [#1057](https://github.com/bdougie/contributor.info/issues/1057) [#1057](https://github.com/bdougie/contributor.info/issues/1057)

## [Unreleased]

### Fixed

- **Slack: Disconnect All Race Condition** ([#1212](https://github.com/bdougie/contributor.info/issues/1212), [#1224](https://github.com/bdougie/contributor.info/issues/1224))
  - Fixed race condition in Slack disconnect all functionality using `Promise.allSettled`
  - Replaced fail-fast `Promise.all` with resilient `Promise.allSettled`
  - All integration deletions now attempted regardless of individual failures
  - Added granular user feedback for all success, partial failure, and all failure scenarios
  - Enhanced error logging with detailed context for each failed deletion
  - Prevents inconsistent state from partial deletions
  - Matches pattern already used in `MembersTab.tsx` for consistency
  - Migration: See `docs/migrations/2025-11-slack-disconnect-all-promise-allsettled.md`

- **Database: Workspace user relations** ([#1147](https://github.com/bdougie/contributor.info/issues/1147))
  - Fixed database relation error preventing workspace creation
  - Created `users` view mapping to `app_users` for PostgREST compatibility
  - Added missing foreign key constraints for workspace tables:
    - `workspaces.owner_id` → `app_users.id`
    - `workspace_members.user_id` → `app_users.id`
    - `workspace_members.invited_by` → `app_users.id`
    - `workspace_repositories.added_by` → `app_users.id`
    - `workspace_invitations.invited_by` → `app_users.id`
  - Migrated orphaned data using `auth_user_id` to correct `app_users.id` references
  - Added performance indexes on all foreign key columns
  - Cleaned up null UUID placeholders and orphaned references
  - Migration: `20251021000000_fix_workspace_user_relations.sql`
  - Documentation: `docs/migrations/2025-10-workspace-user-relations-fix.md`

## [3.0.0](https://github.com/bdougie/contributor.info/compare/v2.1.0...v3.0.0) (2025-10-15)


### ⚠ BREAKING CHANGES

* AI summaries now require user authentication

- Require login to access AI-generated contributor summaries
- Add requiresAuth flag to useContributorSummary return value
- Display elegant login CTA when user is not authenticated
- Update UI to show 'AI-powered insights available' message with login button
- Add comprehensive tests for authentication requirements
- Reuse existing login components and UX patterns

Benefits:
- Creates product-led growth (PLG) motion through value-gated features
- Controls LLM service costs by limiting to authenticated users
- Encourages user signup to access premium features
- Maintains seamless UX with existing auth components

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
* Embedded authentication removed. Users must now use
actions/create-github-app-token to generate App tokens. See README for
migration instructions.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

* docs: add comprehensive GitHub App setup guide and remove unused workflow

- Add detailed step-by-step guide for creating GitHub Apps
- Include security best practices and troubleshooting
- Remove unused PULL2PRESS_WORKFLOW.yml file

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

* security: use SHA-pinned version for create-github-app-token action

- Replace all uses of @v1 with SHA-pinned @5d869da34e18e7287c1daad50e0b8ea0f506ce69
- This is v2.0.0 of the action, providing better security
- SHA pinning prevents supply chain attacks

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

* refactor: simplify to single workflow with GitHub App auth only

- Update main workflow to use GitHub App authentication
- Remove reusable workflow (no longer needed)
- Use SHA-pinned create-github-app-token action for security
- Remove fallback to GITHUB_TOKEN (App auth only)

This eliminates duplicate workflow runs and simplifies the setup.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

* fix: restore job-level permissions with documentation

- Add back job-level permissions for clarity
- Include comments explaining each permission
- Ensures correct permissions even if workflow-level changes

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

* security: remove insecure embedded authentication files

- Remove app-config-encrypted.ts with hardcoded passphrase
- Remove build-embedded-auth.ts build script
- These files used plaintext passphrases in open source (security risk)
- Action now uses secure GitHub App authentication only

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

* cleanup: remove references to embedded authentication

- Update HOW_IT_WORKS.md to document secure App auth approach
- Remove @octokit/auth-app dependency (no longer needed)
- Remove build:embedded-auth script from package.json
- Documentation now reflects GitHub's recommended pattern

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

### 🚀 Features

* Add 90-day workspace event backfill UI ([#957](https://github.com/bdougie/contributor.info/issues/957)) ([#965](https://github.com/bdougie/contributor.info/issues/965)) ([9d224b5](https://github.com/bdougie/contributor.info/commit/9d224b5e2d681b3782361f06494488ea9967156f))
* Add admin dashboard for failed jobs monitoring ([#910](https://github.com/bdougie/contributor.info/issues/910)) ([d1247cc](https://github.com/bdougie/contributor.info/commit/d1247cc5af43217f062076a77cff7367abb78bd4)), closes [#882](https://github.com/bdougie/contributor.info/issues/882)
* add aggressive repository backfill script ([5b37ed5](https://github.com/bdougie/contributor.info/commit/5b37ed5874e7dbecf4a51b4132f2602aead64580))
* Add AI-generated contributor summaries to hover cards ([#979](https://github.com/bdougie/contributor.info/issues/979)) ([0e1450c](https://github.com/bdougie/contributor.info/commit/0e1450cd380e81eacda7855c34c9080eaea3d966)), closes [#924](https://github.com/bdougie/contributor.info/issues/924)
* Add assignee and reviewer distribution charts for workspace views ([#740](https://github.com/bdougie/contributor.info/issues/740)) ([a849c90](https://github.com/bdougie/contributor.info/commit/a849c90ca57e365d31cb57c4ffca86dc61945bb9)), closes [#737](https://github.com/bdougie/contributor.info/issues/737)
* Add automated monitoring and cleanup for Inngest jobs ([#884](https://github.com/bdougie/contributor.info/issues/884)) ([1ab1762](https://github.com/bdougie/contributor.info/commit/1ab1762ab5567541ce777d9db82de73f1b19e9f9)), closes [#883](https://github.com/bdougie/contributor.info/issues/883) [#881](https://github.com/bdougie/contributor.info/issues/881)
* add automatic discussion sync for workspaces ([#1039](https://github.com/bdougie/contributor.info/issues/1039)) ([675b7b8](https://github.com/bdougie/contributor.info/commit/675b7b805d584ad46c828ce14b90630bc568cd43))
* Add CODEOWNERS backend API endpoints ([#841](https://github.com/bdougie/contributor.info/issues/841)) ([1c8a258](https://github.com/bdougie/contributor.info/commit/1c8a258625a7fe665472331618706f768027acb5)), closes [#448](https://github.com/bdougie/contributor.info/issues/448)
* Add comprehensive slow network performance testing ([#952](https://github.com/bdougie/contributor.info/issues/952)) ([1023684](https://github.com/bdougie/contributor.info/commit/10236840adb5f84eee791688bd311642f6f99c89))
* Add Continue review-bot config for Snyk analysis ([f55c8a9](https://github.com/bdougie/contributor.info/commit/f55c8a956754bce08ddc3f7e359c06fb433fa805))
* Add contributor hover cards across workspace views ([#920](https://github.com/bdougie/contributor.info/issues/920)) ([d438cd6](https://github.com/bdougie/contributor.info/commit/d438cd6acfa2ca151616fb191faa4b040702f35a))
* Add database support for GitHub issue comments ([#743](https://github.com/bdougie/contributor.info/issues/743)) ([bff3ae3](https://github.com/bdougie/contributor.info/commit/bff3ae36cf16bf874ee6c6b054f8b98f42f67ce4)), closes [#742](https://github.com/bdougie/contributor.info/issues/742) [#741](https://github.com/bdougie/contributor.info/issues/741)
* add dynamic OAuth redirect URLs for deploy previews ([#707](https://github.com/bdougie/contributor.info/issues/707)) ([0ba90b8](https://github.com/bdougie/contributor.info/commit/0ba90b81fbb9d2af5740f5a22693507532a1beda))
* add editable workspace description in settings ([#669](https://github.com/bdougie/contributor.info/issues/669)) ([904c39e](https://github.com/bdougie/contributor.info/commit/904c39e1f4f70443bd10e5a247d0cf658265bfe6)), closes [#668](https://github.com/bdougie/contributor.info/issues/668)
* Add exponential backoff service for GitHub API calls ([#828](https://github.com/bdougie/contributor.info/issues/828)) ([bcea47d](https://github.com/bdougie/contributor.info/commit/bcea47dd418e053056648e7dc027e2fc45d8a845)), closes [#782](https://github.com/bdougie/contributor.info/issues/782)
* Add filtering capabilities to Workspace PRs and Issues tables ([#738](https://github.com/bdougie/contributor.info/issues/738)) ([9943d67](https://github.com/bdougie/contributor.info/commit/9943d676edaead9b7f6316cd5ae79023303d23f9)), closes [#696](https://github.com/bdougie/contributor.info/issues/696)
* add GitHub Actions workflow for inngest-prod deployment ([#1073](https://github.com/bdougie/contributor.info/issues/1073)) ([a7aa770](https://github.com/bdougie/contributor.info/commit/a7aa7708832ccac6e93e93ffca26caab5533cc1c))
* Add GitHub App authentication to Continue Review action ([#524](https://github.com/bdougie/contributor.info/issues/524)) ([c4c601e](https://github.com/bdougie/contributor.info/commit/c4c601ec888ad1b35e5ae865715c6c06b92236b4))
* Add GitHub App installation CTA (Phase 0) ([#868](https://github.com/bdougie/contributor.info/issues/868)) ([4ba8032](https://github.com/bdougie/contributor.info/commit/4ba80324eb1871aa1cfdd9f9cdcfef427e22ffa1)), closes [#833](https://github.com/bdougie/contributor.info/issues/833) [#833](https://github.com/bdougie/contributor.info/issues/833) [#833](https://github.com/bdougie/contributor.info/issues/833) [#833](https://github.com/bdougie/contributor.info/issues/833)
* add GitHub Discussions tab to workspace pages ([#988](https://github.com/bdougie/contributor.info/issues/988)) ([e0195c0](https://github.com/bdougie/contributor.info/commit/e0195c04df326b46d222e0760deddfe8f8e8e2af)), closes [#985](https://github.com/bdougie/contributor.info/issues/985)
* Add github_id columns to pull_requests for DLT sync ([#876](https://github.com/bdougie/contributor.info/issues/876)) ([9f9c4e0](https://github.com/bdougie/contributor.info/commit/9f9c4e07098e3a8f2357c0a1df5f3fd8e53afa67)), closes [#874](https://github.com/bdougie/contributor.info/issues/874) [#873](https://github.com/bdougie/contributor.info/issues/873)
* Add github_issues table with DLT tracking support ([#852](https://github.com/bdougie/contributor.info/issues/852)) ([3f4bab9](https://github.com/bdougie/contributor.info/commit/3f4bab92c4e3b75725067456dcbf2dcd3f614e67))
* Add Inngest pipeline validation script and documentation ([#890](https://github.com/bdougie/contributor.info/issues/890)) ([1c154d2](https://github.com/bdougie/contributor.info/commit/1c154d2c1a36474c5fd74b07b829e99f7e6387a0))
* Add metrics and trends to workspace PR tab ([#652](https://github.com/bdougie/contributor.info/issues/652)) ([f324ad2](https://github.com/bdougie/contributor.info/commit/f324ad2c07b92ca8a4aa43527159d28fc78fd447))
* Add minimal inngest-sync endpoint ([#757](https://github.com/bdougie/contributor.info/issues/757)) ([e720182](https://github.com/bdougie/contributor.info/commit/e72018273691e0bbe649da8b7ca9c75210dfb9ab)), closes [#754](https://github.com/bdougie/contributor.info/issues/754) [#754](https://github.com/bdougie/contributor.info/issues/754) [#487](https://github.com/bdougie/contributor.info/issues/487)
* Add Mintlify documentation setup ([#955](https://github.com/bdougie/contributor.info/issues/955)) ([6e5b0b6](https://github.com/bdougie/contributor.info/commit/6e5b0b6bd362c0d207cb3b5b56d5f335eb4e43cf)), closes [#939](https://github.com/bdougie/contributor.info/issues/939) [#940](https://github.com/bdougie/contributor.info/issues/940) [#406](https://github.com/bdougie/contributor.info/issues/406) [#FF5402](https://github.com/bdougie/contributor.info/issues/FF5402)
* add needs-triage Continue workflow for automatic issue labeling ([#568](https://github.com/bdougie/contributor.info/issues/568)) ([ea1f6c9](https://github.com/bdougie/contributor.info/commit/ea1f6c9db2d2fbcf0a0cd8fbed13342607c16b15)), closes [#567](https://github.com/bdougie/contributor.info/issues/567)
* Add notification system for async operations ([#973](https://github.com/bdougie/contributor.info/issues/973)) ([6335d61](https://github.com/bdougie/contributor.info/commit/6335d618cdaedd69cfeafaa9b068edef982f8d7e)), closes [#959](https://github.com/bdougie/contributor.info/issues/959)
* add page view data capture for workspace and repository views ([#1109](https://github.com/bdougie/contributor.info/issues/1109)) ([c75eca9](https://github.com/bdougie/contributor.info/commit/c75eca95aa2dc562ce00593ce80cbcaf93077d33)), closes [#1107](https://github.com/bdougie/contributor.info/issues/1107)
* Add PostHog and GitHub credentials to workflow ([3e1aeeb](https://github.com/bdougie/contributor.info/commit/3e1aeebea1136f57c19dabf3374ab1a4d50711ab))
* Add PostHog session analysis workflow with Continue CLI ([#855](https://github.com/bdougie/contributor.info/issues/855)) ([35edc2c](https://github.com/bdougie/contributor.info/commit/35edc2ce02c8dd891bbb5575621b34a467a30d0f))
* Add PostHog session recording for repository tracking ([#735](https://github.com/bdougie/contributor.info/issues/735)) ([aa38e9f](https://github.com/bdougie/contributor.info/commit/aa38e9f4ea0a18b7c81b8bea03601f4d0e4bd867))
* Add PostHog tracking for auth flow and workspace CTA ([#751](https://github.com/bdougie/contributor.info/issues/751)) ([d887638](https://github.com/bdougie/contributor.info/commit/d887638410bd796160cd900b6eb2c162f1e4bd0c)), closes [#749](https://github.com/bdougie/contributor.info/issues/749) [#750](https://github.com/bdougie/contributor.info/issues/750)
* Add respond tracking for issues and discussions ([#1060](https://github.com/bdougie/contributor.info/issues/1060)) ([8038191](https://github.com/bdougie/contributor.info/commit/80381919937002be5def7e31a8c921b467cc6840))
* add seed data generation system with Inngest integration ([#560](https://github.com/bdougie/contributor.info/issues/560)) ([3b3426e](https://github.com/bdougie/contributor.info/commit/3b3426e0cda8695b838e8e617c56c1ee14cc9db2)), closes [#549](https://github.com/bdougie/contributor.info/issues/549)
* add shared utilities for edge functions (database, responses, github) ([#1025](https://github.com/bdougie/contributor.info/issues/1025)) ([4184c58](https://github.com/bdougie/contributor.info/commit/4184c5814057881bc8afc13042cc22ebf027d360)), closes [#1020](https://github.com/bdougie/contributor.info/issues/1020) [#915](https://github.com/bdougie/contributor.info/issues/915)
* Add Snyk security scan workflow with Continue AI ([#858](https://github.com/bdougie/contributor.info/issues/858)) ([b9b350b](https://github.com/bdougie/contributor.info/commit/b9b350befd27ab460048496406568f900c19cea7))
* Add Snyk security scanning workflow with Continue CLI ([#869](https://github.com/bdougie/contributor.info/issues/869)) ([67e55b0](https://github.com/bdougie/contributor.info/commit/67e55b0c9dcaa00335f1099300566a863e5f9a74))
* add Supabase schema for GitHub Discussions support ([#985](https://github.com/bdougie/contributor.info/issues/985)) ([121eae4](https://github.com/bdougie/contributor.info/commit/121eae4387933b3f8d47d15c5bd20d3f921f52b0)), closes [#160](https://github.com/bdougie/contributor.info/issues/160)
* Add workspace integration button to repository view ([#753](https://github.com/bdougie/contributor.info/issues/753)) ([6900872](https://github.com/bdougie/contributor.info/commit/690087274d17f3d50a707b35381f18860fa7e58c))
* Add workspace metrics functions to Netlify Inngest endpoint ([#966](https://github.com/bdougie/contributor.info/issues/966)) ([3ce307e](https://github.com/bdougie/contributor.info/commit/3ce307ef4fd13844350f0bae458ee9f44d5aa95a)), closes [#905](https://github.com/bdougie/contributor.info/issues/905) [#904](https://github.com/bdougie/contributor.info/issues/904)
* **admin:** add PostHog analytics dashboard card ([#923](https://github.com/bdougie/contributor.info/issues/923)) ([b85e3ed](https://github.com/bdougie/contributor.info/commit/b85e3edb432b3151ae54f9d89b0f26a1901fb21d)), closes [#922](https://github.com/bdougie/contributor.info/issues/922)
* AI-generated discussion summaries using LLM service ([#995](https://github.com/bdougie/contributor.info/issues/995)) ([f6921ce](https://github.com/bdougie/contributor.info/commit/f6921ce88bb64a1b239d6dcea723d3798ab14daf)), closes [#992](https://github.com/bdougie/contributor.info/issues/992)
* complete debug files cleanup phases 2-3 ([#676](https://github.com/bdougie/contributor.info/issues/676)) ([#682](https://github.com/bdougie/contributor.info/issues/682)) ([cf7b02b](https://github.com/bdougie/contributor.info/commit/cf7b02bec931765ff0488557888778d3d1bce2fc))
* complete migration to MiniLM embeddings ([#1034](https://github.com/bdougie/contributor.info/issues/1034)) ([e855171](https://github.com/bdougie/contributor.info/commit/e85517174956e5bcf1196d1a5093bae9d0c1c85e))
* comprehensive load testing suite for Edge Functions ([#719](https://github.com/bdougie/contributor.info/issues/719)) ([fd96837](https://github.com/bdougie/contributor.info/commit/fd96837922c738a4b1ac18e126d2ac13506c535a)), closes [#486](https://github.com/bdougie/contributor.info/issues/486)
* Configure docs subdomain rewrite and update app links ([#964](https://github.com/bdougie/contributor.info/issues/964)) ([dbd01ee](https://github.com/bdougie/contributor.info/commit/dbd01eebe04ebe6df61328628e3b674207ef5037))
* Connect live data to workspace dashboard ([#642](https://github.com/bdougie/contributor.info/issues/642)) ([ad47963](https://github.com/bdougie/contributor.info/commit/ad4796314e1021f1763047010a52d0a7aacf68d3)), closes [#598](https://github.com/bdougie/contributor.info/issues/598)
* connect UI to reviewer suggestions API (PR [#841](https://github.com/bdougie/contributor.info/issues/841)) ([#843](https://github.com/bdougie/contributor.info/issues/843)) ([bcaf3a7](https://github.com/bdougie/contributor.info/commit/bcaf3a7b18a207d0bb7ef2500750b3a3ef8f07bc))
* Connect workspace overview stats to real aggregated metrics ([#651](https://github.com/bdougie/contributor.info/issues/651)) ([f48b241](https://github.com/bdougie/contributor.info/commit/f48b241673181c2e85f2ea7675e4b1adbd74472d))
* contributor CRM system - Phase 1 planning ([#800](https://github.com/bdougie/contributor.info/issues/800)) ([7ce80e4](https://github.com/bdougie/contributor.info/commit/7ce80e4719751c28b411a93d2b056f1ebabaf917))
* **dev:** cross-platform local Supabase migration runner ([#623](https://github.com/bdougie/contributor.info/issues/623)) ([989a33a](https://github.com/bdougie/contributor.info/commit/989a33adec07dd0eb6ac3f312cb746280925d2f6))
* Display individual star and fork events in workspace activity feed ([#659](https://github.com/bdougie/contributor.info/issues/659)) ([8591ccd](https://github.com/bdougie/contributor.info/commit/8591ccd069ce1085c7a86b46fdbcc250036a7548)), closes [#657](https://github.com/bdougie/contributor.info/issues/657) [#657](https://github.com/bdougie/contributor.info/issues/657) [#658](https://github.com/bdougie/contributor.info/issues/658) [#660](https://github.com/bdougie/contributor.info/issues/660) [#661](https://github.com/bdougie/contributor.info/issues/661)
* Display star and fork events in activity feed ([#658](https://github.com/bdougie/contributor.info/issues/658)) ([9adc16c](https://github.com/bdougie/contributor.info/commit/9adc16c812ca909161fc87028c90e2aca06eef92)), closes [#657](https://github.com/bdougie/contributor.info/issues/657)
* **docs-review:** add contextual feedback with specific line numbers and validation examples ([#970](https://github.com/bdougie/contributor.info/issues/970)) ([9ed68a3](https://github.com/bdougie/contributor.info/commit/9ed68a3983d5eaf5238b1389555d68ef0b99fb04))
* **docs-review:** detect and suggest missing documentation ([#976](https://github.com/bdougie/contributor.info/issues/976)) ([9fbee91](https://github.com/bdougie/contributor.info/commit/9fbee912e565e242045dcd760bdcf309f1890338)), closes [#973](https://github.com/bdougie/contributor.info/issues/973)
* **docs-review:** enhance documentation review bot with comprehensive checks ([#962](https://github.com/bdougie/contributor.info/issues/962)) ([d42362d](https://github.com/bdougie/contributor.info/commit/d42362dbf2477101f7b0c8fb259305005f9fea2d)), closes [#950](https://github.com/bdougie/contributor.info/issues/950)
* embeddings monitoring and discussion prioritization ([#1032](https://github.com/bdougie/contributor.info/issues/1032)) ([e3371a3](https://github.com/bdougie/contributor.info/commit/e3371a3b44e18bb1f55e68e6197d387810dfa1dc))
* Enable ESLint and Prettier with pre-commit hooks ([#557](https://github.com/bdougie/contributor.info/issues/557)) ([1b5df9c](https://github.com/bdougie/contributor.info/commit/1b5df9cf9fc6ba131eb1a9a9a312f2df413c97e8))
* enable issue similarity search in 'Respond with Similar Items' ([#1046](https://github.com/bdougie/contributor.info/issues/1046)) ([5577894](https://github.com/bdougie/contributor.info/commit/557789434e5d556952bb291196cce4e0a0cd161b)), closes [#1045](https://github.com/bdougie/contributor.info/issues/1045) [#8098](https://github.com/bdougie/contributor.info/issues/8098)
* enhance Continue review to be more critical and context-aware ([#618](https://github.com/bdougie/contributor.info/issues/618)) ([7f43672](https://github.com/bdougie/contributor.info/commit/7f436721676ed8e86c078f45406232f398a9e9af))
* Enhance continue-review action with contextual insights and metrics ([#832](https://github.com/bdougie/contributor.info/issues/832)) ([#836](https://github.com/bdougie/contributor.info/issues/836)) ([8c0200b](https://github.com/bdougie/contributor.info/commit/8c0200b2503cfcc4439f3c75e9de47fd2d28ccdc))
* enhance demo workspace with improved charts and rising stars visualization ([#629](https://github.com/bdougie/contributor.info/issues/629)) ([a3edddc](https://github.com/bdougie/contributor.info/commit/a3edddc53c3a4fe5c9874807fa0153e77b94328b))
* Enhance similarity service with caching and batch processing - Phase 2 ([#831](https://github.com/bdougie/contributor.info/issues/831)) ([89083dc](https://github.com/bdougie/contributor.info/commit/89083dc369419bdbe9aefb3ccea73f10ea7ab7b3)), closes [#350](https://github.com/bdougie/contributor.info/issues/350)
* enhance triage bot with [@continue-agent](https://github.com/continue-agent) mentions and context awareness ([#582](https://github.com/bdougie/contributor.info/issues/582)) ([a55b584](https://github.com/bdougie/contributor.info/commit/a55b5848cdadedda31d5e2faaa99f4f4ea0b54d7)), closes [#580](https://github.com/bdougie/contributor.info/issues/580) [#580](https://github.com/bdougie/contributor.info/issues/580)
* **health-metrics:** expand contributor definition and add issue engagement ([#1026](https://github.com/bdougie/contributor.info/issues/1026)) ([e5e6f48](https://github.com/bdougie/contributor.info/commit/e5e6f485765f972e09a933366cd0094312a3b121)), closes [#1004](https://github.com/bdougie/contributor.info/issues/1004)
* **health:** add YOLO Coders button to lottery factor card ([#1006](https://github.com/bdougie/contributor.info/issues/1006)) ([9537e10](https://github.com/bdougie/contributor.info/commit/9537e10fbbc04fb079d2afcc43b158b7f838c2ee)), closes [#1005](https://github.com/bdougie/contributor.info/issues/1005)
* implement comprehensive code-splitting strategy for bundle optimization ([#616](https://github.com/bdougie/contributor.info/issues/616)) ([9e02230](https://github.com/bdougie/contributor.info/commit/9e0223076f4c06059c63ad3747b51af000e04088))
* implement comprehensive feature flag system with PostHog integration ([#628](https://github.com/bdougie/contributor.info/issues/628)) ([68419c1](https://github.com/bdougie/contributor.info/commit/68419c1e67ddb14c018321096c2d2913378919cb)), closes [#610](https://github.com/bdougie/contributor.info/issues/610)
* implement comprehensive issue comment metrics and first responder tracking ([#670](https://github.com/bdougie/contributor.info/issues/670)) ([#675](https://github.com/bdougie/contributor.info/issues/675)) ([3590db5](https://github.com/bdougie/contributor.info/commit/3590db5c427939e24c6eddf9ad7097f79d543b3f)), closes [gh-datapipe#86](https://github.com/bdougie/gh-datapipe/issues/86) [#678](https://github.com/bdougie/contributor.info/issues/678)
* implement documentation review workflow with Continue Agent ([#571](https://github.com/bdougie/contributor.info/issues/571)) ([3a0d162](https://github.com/bdougie/contributor.info/commit/3a0d16215b29dd0e97b8e07ec30019519e92b696)), closes [#566](https://github.com/bdougie/contributor.info/issues/566)
* implement Edge Function concurrency management system ([#720](https://github.com/bdougie/contributor.info/issues/720)) ([dc031dc](https://github.com/bdougie/contributor.info/commit/dc031dc9f921bb59b7438f776373672ae8a96911)), closes [#488](https://github.com/bdougie/contributor.info/issues/488) [#719](https://github.com/bdougie/contributor.info/issues/719) [#718](https://github.com/bdougie/contributor.info/issues/718) [#489](https://github.com/bdougie/contributor.info/issues/489)
* implement full page workspace creation at /workspaces/new ([#604](https://github.com/bdougie/contributor.info/issues/604)) ([aaaee24](https://github.com/bdougie/contributor.info/commit/aaaee24b6a3dc309d920aaa8dd147823beffa4df)), closes [#399](https://github.com/bdougie/contributor.info/issues/399) [#399](https://github.com/bdougie/contributor.info/issues/399) [#598](https://github.com/bdougie/contributor.info/issues/598) [#597](https://github.com/bdougie/contributor.info/issues/597) [#599](https://github.com/bdougie/contributor.info/issues/599) [#603](https://github.com/bdougie/contributor.info/issues/603)
* implement GitHub Events API capture for stars and forks ([#654](https://github.com/bdougie/contributor.info/issues/654)) ([5f64862](https://github.com/bdougie/contributor.info/commit/5f6486259a551e7195ffe720bcce3da53a3eec6f)), closes [#650](https://github.com/bdougie/contributor.info/issues/650)
* implement lazy loading for heavy view components ([#640](https://github.com/bdougie/contributor.info/issues/640)) ([fe8fb32](https://github.com/bdougie/contributor.info/commit/fe8fb329520348c14f48536a2a4556054ada16d9)), closes [#634](https://github.com/bdougie/contributor.info/issues/634)
* implement live data workspace activity feed with GitHub usernames ([#649](https://github.com/bdougie/contributor.info/issues/649)) ([68f9fc2](https://github.com/bdougie/contributor.info/commit/68f9fc27b54582a2d2df391e49a1a68b33019f40)), closes [#598](https://github.com/bdougie/contributor.info/issues/598) [#642](https://github.com/bdougie/contributor.info/issues/642)
* implement phase 2 strategic event tracking for user journey insights ([#617](https://github.com/bdougie/contributor.info/issues/617)) ([30b035d](https://github.com/bdougie/contributor.info/commit/30b035d1eba6bc9ea69af85344d20b8cc3269101))
* implement Polar subscription system for workspaces ([#401](https://github.com/bdougie/contributor.info/issues/401)) ([#710](https://github.com/bdougie/contributor.info/issues/710)) ([9ea3411](https://github.com/bdougie/contributor.info/commit/9ea34113d9065c64dadb3639804393312f07744f))
* implement PostHog LLM analytics for OpenAI features ([#606](https://github.com/bdougie/contributor.info/issues/606)) ([5bdc009](https://github.com/bdougie/contributor.info/commit/5bdc009f82bfdf9469a752d3e97445c549c72618))
* implement request deduplication with idempotency keys ([#718](https://github.com/bdougie/contributor.info/issues/718)) ([d37fe11](https://github.com/bdougie/contributor.info/commit/d37fe11956f35619f32aef0da58cc1ce70c3d3fc)), closes [#488](https://github.com/bdougie/contributor.info/issues/488) [#719](https://github.com/bdougie/contributor.info/issues/719)
* implement RLS performance monitoring system (Phase 5) ([#824](https://github.com/bdougie/contributor.info/issues/824)) ([6fad1c3](https://github.com/bdougie/contributor.info/commit/6fad1c35ec491c183f466e6e206bd3a0a7fcc8aa)), closes [#820](https://github.com/bdougie/contributor.info/issues/820) [#820](https://github.com/bdougie/contributor.info/issues/820)
* Implement secure GitHub App checks for fork PRs ([#613](https://github.com/bdougie/contributor.info/issues/613)) ([3db0e28](https://github.com/bdougie/contributor.info/commit/3db0e283688d8f990c2893194bf9d70855fb1c87)), closes [#585](https://github.com/bdougie/contributor.info/issues/585)
* Implement webhook priority system for GitHub App data fetching ([#969](https://github.com/bdougie/contributor.info/issues/969)) ([4805ae5](https://github.com/bdougie/contributor.info/commit/4805ae5282a6bc51f1879463ebb93f368183cc28)), closes [#263](https://github.com/bdougie/contributor.info/issues/263)
* implement workspace creation feature flag controls ([#691](https://github.com/bdougie/contributor.info/issues/691)) ([#698](https://github.com/bdougie/contributor.info/issues/698)) ([bd513f0](https://github.com/bdougie/contributor.info/commit/bd513f0839bc8c3fe64ebd8120a387298c64cb68)), closes [#291](https://github.com/bdougie/contributor.info/issues/291) [#276](https://github.com/bdougie/contributor.info/issues/276) [#276](https://github.com/bdougie/contributor.info/issues/276)
* implement workspace data aggregation service ([#561](https://github.com/bdougie/contributor.info/issues/561)) ([a2edcc9](https://github.com/bdougie/contributor.info/commit/a2edcc975981c2a696bfd6b2eeb2798e1115207b)), closes [#398](https://github.com/bdougie/contributor.info/issues/398)
* implement workspace invitation email system ([#590](https://github.com/bdougie/contributor.info/issues/590)) ([ff763e7](https://github.com/bdougie/contributor.info/commit/ff763e7f4c7f35fcaa60b425df44324167339730)), closes [#588](https://github.com/bdougie/contributor.info/issues/588)
* Implement workspace repository prioritization (Phase 2 - [#882](https://github.com/bdougie/contributor.info/issues/882)) ([#907](https://github.com/bdougie/contributor.info/issues/907)) ([a8599dc](https://github.com/bdougie/contributor.info/commit/a8599dca3fc882bebce6c873853f492015d19180))
* improve Continue AI code review accuracy ([#1069](https://github.com/bdougie/contributor.info/issues/1069)) ([661b4d0](https://github.com/bdougie/contributor.info/commit/661b4d03d285d526e1b9867f27385e6c7f21ba33)), closes [#1067](https://github.com/bdougie/contributor.info/issues/1067)
* improve PR review status and distribution charts UI ([#766](https://github.com/bdougie/contributor.info/issues/766)) ([d46564d](https://github.com/bdougie/contributor.info/commit/d46564d7c5f80bb845ae861010b75801bbf7cbf8))
* improve scatterplot enhancement toggle UX ([#639](https://github.com/bdougie/contributor.info/issues/639)) ([cfe034c](https://github.com/bdougie/contributor.info/commit/cfe034c8cf43494d9f844cb5dbe0bb72f9b3aeb1))
* improve similar items response format and filtering ([#1044](https://github.com/bdougie/contributor.info/issues/1044)) ([4c06ded](https://github.com/bdougie/contributor.info/commit/4c06ded90794fde045f1fc63e2b4e53881f2e705))
* improve similar items response format and filtering ([#1044](https://github.com/bdougie/contributor.info/issues/1044)) ([8780b9e](https://github.com/bdougie/contributor.info/commit/8780b9e12676c68aebb5543273340e64caa53ee9))
* improve workspace table links and layout ([#739](https://github.com/bdougie/contributor.info/issues/739)) ([1b4b31f](https://github.com/bdougie/contributor.info/commit/1b4b31f75f0c7ad4355b4f6117f895141fd6ea5a))
* Integrate commit capture with progressive data system ([#830](https://github.com/bdougie/contributor.info/issues/830)) ([#835](https://github.com/bdougie/contributor.info/issues/835)) ([9c71161](https://github.com/bdougie/contributor.info/commit/9c71161f8def87044ef7033d6e8d3e2b1c0215ff))
* integrate useWorkspaceIssues hook with linked PRs support ([#1095](https://github.com/bdougie/contributor.info/issues/1095)) ([f83dbec](https://github.com/bdougie/contributor.info/commit/f83dbec77343dea4bdda6a5f73b3135cc9d19f1f)), closes [#1074](https://github.com/bdougie/contributor.info/issues/1074)
* **logs:** suppress console.logs in production ([#1084](https://github.com/bdougie/contributor.info/issues/1084)) ([183f82d](https://github.com/bdougie/contributor.info/commit/183f82dc7047a33dd8f3a53e543321aeb4f34679))
* make demo workspace page responsive and mobile-friendly ([#641](https://github.com/bdougie/contributor.info/issues/641)) ([33275e4](https://github.com/bdougie/contributor.info/commit/33275e4af8caedb2f4959477256e742abf67c09a))
* migrate CODEOWNERS and Workspace Sync APIs to Supabase Edge Functions ([#1088](https://github.com/bdougie/contributor.info/issues/1088)) ([2030a9f](https://github.com/bdougie/contributor.info/commit/2030a9f248e45459b7d2a8edb8b12abec2be09f8)), closes [#1070](https://github.com/bdougie/contributor.info/issues/1070)
* migrate critical CSS to external stylesheet for CSP Phase 2 ([#665](https://github.com/bdougie/contributor.info/issues/665)) ([f436ae6](https://github.com/bdougie/contributor.info/commit/f436ae6a6bd0b4e15cc85e859beb440021777924)), closes [#655](https://github.com/bdougie/contributor.info/issues/655)
* Migrate inngest-prod-functions to Supabase Edge Functions ([#754](https://github.com/bdougie/contributor.info/issues/754)) ([43389c6](https://github.com/bdougie/contributor.info/commit/43389c63afeb4e0c41fe6a0f4f8b64c92c96d0ac)), closes [#487](https://github.com/bdougie/contributor.info/issues/487)
* migrate PR compliance to secure pull_request_target event ([#620](https://github.com/bdougie/contributor.info/issues/620)) ([048b297](https://github.com/bdougie/contributor.info/commit/048b29721621d7b5d24cda0488b27867cd50a49f))
* Modernize Snyk security workflow with Continue CLI ([#866](https://github.com/bdougie/contributor.info/issues/866)) ([302a77c](https://github.com/bdougie/contributor.info/commit/302a77cb0c0ed782d4f59d15190746420016d59b))
* **monitoring:** Add PostHog error tracking for 500 errors and critical failures ([#949](https://github.com/bdougie/contributor.info/issues/949)) ([035426a](https://github.com/bdougie/contributor.info/commit/035426a2ea29268d48a545cb5fd8d71c0661d579)), closes [#939](https://github.com/bdougie/contributor.info/issues/939) [#940](https://github.com/bdougie/contributor.info/issues/940)
* Move all mock data to dedicated /i/demo workspace ([#624](https://github.com/bdougie/contributor.info/issues/624)) ([9c48d21](https://github.com/bdougie/contributor.info/commit/9c48d2156ad671971cb011a174c1fcc4d1b93cb8)), closes [#611](https://github.com/bdougie/contributor.info/issues/611)
* move sitemap generation to daily GitHub Actions workflow ([#581](https://github.com/bdougie/contributor.info/issues/581)) ([12f8c03](https://github.com/bdougie/contributor.info/commit/12f8c03aedc37ba251fdbe4d0652cf35c433eea0))
* **notifications:** add invite status notifications for workspace invitations ([#1003](https://github.com/bdougie/contributor.info/issues/1003)) ([64eda0b](https://github.com/bdougie/contributor.info/commit/64eda0b9393b5579f18a7114bf7da125ceff6178)), closes [#975](https://github.com/bdougie/contributor.info/issues/975) [#975](https://github.com/bdougie/contributor.info/issues/975)
* optimize bundle size by lazy-loading react-markdown ([#638](https://github.com/bdougie/contributor.info/issues/638)) ([b57a70d](https://github.com/bdougie/contributor.info/commit/b57a70d6b2f586cd8a77057d8a21a108887c26f0))
* optimize tree shaking configuration for better bundle size ([#614](https://github.com/bdougie/contributor.info/issues/614)) ([6753ddc](https://github.com/bdougie/contributor.info/commit/6753ddca5d24e4e348ff802f4ad1f6ff26b74ac9))
* optimize tree shaking configuration for better bundle size ([#615](https://github.com/bdougie/contributor.info/issues/615)) ([5e86166](https://github.com/bdougie/contributor.info/commit/5e861667f65667ab2929e6fb53670ff2ac825e87))
* Re-enable embeddings via dual Inngest architecture ([#903](https://github.com/bdougie/contributor.info/issues/903)) ([#904](https://github.com/bdougie/contributor.info/issues/904)) ([a057ce4](https://github.com/bdougie/contributor.info/commit/a057ce478970cf2765a28f774b58a0bbde54589e)), closes [#899](https://github.com/bdougie/contributor.info/issues/899)
* Remove 'unsafe-inline' from CSP script-src (Phase 1) ([#663](https://github.com/bdougie/contributor.info/issues/663)) ([3b60ce1](https://github.com/bdougie/contributor.info/commit/3b60ce1a0b643d9f44d39d48b8948f162d708f64)), closes [#655](https://github.com/bdougie/contributor.info/issues/655)
* remove SECURITY DEFINER from database functions ([#812](https://github.com/bdougie/contributor.info/issues/812)) ([346c537](https://github.com/bdougie/contributor.info/commit/346c5376286d6b143546ac7de59be386c27e6754))
* remove stars and forks from repo-view PR activity feed ([#674](https://github.com/bdougie/contributor.info/issues/674)) ([56cff25](https://github.com/bdougie/contributor.info/commit/56cff253aa11f0ab03c74fd90759fb4b0da3b3ed))
* replace star count with velocity metric and fix trend calculation ([#958](https://github.com/bdougie/contributor.info/issues/958)) ([c973570](https://github.com/bdougie/contributor.info/commit/c97357048f929562a13419af4354cfbb27899982)), closes [#660](https://github.com/bdougie/contributor.info/issues/660) [#660](https://github.com/bdougie/contributor.info/issues/660) [#659](https://github.com/bdougie/contributor.info/issues/659) [#660](https://github.com/bdougie/contributor.info/issues/660) [#661](https://github.com/bdougie/contributor.info/issues/661) [#660-661](https://github.com/bdougie/contributor.info/issues/660-661) [#957](https://github.com/bdougie/contributor.info/issues/957)
* replace TypeScript any types with proper interfaces in components ([#591](https://github.com/bdougie/contributor.info/issues/591)) ([9bb59d5](https://github.com/bdougie/contributor.info/commit/9bb59d55b4e244cb5cd7a088de347317913f50fe)), closes [#541](https://github.com/bdougie/contributor.info/issues/541) [#577](https://github.com/bdougie/contributor.info/issues/577) [#588](https://github.com/bdougie/contributor.info/issues/588) [#542](https://github.com/bdougie/contributor.info/issues/542)
* simplify continue-review with TLDR and remove metrics ([#846](https://github.com/bdougie/contributor.info/issues/846)) ([ebd4c82](https://github.com/bdougie/contributor.info/commit/ebd4c821ece373d08591ff019bf68d1668bdde53))
* **social-cards:** update design to match app dark theme ([#912](https://github.com/bdougie/contributor.info/issues/912)) ([3145121](https://github.com/bdougie/contributor.info/commit/3145121a4f0b28df266d5e427c34000b4fa85f66)), closes [#FF5402](https://github.com/bdougie/contributor.info/issues/FF5402) [#901](https://github.com/bdougie/contributor.info/issues/901)
* Team Collaboration with Role-Based Permissions ([#711](https://github.com/bdougie/contributor.info/issues/711)) ([45fd56b](https://github.com/bdougie/contributor.info/commit/45fd56b742ab2b2d2d9837886a2214ec24c02033)), closes [#401](https://github.com/bdougie/contributor.info/issues/401)
* Testing & Quality Assurance for Edge Functions ([#1022](https://github.com/bdougie/contributor.info/issues/1022)) ([#1055](https://github.com/bdougie/contributor.info/issues/1055)) ([86f838d](https://github.com/bdougie/contributor.info/commit/86f838d8c75e01b5156035576ea88d09827149e2))
* This includes adding a state variable `showAllContributors` and condi… ([#930](https://github.com/bdougie/contributor.info/issues/930)) ([c5a5633](https://github.com/bdougie/contributor.info/commit/c5a5633981ac6ddba852668b777450a4d499de44)), closes [#931](https://github.com/bdougie/contributor.info/issues/931) [#931](https://github.com/bdougie/contributor.info/issues/931)
* **ui:** show GitHub icon on login button only on mobile ([#1027](https://github.com/bdougie/contributor.info/issues/1027)) ([602aef5](https://github.com/bdougie/contributor.info/commit/602aef56bd59e953d7d84f048c8c266e29482a7a))
* **ui:** Update notification icon from mail to bell ([#1117](https://github.com/bdougie/contributor.info/issues/1117)) ([caf4aa7](https://github.com/bdougie/contributor.info/commit/caf4aa727999a1dd56df3dd95edfd9cec89d4642))
* Update favicon and workspace icon to plant logo ([#963](https://github.com/bdougie/contributor.info/issues/963)) ([1979eae](https://github.com/bdougie/contributor.info/commit/1979eae8c43ff591cb89379b4507b93d572f27c0))
* update leaderboard cards to match workspace contributor card styling ([#531](https://github.com/bdougie/contributor.info/issues/531)) ([bc039bf](https://github.com/bdougie/contributor.info/commit/bc039bfffd463176447d982b9205e8723b7f2a2e))
* Update to bdougie-test org and review-bot config ([7c6eb97](https://github.com/bdougie/contributor.info/commit/7c6eb971d1cfc121f048ab1d15ce57ca295d5652))
* Update workspace navigation to use slugs instead of IDs ([#763](https://github.com/bdougie/contributor.info/issues/763)) ([e0ae5c8](https://github.com/bdougie/contributor.info/commit/e0ae5c83c48f4fe7b82326e34e1d938c33e1847a))
* Use npx and add Anthropic API key ([b0da1aa](https://github.com/bdougie/contributor.info/commit/b0da1aad193b99fafca8a59fcdf1f5c4ddafbf97))
* Webhook consolidation with real-time similarity and monitoring (Phases 0-5) ([#871](https://github.com/bdougie/contributor.info/issues/871)) ([75437ee](https://github.com/bdougie/contributor.info/commit/75437eeac3eff725a60a838964cd8698f8d0747f))
* **widgets:** Default embeddable widgets to dark mode ([#947](https://github.com/bdougie/contributor.info/issues/947)) ([fdf56bc](https://github.com/bdougie/contributor.info/commit/fdf56bcf08b634568eec4872b06c5e81e3445410)), closes [#0A0A0](https://github.com/bdougie/contributor.info/issues/0A0A0) [#141414](https://github.com/bdougie/contributor.info/issues/141414) [#FF5402](https://github.com/bdougie/contributor.info/issues/FF5402) [#912](https://github.com/bdougie/contributor.info/issues/912) [#943](https://github.com/bdougie/contributor.info/issues/943) [#FF5402](https://github.com/bdougie/contributor.info/issues/FF5402) [#0A0A0](https://github.com/bdougie/contributor.info/issues/0A0A0) [#141414](https://github.com/bdougie/contributor.info/issues/141414)
* Workspace Command Palette with Slug Support (Phase 2) ([#521](https://github.com/bdougie/contributor.info/issues/521)) ([74808a7](https://github.com/bdougie/contributor.info/commit/74808a751cbaef2dc448fc13ef254513a24abea5))
* workspace invitation UI with upgrade CTAs ([#713](https://github.com/bdougie/contributor.info/issues/713)) ([dbd62f8](https://github.com/bdougie/contributor.info/commit/dbd62f802f359c890034689d7b33b8fd2063208c)), closes [#397](https://github.com/bdougie/contributor.info/issues/397)
* Workspace Navigation - Phase 1 Implementation ([#520](https://github.com/bdougie/contributor.info/issues/520)) ([3a6e5c8](https://github.com/bdougie/contributor.info/commit/3a6e5c8458aca582004526716207673d2fa24bb3)), closes [#400](https://github.com/bdougie/contributor.info/issues/400)
* **workspace:** add billing link to entice workspace creation ([#1050](https://github.com/bdougie/contributor.info/issues/1050)) ([8ac3e0f](https://github.com/bdougie/contributor.info/commit/8ac3e0f53e646dea7883714abd715734468c89b1))
* **workspace:** Add linked PRs support for issues tab ([#1072](https://github.com/bdougie/contributor.info/issues/1072)) ([98d2e58](https://github.com/bdougie/contributor.info/commit/98d2e588478298a156fb55f1e1200d998a836e6c))
* **workspace:** add My Work card with live data integration ([#1001](https://github.com/bdougie/contributor.info/issues/1001)) ([e157991](https://github.com/bdougie/contributor.info/commit/e157991bc9ffde0318d52931695ef3d380ea8616)), closes [#997](https://github.com/bdougie/contributor.info/issues/997) [#789](https://github.com/bdougie/contributor.info/issues/789) [#1009](https://github.com/bdougie/contributor.info/issues/1009) [#1010](https://github.com/bdougie/contributor.info/issues/1010) [#1011](https://github.com/bdougie/contributor.info/issues/1011) [/github.com/bdougie/contributor.info/pull/1001#issuecomment-3382175710](https://github.com/bdougie//github.com/bdougie/contributor.info/pull/1001/issues/issuecomment-3382175710)
* **workspace:** add pagination to discussions table ([#997](https://github.com/bdougie/contributor.info/issues/997)) ([ea11c76](https://github.com/bdougie/contributor.info/commit/ea11c76a9790ad6014b4e05fdef36f016cbb5526))
* **workspace:** integrate GitHub events cache for rich analytics ([#688](https://github.com/bdougie/contributor.info/issues/688)) ([5597018](https://github.com/bdougie/contributor.info/commit/559701889aeb13e9fdde7516a587264761a7d012))
* **workspace:** require login for metrics and trends cards ([#993](https://github.com/bdougie/contributor.info/issues/993)) ([a3e22a4](https://github.com/bdougie/contributor.info/commit/a3e22a40ccc6daebffd567e0ce90f484b06da791)), closes [#991](https://github.com/bdougie/contributor.info/issues/991)


### 🐛 Bug Fixes

* **activity:** use Supabase avatar cache for activity page ([#1061](https://github.com/bdougie/contributor.info/issues/1061)) ([5041749](https://github.com/bdougie/contributor.info/commit/50417494f8d5505b1324621c24b409e7c8df0916)), closes [#1058](https://github.com/bdougie/contributor.info/issues/1058)
* Add blocklist to prevent app routes from being treated as GitHub repos ([#914](https://github.com/bdougie/contributor.info/issues/914)) ([264533b](https://github.com/bdougie/contributor.info/commit/264533b63a8b62da6da2a3ba817e7bc25d5980bc))
* Add comprehensive diagnostic logging for gh-datapipe backfill 500 errors ([#889](https://github.com/bdougie/contributor.info/issues/889)) ([615c443](https://github.com/bdougie/contributor.info/commit/615c443c655ea374ace2b1115760e46f0abcb547)), closes [#144](https://github.com/bdougie/contributor.info/issues/144)
* add comprehensive error logging to Inngest compute-embeddings function ([#1041](https://github.com/bdougie/contributor.info/issues/1041)) ([4f43cd0](https://github.com/bdougie/contributor.info/commit/4f43cd00776f29219e16e16025b2723aa76801a2))
* Add config flag to cn command ([4b5639c](https://github.com/bdougie/contributor.info/commit/4b5639c821dd77a7ee85eed4ef85e3dfca363449))
* Add docs subdomain to CSP connect-src directive ([#967](https://github.com/bdougie/contributor.info/issues/967)) ([a69f9a3](https://github.com/bdougie/contributor.info/commit/a69f9a34c71ab2bc3009c08e440913152ca9b765)), closes [#964](https://github.com/bdougie/contributor.info/issues/964)
* Add error handling to capture Continue CLI failures ([920a18c](https://github.com/bdougie/contributor.info/commit/920a18c78ce3f3cd62a8a3cc3994052370770544))
* add manual sync button for stale workspace activity data ([#764](https://github.com/bdougie/contributor.info/issues/764)) ([7882029](https://github.com/bdougie/contributor.info/commit/7882029a88780632d8fa633c0e37db04650633e5)), closes [#767](https://github.com/bdougie/contributor.info/issues/767)
* Add missing last_updated field to pull_requests table ([#727](https://github.com/bdougie/contributor.info/issues/727)) ([2c93136](https://github.com/bdougie/contributor.info/commit/2c9313634334ee40e82a9c78f9f08d71a72857f8))
* Add missing original_commit_id column to comments table ([#918](https://github.com/bdougie/contributor.info/issues/918)) ([1484390](https://github.com/bdougie/contributor.info/commit/1484390f2bcf9db7d5c5630d8721c3f43f67a319))
* Add missing repository_id and author_id to review writes ([#926](https://github.com/bdougie/contributor.info/issues/926)) ([f91b093](https://github.com/bdougie/contributor.info/commit/f91b093850fe3d7f0e611c585c1d6cd27c162187)), closes [#921](https://github.com/bdougie/contributor.info/issues/921)
* Add missing workspace priority migration from PR [#907](https://github.com/bdougie/contributor.info/issues/907) ([#911](https://github.com/bdougie/contributor.info/issues/911)) ([f3feeff](https://github.com/bdougie/contributor.info/commit/f3feeff9ba8397e1dd1b93c54514a4fcca4632eb))
* add PostHog assets URL to CSP connect-src directive ([#653](https://github.com/bdougie/contributor.info/issues/653)) ([10c2fff](https://github.com/bdougie/contributor.info/commit/10c2ffff958fe2a6efa31a8e48bb9ea0b52f2d83)), closes [#645](https://github.com/bdougie/contributor.info/issues/645) [#655](https://github.com/bdougie/contributor.info/issues/655)
* add redirects for legacy workspace invitation URLs ([#1030](https://github.com/bdougie/contributor.info/issues/1030)) ([25a146d](https://github.com/bdougie/contributor.info/commit/25a146d07ef9c52b43bb6e32524334052108acb5)), closes [#1008](https://github.com/bdougie/contributor.info/issues/1008)
* Add repository_full_name column to pull_requests table ([#768](https://github.com/bdougie/contributor.info/issues/768)) ([d5c2381](https://github.com/bdougie/contributor.info/commit/d5c2381c26baf58826e5edce7fcdd29724ca25dc)), closes [#765](https://github.com/bdougie/contributor.info/issues/765)
* Add repository_full_name to PR upsert in GraphQL capture ([#906](https://github.com/bdougie/contributor.info/issues/906)) ([71eecba](https://github.com/bdougie/contributor.info/commit/71eecba11e6a3ba66e002a1e610c9ab0e81aabb1))
* Add repository_id column to reviews table ([#909](https://github.com/bdougie/contributor.info/issues/909)) ([69292ca](https://github.com/bdougie/contributor.info/commit/69292caef5d63a8b17c6303cd2555e70b88ce62e))
* Add respond tracking columns to correct 'issues' table ([#1085](https://github.com/bdougie/contributor.info/issues/1085)) ([eab3c78](https://github.com/bdougie/contributor.info/commit/eab3c78039c1ac30b1a5d7c639283e4ccea49215)), closes [#1060](https://github.com/bdougie/contributor.info/issues/1060) [#1060](https://github.com/bdougie/contributor.info/issues/1060) [#1060](https://github.com/bdougie/contributor.info/issues/1060)
* add security audit overrides for known false positives ([#705](https://github.com/bdougie/contributor.info/issues/705)) ([dc60c3e](https://github.com/bdougie/contributor.info/commit/dc60c3e497eae5227b64dcad395299ff5e8b4521))
* align PR table links with Issues dashboard format ([#784](https://github.com/bdougie/contributor.info/issues/784)) ([72efd4a](https://github.com/bdougie/contributor.info/commit/72efd4a096f1bd13a1f3895f4ebcb01277d647a9))
* allow workspace invitation lookup by token ([#1068](https://github.com/bdougie/contributor.info/issues/1068)) ([ff44542](https://github.com/bdougie/contributor.info/commit/ff44542a00322c5858f5c150520046c2a1aa40cf))
* **api:** resolve 404 error in backfill trigger endpoint ([#1087](https://github.com/bdougie/contributor.info/issues/1087)) ([623ca71](https://github.com/bdougie/contributor.info/commit/623ca7193c0935e4cf0a1be583704714e12cf16c)), closes [#1059](https://github.com/bdougie/contributor.info/issues/1059) [#1059](https://github.com/bdougie/contributor.info/issues/1059)
* audit and fix database migrations for universal compatibility ([#559](https://github.com/bdougie/contributor.info/issues/559)) ([3f3aebe](https://github.com/bdougie/contributor.info/commit/3f3aebe16cb0656aecb7e52548b3c85e66240ffb)), closes [#552](https://github.com/bdougie/contributor.info/issues/552) [#552](https://github.com/bdougie/contributor.info/issues/552) [#503](https://github.com/bdougie/contributor.info/issues/503)
* **auth:** update GitHub OAuth scope from 'repo' to 'public_repo' ([#1051](https://github.com/bdougie/contributor.info/issues/1051)) ([af98ca0](https://github.com/bdougie/contributor.info/commit/af98ca007f0681b0da02d962bae08434bf899a15))
* **avatars:** replace GitHub avatar URLs with Supabase cached avatars ([#994](https://github.com/bdougie/contributor.info/issues/994)) ([14e731c](https://github.com/bdougie/contributor.info/commit/14e731c86d48d178c9d367aa15112267134a0a3d)), closes [#990](https://github.com/bdougie/contributor.info/issues/990)
* **billing:** display three plan cards side-by-side on medium+ screens ([#978](https://github.com/bdougie/contributor.info/issues/978)) ([81cafd9](https://github.com/bdougie/contributor.info/commit/81cafd961b64aae4c9da6ad43045ac4540925bbc))
* center app content with margin auto ([#946](https://github.com/bdougie/contributor.info/issues/946)) ([b4f34dc](https://github.com/bdougie/contributor.info/commit/b4f34dcfe44e4c2ee99920182d3ddf200ea4db31)), closes [#945](https://github.com/bdougie/contributor.info/issues/945)
* Code Activity chart data display consistency ([#555](https://github.com/bdougie/contributor.info/issues/555)) ([8050255](https://github.com/bdougie/contributor.info/commit/8050255d7d6874e7079b7dd358a2a0720683dd20))
* Configure workspace invitation email system ([#860](https://github.com/bdougie/contributor.info/issues/860)) ([f0f4585](https://github.com/bdougie/contributor.info/commit/f0f45858068a12cd125788ead45becb6cbb23da1)), closes [#857](https://github.com/bdougie/contributor.info/issues/857)
* consistent workspace UI width constraints ([#680](https://github.com/bdougie/contributor.info/issues/680)) ([68aca76](https://github.com/bdougie/contributor.info/commit/68aca76d956cb2e93bbc79c23b798a71d8de164a))
* consolidate 91 duplicate permissive RLS policies (Phase 2) ([#818](https://github.com/bdougie/contributor.info/issues/818)) ([c7d8c8c](https://github.com/bdougie/contributor.info/commit/c7d8c8c137d7ea7ca9e87a3fa25f8e9da93573bb)), closes [#816](https://github.com/bdougie/contributor.info/issues/816)
* **continue-review:** prevent truncation warnings in reviews ([#971](https://github.com/bdougie/contributor.info/issues/971)) ([45f10a3](https://github.com/bdougie/contributor.info/commit/45f10a3be0c0d16f773b20e019378b2c33462959))
* Contributor of the month cards not rendering ([#695](https://github.com/bdougie/contributor.info/issues/695)) ([#744](https://github.com/bdougie/contributor.info/issues/744)) ([4de262d](https://github.com/bdougie/contributor.info/commit/4de262db8f28bb4ee69a03d2e44ff9ad78719816)), closes [#1](https://github.com/bdougie/contributor.info/issues/1) [#1](https://github.com/bdougie/contributor.info/issues/1) [#1](https://github.com/bdougie/contributor.info/issues/1) [#1](https://github.com/bdougie/contributor.info/issues/1) [#1](https://github.com/bdougie/contributor.info/issues/1) [#1](https://github.com/bdougie/contributor.info/issues/1)
* Contributor of the Month showing wrong time period data ([#932](https://github.com/bdougie/contributor.info/issues/932)) ([8a7d1bb](https://github.com/bdougie/contributor.info/commit/8a7d1bb5ce53df0319524c4eca7e71e33867d93a)), closes [#931](https://github.com/bdougie/contributor.info/issues/931)
* correct console.error parameter order in Inngest capture functions ([#1056](https://github.com/bdougie/contributor.info/issues/1056)) ([5751135](https://github.com/bdougie/contributor.info/commit/5751135c7e326b06106d4f6fefa414592fa7d86e)), closes [#1026](https://github.com/bdougie/contributor.info/issues/1026) [#788](https://github.com/bdougie/contributor.info/issues/788)
* correct My Work card to query issues table with proper schema ([#1047](https://github.com/bdougie/contributor.info/issues/1047)) ([8518f64](https://github.com/bdougie/contributor.info/commit/8518f646153d760b682cf031b01c0522c21cb5e9))
* Correct Netlify Functions directory structure to resolve 404 errors ([#1081](https://github.com/bdougie/contributor.info/issues/1081)) ([3d1a962](https://github.com/bdougie/contributor.info/commit/3d1a962741dcca9d75f3d1c84c27a1909febce7a)), closes [#1079](https://github.com/bdougie/contributor.info/issues/1079)
* CORS header case sensitivity for queue-event Edge Function ([#728](https://github.com/bdougie/contributor.info/issues/728)) ([6a3b8a4](https://github.com/bdougie/contributor.info/commit/6a3b8a4d08e4885dd7e649ea4ba6f1e16931b48a))
* critical race condition fixes for start-local-supabase script ([#619](https://github.com/bdougie/contributor.info/issues/619)) ([2df7071](https://github.com/bdougie/contributor.info/commit/2df707176bfc91f684ee3306c87c093d0a1b16ad))
* critical webhook system issues from PR review ([#723](https://github.com/bdougie/contributor.info/issues/723)) ([7983e13](https://github.com/bdougie/contributor.info/commit/7983e13339ba970f5bc6db7e9f4befb63303b942))
* **database:** add workspace discussion similarity function with correct VARCHAR type ([#1012](https://github.com/bdougie/contributor.info/issues/1012)) ([f9b0f45](https://github.com/bdougie/contributor.info/commit/f9b0f4512ddf3f42f50fb20bf23ec4ee2e519c84)), closes [#1011](https://github.com/bdougie/contributor.info/issues/1011)
* **db:** ensure original_commit_id column exists in comments table ([#1024](https://github.com/bdougie/contributor.info/issues/1024)) ([94784b2](https://github.com/bdougie/contributor.info/commit/94784b2adf5c0c89564588fd9cfd902935589435)), closes [#1015](https://github.com/bdougie/contributor.info/issues/1015)
* Disable client-side telemetry to prevent 403 errors ([#881](https://github.com/bdougie/contributor.info/issues/881)) ([8f6135a](https://github.com/bdougie/contributor.info/commit/8f6135a33c9b175299d1a782bcd84ce8aa0d2a43))
* **discussions:** auto-generate summaries and ensure authors in contributors ([#999](https://github.com/bdougie/contributor.info/issues/999)) ([1a9457e](https://github.com/bdougie/contributor.info/commit/1a9457e0695f26e9a14438d3ae2998c996451445))
* display specific time ranges in workspace metrics trend labels ([#536](https://github.com/bdougie/contributor.info/issues/536)) ([2ef7d8e](https://github.com/bdougie/contributor.info/commit/2ef7d8e008bdfed7bf0db4e6f3e7f2fe5cca4069)), closes [#534](https://github.com/bdougie/contributor.info/issues/534)
* **docs-review:** encourage review of existing docs for code changes ([#1007](https://github.com/bdougie/contributor.info/issues/1007)) ([71ad54a](https://github.com/bdougie/contributor.info/commit/71ad54a4ec03dd2a08772d872338a2c7eb8cc17b)), closes [#1006](https://github.com/bdougie/contributor.info/issues/1006)
* **docs:** Fix MDX syntax errors and broken links in Mintlify docs ([#956](https://github.com/bdougie/contributor.info/issues/956)) ([03d2b13](https://github.com/bdougie/contributor.info/commit/03d2b1326e7090203a88b510ab78bbb42fb1a914))
* **email:** correct workspace invitation URL format in emails ([#864](https://github.com/bdougie/contributor.info/issues/864)) ([d5ae872](https://github.com/bdougie/contributor.info/commit/d5ae87231e0845efd4cf04138447aa24c8e90b3e)), closes [#863](https://github.com/bdougie/contributor.info/issues/863)
* **embeddings:** add discussions to embedding generation pipeline ([#1013](https://github.com/bdougie/contributor.info/issues/1013)) ([ff29adb](https://github.com/bdougie/contributor.info/commit/ff29adb9ce00275fc61fe011ba97a0ccbc39e938)), closes [#1010](https://github.com/bdougie/contributor.info/issues/1010)
* **embeddings:** add discussions to embedding generation system ([#1014](https://github.com/bdougie/contributor.info/issues/1014)) ([6764cde](https://github.com/bdougie/contributor.info/commit/6764cde2e5c286bad8d9e94ea1a4e57b46cd4596)), closes [#1009](https://github.com/bdougie/contributor.info/issues/1009)
* **embeddings:** configure esbuild to use ESM format for inngest-embeddings ([#1019](https://github.com/bdougie/contributor.info/issues/1019)) ([97fa6b5](https://github.com/bdougie/contributor.info/commit/97fa6b5dd584d26cb14e02364ea6de55f3345bfd)), closes [#1016](https://github.com/bdougie/contributor.info/issues/1016)
* enable PostHog analytics beyond just web vitals ([#605](https://github.com/bdougie/contributor.info/issues/605)) ([9b6e566](https://github.com/bdougie/contributor.info/commit/9b6e56637d25b4e293b48cf7b4154eccaf41812e)), closes [#593](https://github.com/bdougie/contributor.info/issues/593)
* Enable public read access for pull_requests table ([#853](https://github.com/bdougie/contributor.info/issues/853)) ([d958ac6](https://github.com/bdougie/contributor.info/commit/d958ac6e162488c205628e544765a365eac493ea))
* enable workspace metrics aggregation on manual sync ([#1048](https://github.com/bdougie/contributor.info/issues/1048)) ([9d233e1](https://github.com/bdougie/contributor.info/commit/9d233e1070391384c92aed55612c8c42b3eb50b1)), closes [#8164](https://github.com/bdougie/contributor.info/issues/8164) [#8166](https://github.com/bdougie/contributor.info/issues/8166)
* Ensure track-repository endpoint is properly deployed ([#794](https://github.com/bdougie/contributor.info/issues/794)) ([89db1ec](https://github.com/bdougie/contributor.info/commit/89db1ecdef7d52f00e416e96affb5b6a904fcbaa)), closes [#776](https://github.com/bdougie/contributor.info/issues/776)
* Fix Lighthouse CI configuration for proper performance monitoring ([#607](https://github.com/bdougie/contributor.info/issues/607)) ([5d69364](https://github.com/bdougie/contributor.info/commit/5d693649acb9ffbcb38b51eb7cf13c2b8fca53ae)), closes [#601](https://github.com/bdougie/contributor.info/issues/601) [#593](https://github.com/bdougie/contributor.info/issues/593)
* Guard import.meta.url usage in evals CLI detection ([34c6390](https://github.com/bdougie/contributor.info/commit/34c6390ca19b1d92cc0ca60f098d7ffcb8aaa0a6))
* handle dry-run input safely in continue-triage action ([#569](https://github.com/bdougie/contributor.info/issues/569)) ([cbfdb84](https://github.com/bdougie/contributor.info/commit/cbfdb841451d6db032e4f0fbf053b0e871805b88)), closes [#567](https://github.com/bdougie/contributor.info/issues/567) [#568](https://github.com/bdougie/contributor.info/issues/568)
* handle HTTP 206 partial responses in Service Worker ([#565](https://github.com/bdougie/contributor.info/issues/565)) ([18ef4e6](https://github.com/bdougie/contributor.info/commit/18ef4e6f0f888f97091e1715aea534d3ba0ff668))
* handle missing prNumber in capture/pr.comments gracefully ([#1106](https://github.com/bdougie/contributor.info/issues/1106)) ([0ba0d3a](https://github.com/bdougie/contributor.info/commit/0ba0d3a75f67df79aac80efe068a98f9ea460b8c))
* implement direct database insertion for repository tracking ([#796](https://github.com/bdougie/contributor.info/issues/796)) ([16cfc00](https://github.com/bdougie/contributor.info/commit/16cfc007810aaba22e4ad6aeb4e1f7d18ae616c2)), closes [#795](https://github.com/bdougie/contributor.info/issues/795)
* implement PR reviewer data sync infrastructure ([#778](https://github.com/bdougie/contributor.info/issues/778)) ([fe517a3](https://github.com/bdougie/contributor.info/commit/fe517a353c89dd499684724a2947f6fad32c93cf))
* implement proper Inngest SDK serve endpoint for sync ([#758](https://github.com/bdougie/contributor.info/issues/758)) ([77406e6](https://github.com/bdougie/contributor.info/commit/77406e6652c3873ed7ade2c5e81d3f6785f2d278))
* improve 'Track This Repository' button placement and UI clarity ([#553](https://github.com/bdougie/contributor.info/issues/553)) ([1591b95](https://github.com/bdougie/contributor.info/commit/1591b9559a6aedf18807e845ba422cecea0256ea))
* improve [@continue-agent](https://github.com/continue-agent) bot responsiveness and error handling ([#839](https://github.com/bdougie/contributor.info/issues/839)) ([558e3a0](https://github.com/bdougie/contributor.info/commit/558e3a028cade0148af20db35e0ebe44226a58a2)), closes [#838](https://github.com/bdougie/contributor.info/issues/838)
* improve backfill trigger error handling and Inngest client resilience ([#799](https://github.com/bdougie/contributor.info/issues/799)) ([d5e30e1](https://github.com/bdougie/contributor.info/commit/d5e30e1de0a331c006c2ef3bd382b43bd3db63d3)), closes [#798](https://github.com/bdougie/contributor.info/issues/798)
* improve billing page UX and update pricing tiers ([#722](https://github.com/bdougie/contributor.info/issues/722)) ([8e011cf](https://github.com/bdougie/contributor.info/commit/8e011cf950fd96c20c5f207e136a7d2787e3724b))
* Improve CODEOWNERS 404 error handling with friendly UX ([#972](https://github.com/bdougie/contributor.info/issues/972)) ([8bd0422](https://github.com/bdougie/contributor.info/commit/8bd042296b06b4818b11bed5b5ff51d5cb2ef1f7)), closes [#968](https://github.com/bdougie/contributor.info/issues/968)
* improve continue-triage workflow triggers ([#584](https://github.com/bdougie/contributor.info/issues/584)) ([a5a1ca9](https://github.com/bdougie/contributor.info/commit/a5a1ca904e81fc3f4119fbb19c303d14aeca842e)), closes [#579](https://github.com/bdougie/contributor.info/issues/579)
* improve mobile responsive UI for workspace and landing screens ([#982](https://github.com/bdougie/contributor.info/issues/982)) ([f7eaf8d](https://github.com/bdougie/contributor.info/commit/f7eaf8dc66c415725749b9d53b38e8634d98ff39)), closes [#981](https://github.com/bdougie/contributor.info/issues/981)
* improve mobile responsiveness for workspace components ([#697](https://github.com/bdougie/contributor.info/issues/697)) ([2477369](https://github.com/bdougie/contributor.info/commit/2477369e1da6bbbc984cee26c6292b344da8b58e))
* improve progressive backfill detection with better logging and thresholds ([#1101](https://github.com/bdougie/contributor.info/issues/1101)) ([e036c4d](https://github.com/bdougie/contributor.info/commit/e036c4d26bd7b691d08f1c7a162ac7a31e203260))
* improve table link behavior and fix column overlap issues ([#792](https://github.com/bdougie/contributor.info/issues/792)) ([c030c2c](https://github.com/bdougie/contributor.info/commit/c030c2c2f14c09caf20fae0316cd96adbf703da9))
* Improve test organization and extract magic numbers ([#827](https://github.com/bdougie/contributor.info/issues/827)) ([a68f90f](https://github.com/bdougie/contributor.info/commit/a68f90f35bde9dbd8c46b40ddbf4610a8a22611b)), closes [#648](https://github.com/bdougie/contributor.info/issues/648) [#648](https://github.com/bdougie/contributor.info/issues/648)
* improve triage bot comment formatting ([#570](https://github.com/bdougie/contributor.info/issues/570)) ([a71b59e](https://github.com/bdougie/contributor.info/commit/a71b59e29cea3695c7710c802d6c63fc75c4f9a6))
* Improve workspace creation modal messaging based on auth state ([#752](https://github.com/bdougie/contributor.info/issues/752)) ([dac2278](https://github.com/bdougie/contributor.info/commit/dac2278d15710357d65f31c960b5b3ea14a1367e))
* improve workspace repository management ([#535](https://github.com/bdougie/contributor.info/issues/535)) ([ca0a089](https://github.com/bdougie/contributor.info/commit/ca0a089012b4ccf2f6da36f9e67cd7997a246e75)), closes [#528](https://github.com/bdougie/contributor.info/issues/528)
* Inngest jobs now update completion status ([#886](https://github.com/bdougie/contributor.info/issues/886)) ([8dc75ce](https://github.com/bdougie/contributor.info/commit/8dc75ce6728e3cd7a2880c897d294e3d43302513)), closes [#883](https://github.com/bdougie/contributor.info/issues/883) [#881](https://github.com/bdougie/contributor.info/issues/881) [#884](https://github.com/bdougie/contributor.info/issues/884)
* Inngest local development integration and client configuration ([#762](https://github.com/bdougie/contributor.info/issues/762)) ([07d0d3c](https://github.com/bdougie/contributor.info/commit/07d0d3ca686cd97475a45e7462dd2cd4d0684521)), closes [#754](https://github.com/bdougie/contributor.info/issues/754) [#755](https://github.com/bdougie/contributor.info/issues/755) [#770](https://github.com/bdougie/contributor.info/issues/770)
* **inngest:** resolve event data structure mismatch in Supabase Edge Functions ([#1096](https://github.com/bdougie/contributor.info/issues/1096)) ([6dde950](https://github.com/bdougie/contributor.info/commit/6dde95095a42fa1d48664dd1963644798e3c50d3)), closes [#1097](https://github.com/bdougie/contributor.info/issues/1097)
* **inngest:** resolve schema validation issues and add comprehensive tests ([#1098](https://github.com/bdougie/contributor.info/issues/1098)) ([2df7902](https://github.com/bdougie/contributor.info/commit/2df79021628aed5579cff520606f4ae24a7684e1)), closes [#1055](https://github.com/bdougie/contributor.info/issues/1055) [#1097](https://github.com/bdougie/contributor.info/issues/1097) [#1097](https://github.com/bdougie/contributor.info/issues/1097) [#1097](https://github.com/bdougie/contributor.info/issues/1097)
* Make author_id and repository_id nullable in pull_requests ([#878](https://github.com/bdougie/contributor.info/issues/878)) ([c81718c](https://github.com/bdougie/contributor.info/commit/c81718ce77be16632aee5e86564fdb9a2b23a335)), closes [#877](https://github.com/bdougie/contributor.info/issues/877) [#876](https://github.com/bdougie/contributor.info/issues/876)
* Make foreign key constraints deferrable for DLT merge compatibility ([#880](https://github.com/bdougie/contributor.info/issues/880)) ([42b9a7d](https://github.com/bdougie/contributor.info/commit/42b9a7d9c872d90effd8e155196bc134cbde1eba)), closes [#879](https://github.com/bdougie/contributor.info/issues/879)
* make pull_requests.author_id non-nullable ([#806](https://github.com/bdougie/contributor.info/issues/806)) ([5683879](https://github.com/bdougie/contributor.info/commit/568387988a481b004b563bba61d5edbe10dda240))
* make workspace loading non-blocking with better error handling ([#526](https://github.com/bdougie/contributor.info/issues/526)) ([878a7c8](https://github.com/bdougie/contributor.info/commit/878a7c8465f2299d8378688da26661ee6c1a7455)), closes [#7273](https://github.com/bdougie/contributor.info/issues/7273)
* Migrate Inngest to Supabase Edge Functions ([#899](https://github.com/bdougie/contributor.info/issues/899)) ([f842042](https://github.com/bdougie/contributor.info/commit/f842042244527a3ae0594a88750a52fb53625dee)), closes [#895](https://github.com/bdougie/contributor.info/issues/895) [#898](https://github.com/bdougie/contributor.info/issues/898) [#898](https://github.com/bdougie/contributor.info/issues/898) [#878](https://github.com/bdougie/contributor.info/issues/878)
* move action timestamps to HTML comments ([#533](https://github.com/bdougie/contributor.info/issues/533)) ([82dc88a](https://github.com/bdougie/contributor.info/commit/82dc88a28f59a9ab831b6c466d4a976b2aadba4e)), closes [#532](https://github.com/bdougie/contributor.info/issues/532)
* move Inngest event sending to server-side API for workspace sync ([#791](https://github.com/bdougie/contributor.info/issues/791)) ([2b3141d](https://github.com/bdougie/contributor.info/commit/2b3141d4e8ea8f915e5cf61d9fd98f94b7388571)), closes [#789](https://github.com/bdougie/contributor.info/issues/789) [#789](https://github.com/bdougie/contributor.info/issues/789)
* needs_attention returns NULL instead of false ([#888](https://github.com/bdougie/contributor.info/issues/888)) ([ea1eedc](https://github.com/bdougie/contributor.info/commit/ea1eedc829a472517ad8f8172f5b9b16a058245f))
* normalize contributor foreign keys handling across PRs ([#845](https://github.com/bdougie/contributor.info/issues/845)) ([347578b](https://github.com/bdougie/contributor.info/commit/347578bf65c91d5aee0f6c9a7c7018addc71cc12))
* Normalize GitHub review states to prevent database constraint violations ([#913](https://github.com/bdougie/contributor.info/issues/913)) ([9d403f4](https://github.com/bdougie/contributor.info/commit/9d403f48c98a282e9b3e9c5feb780f2685d08934))
* Normalize review states to prevent database constraint violations ([#917](https://github.com/bdougie/contributor.info/issues/917)) ([6748129](https://github.com/bdougie/contributor.info/commit/67481294c462dc67656b7a7d8713d9b6d0b5f210)), closes [#916](https://github.com/bdougie/contributor.info/issues/916)
* optimize remaining 120+ auth RLS policies (Phase 4) ([#823](https://github.com/bdougie/contributor.info/issues/823)) ([5b4157d](https://github.com/bdougie/contributor.info/commit/5b4157d2571e94347643dda3c352efef000b3cd5))
* optimize RLS auth initialization for 50+ policies (Phase 1) ([#817](https://github.com/bdougie/contributor.info/issues/817)) ([2051f42](https://github.com/bdougie/contributor.info/commit/2051f429b9d08df35b4da7e9de657ea5f19efa5e)), closes [#816](https://github.com/bdougie/contributor.info/issues/816)
* optimize RLS auth initialization for 50+ policies (Phase 1) ([#821](https://github.com/bdougie/contributor.info/issues/821)) ([bfe7103](https://github.com/bdougie/contributor.info/commit/bfe71033e655ae9692ac82d0893162b7a4960a5f)), closes [#820](https://github.com/bdougie/contributor.info/issues/820) [#820](https://github.com/bdougie/contributor.info/issues/820)
* optimize service role RLS policies (Phase 2) ([#822](https://github.com/bdougie/contributor.info/issues/822)) ([c7c4083](https://github.com/bdougie/contributor.info/commit/c7c40838a3bbc78dc17f025bcea8cb532ab95180)), closes [#820](https://github.com/bdougie/contributor.info/issues/820) [#820](https://github.com/bdougie/contributor.info/issues/820) [#820](https://github.com/bdougie/contributor.info/issues/820) [#820](https://github.com/bdougie/contributor.info/issues/820)
* pass embedding arrays directly instead of converting to strings ([#1040](https://github.com/bdougie/contributor.info/issues/1040)) ([f430967](https://github.com/bdougie/contributor.info/commit/f4309670dec386036beabc6797e4519bb817a3c6))
* persist social links after fetching from GitHub ([#948](https://github.com/bdougie/contributor.info/issues/948)) ([802d7f2](https://github.com/bdougie/contributor.info/commit/802d7f24abe9d9fa020d6a18c294297e26de3961)), closes [#925](https://github.com/bdougie/contributor.info/issues/925)
* PR data corruption - adjust auto-fix rate limit from 12h to 1h ([#525](https://github.com/bdougie/contributor.info/issues/525)) ([1557d8f](https://github.com/bdougie/contributor.info/commit/1557d8f0cd3ca8e116bb89e16b708efd625112ee)), closes [#7273](https://github.com/bdougie/contributor.info/issues/7273)
* prevent async/await patterns in unit tests to avoid CI hangs ([#787](https://github.com/bdougie/contributor.info/issues/787)) ([f23c7b5](https://github.com/bdougie/contributor.info/commit/f23c7b525bda04e580abf768f769e13ea40c357c)), closes [#779](https://github.com/bdougie/contributor.info/issues/779) [#781](https://github.com/bdougie/contributor.info/issues/781)
* Prevent workspace timeouts from auth token refreshes ([#556](https://github.com/bdougie/contributor.info/issues/556)) ([9019317](https://github.com/bdougie/contributor.info/commit/901931793b86133389ad3c4b46aebf044000da4c)), closes [#554](https://github.com/bdougie/contributor.info/issues/554)
* properly escape JSON values in compliance-secure workflow ([#622](https://github.com/bdougie/contributor.info/issues/622)) ([b0f6f45](https://github.com/bdougie/contributor.info/commit/b0f6f4583b50fa5e57469892a12e52394328f52a))
* properly type embedding item mapping without any types ([#1037](https://github.com/bdougie/contributor.info/issues/1037)) ([441f21f](https://github.com/bdougie/contributor.info/commit/441f21f572b8a50e7098d00253192d4f9e9f5b13))
* refresh My Work list after marking items as responded ([#1118](https://github.com/bdougie/contributor.info/issues/1118)) ([d27626b](https://github.com/bdougie/contributor.info/commit/d27626b242a6fbf28ad9dcc1ece8e6a1405d5ca9))
* register syncDiscussionsCron function in Inngest endpoint ([#1043](https://github.com/bdougie/contributor.info/issues/1043)) ([d6f102d](https://github.com/bdougie/contributor.info/commit/d6f102d55176f90a1e2bf7bf014dbdb0fa98fc53)), closes [#1039](https://github.com/bdougie/contributor.info/issues/1039)
* remove 11 duplicate database indexes saving 19MB (Phase 3) ([#819](https://github.com/bdougie/contributor.info/issues/819)) ([371060a](https://github.com/bdougie/contributor.info/commit/371060a03cb3d8d290989377da8add342729010c)), closes [#816](https://github.com/bdougie/contributor.info/issues/816)
* Remove all import.meta usage causing Inngest 502 errors ([#894](https://github.com/bdougie/contributor.info/issues/894)) ([80e6dc2](https://github.com/bdougie/contributor.info/commit/80e6dc20937b2dfd3f3b8857dc82a97331ace594))
* remove custom handler blocking Inngest SDK sync operations ([#760](https://github.com/bdougie/contributor.info/issues/760)) ([7322337](https://github.com/bdougie/contributor.info/commit/73223376d64bc4d4af76c1a833949d132c7a942c))
* remove DEBUG console statements from production code ([#786](https://github.com/bdougie/contributor.info/issues/786)) ([4b3f4fd](https://github.com/bdougie/contributor.info/commit/4b3f4fdf440ced82b38a486e54f46529483e9d36)), closes [#777](https://github.com/bdougie/contributor.info/issues/777) [#777](https://github.com/bdougie/contributor.info/issues/777)
* remove explicit any types and improve TypeScript type safety ([#825](https://github.com/bdougie/contributor.info/issues/825)) ([e31316a](https://github.com/bdougie/contributor.info/commit/e31316af307282bb555ae3a835b59cd39d947036)), closes [#646](https://github.com/bdougie/contributor.info/issues/646) [#646](https://github.com/bdougie/contributor.info/issues/646)
* Remove explicit snyk auth command ([d79ef7c](https://github.com/bdougie/contributor.info/commit/d79ef7cc912f657a05cd78724b8c5a00e6125c04))
* Remove import.meta.env usage from serverless functions ([d62d6fb](https://github.com/bdougie/contributor.info/commit/d62d6fbdc43a4f4aa6dad751d4e1055f5dd9a058))
* Remove incorrect Continue CLI auth step ([f2d110c](https://github.com/bdougie/contributor.info/commit/f2d110cb58f38f18e1a33332375336d118c6639b))
* Remove interactive config loading for headless mode ([af50860](https://github.com/bdougie/contributor.info/commit/af5086006f01cc3473838f1496c129355b913abe))
* Remove missing issue-similarity import from webhook handler ([#867](https://github.com/bdougie/contributor.info/issues/867)) ([15ff91c](https://github.com/bdougie/contributor.info/commit/15ff91c2c747bbdaec90c79092c568d1ddf74dea)), closes [#865](https://github.com/bdougie/contributor.info/issues/865)
* Remove non-optional import.meta.env from smart-commit-analyzer ([ce6c545](https://github.com/bdougie/contributor.info/commit/ce6c545b99eb4fc6b9a30639f5363498f77c7915))
* remove SECURITY DEFINER from database views ([#814](https://github.com/bdougie/contributor.info/issues/814)) ([918a71f](https://github.com/bdougie/contributor.info/commit/918a71f6c28ad3d2f0c67923912b92e1372c9f2e)), closes [#810](https://github.com/bdougie/contributor.info/issues/810)
* remove vulnerable database objects and SECURITY DEFINER views ([#815](https://github.com/bdougie/contributor.info/issues/815)) ([798609d](https://github.com/bdougie/contributor.info/commit/798609dc5fb3ea9db0375980b53fec031c132505))
* replace all 'any' types with proper TypeScript interfaces in webhook handlers ([#891](https://github.com/bdougie/contributor.info/issues/891)) ([8389248](https://github.com/bdougie/contributor.info/commit/8389248d17a080caab0a1f1c8f6646638a421bfe)), closes [#872](https://github.com/bdougie/contributor.info/issues/872)
* replace any types with proper TypeScript types in core library files ([#541](https://github.com/bdougie/contributor.info/issues/541) phase 1) ([#577](https://github.com/bdougie/contributor.info/issues/577)) ([5480854](https://github.com/bdougie/contributor.info/commit/5480854d61bea1e6493c590bb43f4fe379fa0ed5))
* replace template literal console.log statements with secure format specifiers ([#788](https://github.com/bdougie/contributor.info/issues/788)) ([eee9897](https://github.com/bdougie/contributor.info/commit/eee98977f7a0df797f34adf617d10f425bbf3632)), closes [#781](https://github.com/bdougie/contributor.info/issues/781)
* repository filtering now updates overall metrics ([#572](https://github.com/bdougie/contributor.info/issues/572)) ([bbde50c](https://github.com/bdougie/contributor.info/commit/bbde50c936467d3226cac001439a6b8f788f3bf4)), closes [#573](https://github.com/bdougie/contributor.info/issues/573)
* repository tracking for workspaces and repo-view ([#834](https://github.com/bdougie/contributor.info/issues/834)) ([3e4f031](https://github.com/bdougie/contributor.info/commit/3e4f03106eb665896212fe08505bfbca36c49386))
* resolve API endpoints returning HTML instead of JSON ([#793](https://github.com/bdougie/contributor.info/issues/793)) ([28db6b8](https://github.com/bdougie/contributor.info/commit/28db6b88c9ba4c2efb73bfcdb26609014b6ee442))
* resolve Edge Function 500 errors by setting INNGEST secrets ([#731](https://github.com/bdougie/contributor.info/issues/731)) ([7d7c71f](https://github.com/bdougie/contributor.info/commit/7d7c71f0508a8db42f65812425aba583757ee714)), closes [#730](https://github.com/bdougie/contributor.info/issues/730)
* resolve embeddings generation failure with dimension mismatch ([#1042](https://github.com/bdougie/contributor.info/issues/1042)) ([828da0c](https://github.com/bdougie/contributor.info/commit/828da0cbcb9f99670b80cb9cac0e1515875d3db8))
* resolve Inngest PR capture failures and schema mismatches ([#1111](https://github.com/bdougie/contributor.info/issues/1111)) ([b26b9ff](https://github.com/bdougie/contributor.info/commit/b26b9ff560019dbc238ef0e7fb0432c7522559ef)), closes [#1107](https://github.com/bdougie/contributor.info/issues/1107) [#1109](https://github.com/bdougie/contributor.info/issues/1109)
* resolve issue metrics query errors and missing Time to Resolution trend ([#671](https://github.com/bdougie/contributor.info/issues/671)) ([5d4bada](https://github.com/bdougie/contributor.info/commit/5d4badaccf139bad5d49423bf24e09ea6cd67cae)), closes [#670](https://github.com/bdougie/contributor.info/issues/670)
* resolve JSON parsing error in repository tracking ([#771](https://github.com/bdougie/contributor.info/issues/771)) ([85a6c94](https://github.com/bdougie/contributor.info/commit/85a6c9480d267cd54872e15eccdea0f7939b1e03))
* resolve manual repository sync failures ([#656](https://github.com/bdougie/contributor.info/issues/656)) ([#664](https://github.com/bdougie/contributor.info/issues/664)) ([1eaf22d](https://github.com/bdougie/contributor.info/commit/1eaf22d344abf1a50cc5a20cee17b35eedcecab4))
* resolve Nivo ScatterPlot theme errors ([#635](https://github.com/bdougie/contributor.info/issues/635)) ([e91c362](https://github.com/bdougie/contributor.info/commit/e91c36263b96f550d8cd03f5504d0ced4ddd8cf0)), closes [#630](https://github.com/bdougie/contributor.info/issues/630) [#636](https://github.com/bdougie/contributor.info/issues/636)
* resolve notes data isolation and overwrite bugs ([#983](https://github.com/bdougie/contributor.info/issues/983)) ([f0f147f](https://github.com/bdougie/contributor.info/commit/f0f147f08da02d9d19f6de5155cf468729b1d181)), closes [#1](https://github.com/bdougie/contributor.info/issues/1) [#2](https://github.com/bdougie/contributor.info/issues/2)
* resolve page view data capture and workspace sync issues ([#1113](https://github.com/bdougie/contributor.info/issues/1113)) ([d7f4d9a](https://github.com/bdougie/contributor.info/commit/d7f4d9a40357d8f29607bf35c1bd4ccb853942df))
* resolve queue-event endpoint 500/404 errors ([#734](https://github.com/bdougie/contributor.info/issues/734)) ([65d0ef6](https://github.com/bdougie/contributor.info/commit/65d0ef655387c8c6af82085f8bd736f02660bc33)), closes [#732](https://github.com/bdougie/contributor.info/issues/732) [#733](https://github.com/bdougie/contributor.info/issues/733)
* resolve React hooks dependency warnings ([#587](https://github.com/bdougie/contributor.info/issues/587)) ([134d0ae](https://github.com/bdougie/contributor.info/commit/134d0aea3bdf6d18aa5ff8dd5555dd33558ec617)), closes [#544](https://github.com/bdougie/contributor.info/issues/544)
* resolve subscription tier inconsistencies and team plan invite issues ([#716](https://github.com/bdougie/contributor.info/issues/716)) ([91df1c3](https://github.com/bdougie/contributor.info/commit/91df1c3bf6ec8d418ca039fe9d56aa25c5b4ca7b))
* resolve Supabase console errors and missing commits table ([#829](https://github.com/bdougie/contributor.info/issues/829)) ([22f0bf8](https://github.com/bdougie/contributor.info/commit/22f0bf865f799fe56d268d21b45668987771311d))
* resolve test environment variable handling in CI and local ([#1103](https://github.com/bdougie/contributor.info/issues/1103)) ([589e51e](https://github.com/bdougie/contributor.info/commit/589e51e7790bc2790a5f774adbeaaa44d88f7b18))
* resolve test failures and update health metrics documentation ([#1053](https://github.com/bdougie/contributor.info/issues/1053)) ([b8f61a4](https://github.com/bdougie/contributor.info/commit/b8f61a4062292e416329d6082e1769e4901b0f2a)), closes [#1026](https://github.com/bdougie/contributor.info/issues/1026)
* resolve TypeScript type errors in inngest-prod edge function ([#1099](https://github.com/bdougie/contributor.info/issues/1099)) ([d05dc08](https://github.com/bdougie/contributor.info/commit/d05dc08523b1e6cea787ad875827d8f665af7eef))
* resolve unused variable warnings in functions and tests ([#564](https://github.com/bdougie/contributor.info/issues/564)) ([b2bcb15](https://github.com/bdougie/contributor.info/commit/b2bcb158efe3d1ddd0523c436f9cee4fedde4de3)), closes [#537](https://github.com/bdougie/contributor.info/issues/537)
* resolve workflow JSON parsing errors and build script issues ([#621](https://github.com/bdougie/contributor.info/issues/621)) ([ace3044](https://github.com/bdougie/contributor.info/commit/ace30447e499ed5cf5fa753660ba14a340ce8d3e))
* resolve workspace-sync Edge Function authentication errors ([#1116](https://github.com/bdougie/contributor.info/issues/1116)) ([8f56c68](https://github.com/bdougie/contributor.info/commit/8f56c68b20b4733528edc78996b0ebb7cfd8c673)), closes [#1114](https://github.com/bdougie/contributor.info/issues/1114) [#1114](https://github.com/bdougie/contributor.info/issues/1114)
* restore page view-based data capture by properly initializing smart notifications ([#1107](https://github.com/bdougie/contributor.info/issues/1107)) ([8187c34](https://github.com/bdougie/contributor.info/commit/8187c3465ec71352fb02e116e2cd24fe9e89bee2)), closes [#1106](https://github.com/bdougie/contributor.info/issues/1106)
* restore stable build from known good state ([#608](https://github.com/bdougie/contributor.info/issues/608)) ([c706eef](https://github.com/bdougie/contributor.info/commit/c706eef2fb283d61a4453f0e331b670961305ee3))
* round daily PR volume to whole numbers and update labels to 'Last 30 days' ([#679](https://github.com/bdougie/contributor.info/issues/679)) ([08bee54](https://github.com/bdougie/contributor.info/commit/08bee54997b9eca6b77fb8d454bcd42c2f557709))
* **routing:** move invitation route before workspace routes to prevent conflicts ([#1017](https://github.com/bdougie/contributor.info/issues/1017)) ([02671cb](https://github.com/bdougie/contributor.info/commit/02671cb07b8979ad4dcdb6ff5922e0a1e5030a1e)), closes [#1008](https://github.com/bdougie/contributor.info/issues/1008)
* secure backup tables with RLS policies (Phase 1) ([#809](https://github.com/bdougie/contributor.info/issues/809)) ([bad1a28](https://github.com/bdougie/contributor.info/commit/bad1a28426f42bcd44895426c42ee38e9f5a1662)), closes [#783](https://github.com/bdougie/contributor.info/issues/783) [#783](https://github.com/bdougie/contributor.info/issues/783) [#783](https://github.com/bdougie/contributor.info/issues/783)
* secure critical system tables with RLS policies (Phase 3-5) ([#811](https://github.com/bdougie/contributor.info/issues/811)) ([bcf0141](https://github.com/bdougie/contributor.info/commit/bcf01418a63f3c0611a48a01792eeda9c463dc9b)), closes [#783](https://github.com/bdougie/contributor.info/issues/783) [#783](https://github.com/bdougie/contributor.info/issues/783)
* send repositoryId instead of owner/repo in capture/repository.sync event ([#797](https://github.com/bdougie/contributor.info/issues/797)) ([f94b57e](https://github.com/bdougie/contributor.info/commit/f94b57e957db52d1b5473fdf513b9d3adcffeb35))
* Service worker caching HTML for API responses ([#774](https://github.com/bdougie/contributor.info/issues/774)) ([b1c5dbe](https://github.com/bdougie/contributor.info/commit/b1c5dbeafe35c4edf4d13a80062344d1433a1ba5)), closes [#772](https://github.com/bdougie/contributor.info/issues/772)
* show only winner with toggle during active month leaderboard ([#942](https://github.com/bdougie/contributor.info/issues/942)) ([c6b0a62](https://github.com/bdougie/contributor.info/commit/c6b0a6282a032c10b9ea60dbb9b7d8751958f833)), closes [#1](https://github.com/bdougie/contributor.info/issues/1) [#1](https://github.com/bdougie/contributor.info/issues/1) [#929](https://github.com/bdougie/contributor.info/issues/929)
* show placeholder for invalid star velocity instead of total stars ([d117e5d](https://github.com/bdougie/contributor.info/commit/d117e5d10c46bb19f82f1c76025a1f10b360dc3f))
* Simplify command and remove Anthropic key ([22c53ab](https://github.com/bdougie/contributor.info/commit/22c53abc51e02e7ad8a34f5890757536eaba8911))
* social cards ([#887](https://github.com/bdougie/contributor.info/issues/887)) ([9fcae6d](https://github.com/bdougie/contributor.info/commit/9fcae6dcdbce9a659b444a552134a9892ee70b84)), closes [#856](https://github.com/bdougie/contributor.info/issues/856) [#856](https://github.com/bdougie/contributor.info/issues/856)
* **spam-detection:** resolve Edge Function import errors and database query issues ([#898](https://github.com/bdougie/contributor.info/issues/898)) ([479e6b7](https://github.com/bdougie/contributor.info/commit/479e6b7431d1e1f0c727b6a6750d132725e23a40)), closes [#859](https://github.com/bdougie/contributor.info/issues/859)
* standardize bot detection across application ([#808](https://github.com/bdougie/contributor.info/issues/808)) ([ceccef0](https://github.com/bdougie/contributor.info/commit/ceccef0d152f4c280d0342e904c0197501a7759c)), closes [#736](https://github.com/bdougie/contributor.info/issues/736)
* standardize date formatting across codebase ([#826](https://github.com/bdougie/contributor.info/issues/826)) ([0cdc654](https://github.com/bdougie/contributor.info/commit/0cdc6540e1a80a2d38c84c6de3375b440e0f9be0)), closes [#647](https://github.com/bdougie/contributor.info/issues/647)
* supabase local migration ([#704](https://github.com/bdougie/contributor.info/issues/704)) ([2b4029f](https://github.com/bdougie/contributor.info/commit/2b4029fb91641a22231b597b69f2c01651f5feb6)), closes [#705](https://github.com/bdougie/contributor.info/issues/705) [#694](https://github.com/bdougie/contributor.info/issues/694) [#703](https://github.com/bdougie/contributor.info/issues/703) [#694](https://github.com/bdougie/contributor.info/issues/694)
* sync PR count columns to resolve chart failures [#694](https://github.com/bdougie/contributor.info/issues/694) ([#703](https://github.com/bdougie/contributor.info/issues/703)) ([d84288c](https://github.com/bdougie/contributor.info/commit/d84288cfc13d1322badd34c1eb1b3d171440d46c))
* **ui:** remove duplicate workspace switcher from workspace dashboard ([#1052](https://github.com/bdougie/contributor.info/issues/1052)) ([5f6a00b](https://github.com/bdougie/contributor.info/commit/5f6a00b863342a1080645d7152abe39df442e18f))
* update candlestick chart tooltip to follow cursor position ([#586](https://github.com/bdougie/contributor.info/issues/586)) ([077f116](https://github.com/bdougie/contributor.info/commit/077f1164ea78346b4c0e079e41d463a63d9d6b68)), closes [#579](https://github.com/bdougie/contributor.info/issues/579)
* update discussions migration to use VARCHAR for GitHub node IDs ([#987](https://github.com/bdougie/contributor.info/issues/987)) ([9c8333a](https://github.com/bdougie/contributor.info/commit/9c8333af657741f991b38af5fa7d30ab9481bbbc))
* update gitignore to properly ignore debug files in root only ([#681](https://github.com/bdougie/contributor.info/issues/681)) ([5bc96e3](https://github.com/bdougie/contributor.info/commit/5bc96e3217440ba2670a5e9a89ec1a0f6d85255d))
* update repository polling URL to use correct Netlify functions path ([#773](https://github.com/bdougie/contributor.info/issues/773)) ([39cf83b](https://github.com/bdougie/contributor.info/commit/39cf83bbd40d2432265ace5367e92aebf1a95262)), closes [#772](https://github.com/bdougie/contributor.info/issues/772)
* upgrade @actions/core from 1.10.1 to 1.11.1 ([#960](https://github.com/bdougie/contributor.info/issues/960)) ([ab194d3](https://github.com/bdougie/contributor.info/commit/ab194d30c8dd072090e82f6f65070837a1773f66))
* upgrade @actions/github from 6.0.0 to 6.0.1 ([#961](https://github.com/bdougie/contributor.info/issues/961)) ([b87ee5c](https://github.com/bdougie/contributor.info/commit/b87ee5cd24ed866e464dae1123e410879b02d215))
* upgrade @netlify/functions from 4.1.10 to 4.2.5 ([#1093](https://github.com/bdougie/contributor.info/issues/1093)) ([3972aa5](https://github.com/bdougie/contributor.info/commit/3972aa51f7e13b376d030bcb400f4b5ce9375639))
* upgrade @radix-ui/react-toast from 1.2.14 to 1.2.15 ([#1092](https://github.com/bdougie/contributor.info/issues/1092)) ([4a91658](https://github.com/bdougie/contributor.info/commit/4a91658680feaa5b2efdf598a0c5671b516b369e))
* upgrade @supabase/supabase-js from 2.54.0 to 2.57.4 ([#933](https://github.com/bdougie/contributor.info/issues/933)) ([29a9e1a](https://github.com/bdougie/contributor.info/commit/29a9e1aa158b031b5ef05f43472edb411bf4f8fd))
* upgrade dub from 0.63.7 to 0.66.4 ([#937](https://github.com/bdougie/contributor.info/issues/937)) ([181e25c](https://github.com/bdougie/contributor.info/commit/181e25c8010d8dc9d68144f0329121cffca02890))
* upgrade openai from 5.11.0 to 5.22.0 ([#1090](https://github.com/bdougie/contributor.info/issues/1090)) ([da1f33c](https://github.com/bdougie/contributor.info/commit/da1f33c47cfaa8bbefa3ab11d47f27a0e2810010))
* upgrade posthog-js from 1.260.2 to 1.265.0 ([#935](https://github.com/bdougie/contributor.info/issues/935)) ([8abb39a](https://github.com/bdougie/contributor.info/commit/8abb39a3b7998b852f37efc4ccd6a9888e2bf9ec))
* use author_id instead of reviewer_id for PR review authors ([#941](https://github.com/bdougie/contributor.info/issues/941)) ([888155b](https://github.com/bdougie/contributor.info/commit/888155bd64c49f82415f7843b3dc47c43f7aa9db))
* use correct 'issues' table in similarity search ([#1078](https://github.com/bdougie/contributor.info/issues/1078)) ([7046908](https://github.com/bdougie/contributor.info/commit/704690814c22a5383958cb36e7613a73bde24d71))
* Use real Inngest implementations to fix stuck jobs ([#892](https://github.com/bdougie/contributor.info/issues/892)) ([3078c23](https://github.com/bdougie/contributor.info/commit/3078c235d727c7e28aa626241625b41fbf4466bc)), closes [#886](https://github.com/bdougie/contributor.info/issues/886) [#886](https://github.com/bdougie/contributor.info/issues/886)
* Use service role key in Inngest functions to bypass RLS ([#873](https://github.com/bdougie/contributor.info/issues/873)) ([6fc03c3](https://github.com/bdougie/contributor.info/commit/6fc03c37ff2f77666b59507e02c2564835f7e487)), closes [#8039-8049](https://github.com/bdougie/contributor.info/issues/8039-8049) [#7984](https://github.com/bdougie/contributor.info/issues/7984)
* workspace issues display and smart notifications ([#529](https://github.com/bdougie/contributor.info/issues/529)) ([0b4302d](https://github.com/bdougie/contributor.info/commit/0b4302dcbd45536d47db58ead93847c3866fd45d))
* Workspace member removal and visibility issues ([#726](https://github.com/bdougie/contributor.info/issues/726)) ([0503372](https://github.com/bdougie/contributor.info/commit/05033727d670a485c940058d9cc2a9b9224c8a1f))
* workspace members tab UI and add team subscription tier ([#714](https://github.com/bdougie/contributor.info/issues/714)) ([f9549b2](https://github.com/bdougie/contributor.info/commit/f9549b26935f63ba9e322262a7e1d1e636d9d4fa))
* Workspace owners can now add and remove repositories ([#539](https://github.com/bdougie/contributor.info/issues/539)) ([a52d011](https://github.com/bdougie/contributor.info/commit/a52d0116a0ae380e9a4f2f4dc6e2d55f57ecec9e))
* workspace preview cards with square repo avatars and cached URLs ([#998](https://github.com/bdougie/contributor.info/issues/998)) ([0f83a48](https://github.com/bdougie/contributor.info/commit/0f83a48c2698532f650e9c3ec8667828dce53e03)), closes [#994](https://github.com/bdougie/contributor.info/issues/994)
* workspace-only embeddings backfill for PRs and issues ([#1045](https://github.com/bdougie/contributor.info/issues/1045)) ([fd6f521](https://github.com/bdougie/contributor.info/commit/fd6f521a79cc54b521a2e97eeb75112b9d0f82c8))
* **workspace:** correct trend icon direction and color logic ([#687](https://github.com/bdougie/contributor.info/issues/687)) ([54c97fd](https://github.com/bdougie/contributor.info/commit/54c97fdac88a7dd00a53bdd61006727c0f7dd6af))
* **workspace:** implement server-side pagination and debounced search for contributor search ([#1071](https://github.com/bdougie/contributor.info/issues/1071)) ([ef236bb](https://github.com/bdougie/contributor.info/commit/ef236bb3c81d64cfe93bad4eff576dbaaeefd1bb)), closes [#1065](https://github.com/bdougie/contributor.info/issues/1065)
* **workspace:** improve workspace creation modal UX ([#951](https://github.com/bdougie/contributor.info/issues/951)) ([34a684d](https://github.com/bdougie/contributor.info/commit/34a684dc48488964834ddd3f10d741c9fe750f3e)), closes [#938](https://github.com/bdougie/contributor.info/issues/938)
* **workspace:** resolve workspace repository API errors ([#644](https://github.com/bdougie/contributor.info/issues/644)) ([9c97176](https://github.com/bdougie/contributor.info/commit/9c971767b6af63c0180d71d7d5e0a9c0d037eec5)), closes [#643](https://github.com/bdougie/contributor.info/issues/643)


### ⚡ Performance Improvements

* **embeddings:** reduce cron frequency to 4 times per day ([#1062](https://github.com/bdougie/contributor.info/issues/1062)) ([382e91f](https://github.com/bdougie/contributor.info/commit/382e91fcd3b30de6edb280b8e8f2a4db800209f6))
* optimize workspace loading - eliminate N+1 query problem ([#984](https://github.com/bdougie/contributor.info/issues/984)) ([c504519](https://github.com/bdougie/contributor.info/commit/c50451976e6afb560655009616d8c8201b73d59e)), closes [#974](https://github.com/bdougie/contributor.info/issues/974)


### ⏪ Reverts

* MiniLM embeddings migration due to deployment failure ([#1036](https://github.com/bdougie/contributor.info/issues/1036)) ([bbdaac5](https://github.com/bdougie/contributor.info/commit/bbdaac51b97c2da818a93842fdce2869e20d4a1e)), closes [#1034](https://github.com/bdougie/contributor.info/issues/1034)


### ♻️ Code Refactoring

* centralize operational workflows documentation ([1a14c90](https://github.com/bdougie/contributor.info/commit/1a14c903d4e724ed33e73f277a3431f4086b1c2f))
* Complete Remaining Edge Functions Refactoring ([#1049](https://github.com/bdougie/contributor.info/issues/1049)) ([67a5156](https://github.com/bdougie/contributor.info/commit/67a51566fbdace839d2748bc532c95ddf9bef728)), closes [#1029](https://github.com/bdougie/contributor.info/issues/1029)
* extract shared utilities to reduce edge function duplication ([#1028](https://github.com/bdougie/contributor.info/issues/1028)) ([d859428](https://github.com/bdougie/contributor.info/commit/d8594285b8d7de0f8ae9120fe4b49a4c6a894f7d)), closes [#1021](https://github.com/bdougie/contributor.info/issues/1021)
* extract workspace dashboard utilities and components ([#1083](https://github.com/bdougie/contributor.info/issues/1083)) ([31e6880](https://github.com/bdougie/contributor.info/commit/31e6880f7c56f17fd1ddeec85dad61093e26c2a4))
* Extract workspace page components for better maintainability ([#1094](https://github.com/bdougie/contributor.info/issues/1094)) ([08e80d7](https://github.com/bdougie/contributor.info/commit/08e80d7a7009a5c027069c416aee46cdef448d87)), closes [#1074](https://github.com/bdougie/contributor.info/issues/1074)
* extract workspace tab components for improved maintainability ([#1076](https://github.com/bdougie/contributor.info/issues/1076)) ([116e573](https://github.com/bdougie/contributor.info/commit/116e573c9736b56cd91092fa5de71a914f799b63)), closes [#1075](https://github.com/bdougie/contributor.info/issues/1075)
* Phase 1 - replace 9 nested ternary expressions with utility functions ([#592](https://github.com/bdougie/contributor.info/issues/592)) ([a2c54b3](https://github.com/bdougie/contributor.info/commit/a2c54b3136fcfb7bfda155851f1dd86c4f8df6a6))
* Phase 2 - replace 10 nested ternary expressions with utility functions ([#594](https://github.com/bdougie/contributor.info/issues/594)) ([d7f09ff](https://github.com/bdougie/contributor.info/commit/d7f09fff2aaeae1275f4e12632299655caaeb969)), closes [#542](https://github.com/bdougie/contributor.info/issues/542)
* Phase 3 - replace 12 nested ternary expressions with utility functions ([#595](https://github.com/bdougie/contributor.info/issues/595)) ([28b5c48](https://github.com/bdougie/contributor.info/commit/28b5c48c36f373e88d5841606e152706ca5de5c8)), closes [#542](https://github.com/bdougie/contributor.info/issues/542)
* replace 28 nested ternary expressions with utility functions ([#574](https://github.com/bdougie/contributor.info/issues/574)) ([6993452](https://github.com/bdougie/contributor.info/commit/69934526e7b1b55c48f93a244807946a07fac7e6)), closes [#541](https://github.com/bdougie/contributor.info/issues/541) [#577](https://github.com/bdougie/contributor.info/issues/577) [#541](https://github.com/bdougie/contributor.info/issues/541) [#541](https://github.com/bdougie/contributor.info/issues/541)


### 📚 Documentation

* add comprehensive documentation for workspace events feature ([#662](https://github.com/bdougie/contributor.info/issues/662)) ([df3589e](https://github.com/bdougie/contributor.info/commit/df3589e4d1dde153914c8b5315b07dd75a74b408))
* add documentation link, changelog sidebar, and redirect ([#977](https://github.com/bdougie/contributor.info/issues/977)) ([e373659](https://github.com/bdougie/contributor.info/commit/e373659e1b01331f3551faea611906efc87ed49a))
* add PostHog cohorts implementation guide ([#709](https://github.com/bdougie/contributor.info/issues/709)) ([d25f5e0](https://github.com/bdougie/contributor.info/commit/d25f5e07ddb03cc88f866c777ea24a045e58de32))
* Add RLS policy testing documentation ([#861](https://github.com/bdougie/contributor.info/issues/861)) ([194a37d](https://github.com/bdougie/contributor.info/commit/194a37da2a92b4f19b89223b8259b0c782b2f72f))
* clean up CLAUDE.md documentation ([#626](https://github.com/bdougie/contributor.info/issues/626)) ([92593c2](https://github.com/bdougie/contributor.info/commit/92593c254508ce1b6415480bea82a0a76e33e403)), closes [#611](https://github.com/bdougie/contributor.info/issues/611)
* Comprehensive documentation cleanup and organization ([#769](https://github.com/bdougie/contributor.info/issues/769)) ([a6b95d4](https://github.com/bdougie/contributor.info/commit/a6b95d4c3b5d07c756f4b8a01155e0878359bdfd))
* Document Netlify Functions directory structure fix ([#1080](https://github.com/bdougie/contributor.info/issues/1080)) ([bbb475c](https://github.com/bdougie/contributor.info/commit/bbb475c8b7154df62428925f110f7deaeb14bfdd)), closes [#1059](https://github.com/bdougie/contributor.info/issues/1059) [#1070](https://github.com/bdougie/contributor.info/issues/1070) [#411](https://github.com/bdougie/contributor.info/issues/411) [#487](https://github.com/bdougie/contributor.info/issues/487) [#882](https://github.com/bdougie/contributor.info/issues/882) [#1079](https://github.com/bdougie/contributor.info/issues/1079)
* Documentation Foundation for Edge Functions ([#1023](https://github.com/bdougie/contributor.info/issues/1023)) ([83275e4](https://github.com/bdougie/contributor.info/commit/83275e4e61f72aa3ecc64b70a818d9f6ab13b6d7)), closes [#919](https://github.com/bdougie/contributor.info/issues/919) [#919](https://github.com/bdougie/contributor.info/issues/919)
* modernize CONTRIBUTING.md with current practices ([#870](https://github.com/bdougie/contributor.info/issues/870)) ([f61d193](https://github.com/bdougie/contributor.info/commit/f61d1937aa3c4424b4f8de7b890a365edd189220))
* remove completed security definer audit PRD ([#813](https://github.com/bdougie/contributor.info/issues/813)) ([1fbd995](https://github.com/bdougie/contributor.info/commit/1fbd9950640758cba6ea87280f56f7110ea6ea50)), closes [#810](https://github.com/bdougie/contributor.info/issues/810)


### 🔧 Maintenance

* apply lint formatting fixes from PR [#800](https://github.com/bdougie/contributor.info/issues/800) ([#802](https://github.com/bdougie/contributor.info/issues/802)) ([e4dcaf1](https://github.com/bdougie/contributor.info/commit/e4dcaf10d8883234a648f1334165f76ac8daba60))
* clean up obsolete scripts and reorganize test files ([#717](https://github.com/bdougie/contributor.info/issues/717)) ([96e23a8](https://github.com/bdougie/contributor.info/commit/96e23a83991182526f8723e823f896a9a3a63403))
* delete local db migration archive ([#885](https://github.com/bdougie/contributor.info/issues/885)) ([b0e1246](https://github.com/bdougie/contributor.info/commit/b0e1246ab1a972513e6b792118b96f7624ea2e65))
* **dev:** skip auto-seed during supabase:start; add helper script ([#576](https://github.com/bdougie/contributor.info/issues/576)) ([a8a7e26](https://github.com/bdougie/contributor.info/commit/a8a7e26617b7c33c83cb6af8d0a03907b04c6a4e))
* migrate console.log statements to production-safe logger ([#1086](https://github.com/bdougie/contributor.info/issues/1086)) ([1f54338](https://github.com/bdougie/contributor.info/commit/1f54338ac71376ef628f074c8baf54c9f38f97d1))
* remove cache update console logs for cleaner output ([#1100](https://github.com/bdougie/contributor.info/issues/1100)) ([97db195](https://github.com/bdougie/contributor.info/commit/97db195e8c19d7e67cc7b00ed0bccb595ecb8583))
* remove console logs from data fetching and service worker ([#1066](https://github.com/bdougie/contributor.info/issues/1066)) ([ea5a07f](https://github.com/bdougie/contributor.info/commit/ea5a07f1d5c55e9fd742da3187efb0aef2b00f25))
* remove Polar.sh upgrade CTA ([#1064](https://github.com/bdougie/contributor.info/issues/1064)) ([11b6f95](https://github.com/bdougie/contributor.info/commit/11b6f95a74489e3c3757def21de6a82392b6f627))
* update tracked repositories list [skip ci] ([fcfd700](https://github.com/bdougie/contributor.info/commit/fcfd700f58860a2ea771f64b02caa7cf3beca531))

## [2.1.0](https://github.com/bdougie/contributor.info/compare/v2.0.0...v2.1.0) (2025-08-25)


### 🚀 Features

* Add Continue Agent for code reviews ([#459](https://github.com/bdougie/contributor.info/issues/459)) ([ef6dc05](https://github.com/bdougie/contributor.info/commit/ef6dc05f59a1e9149e5de2c967019b2891b4d0fd)), closes [#458](https://github.com/bdougie/contributor.info/issues/458) [continuedev/continue#7228](https://github.com/continuedev/continue/issues/7228)
* Add Continue AI review action with local rules support and sticky comments ([#517](https://github.com/bdougie/contributor.info/issues/517)) ([e016192](https://github.com/bdougie/contributor.info/commit/e0161928104be5ba24a9426404b719f18763346e)), closes [#511](https://github.com/bdougie/contributor.info/issues/511)
* Add Supabase avatar caching for PR Contributions chart performance ([#461](https://github.com/bdougie/contributor.info/issues/461)) ([e65cec4](https://github.com/bdougie/contributor.info/commit/e65cec44eac9afff8bfa06a92ccc30fb1083b312))
* Add workspace creation and edit UI stories ([#509](https://github.com/bdougie/contributor.info/issues/509)) ([bbf2729](https://github.com/bdougie/contributor.info/commit/bbf2729e3e0ccc1843eda203bdbbccbc5b7ce1f1))
* add workspace preview card to homepage ([#506](https://github.com/bdougie/contributor.info/issues/506)) ([8c470d3](https://github.com/bdougie/contributor.info/commit/8c470d34fa36a9c8154feebdff61f0e7ae74f3bb)), closes [/github.com/bdougie/contributor.info/pull/506#issuecomment-3217500518](https://github.com/bdougie//github.com/bdougie/contributor.info/pull/506/issues/issuecomment-3217500518)
* comprehensive social elements testing and optimization ([#439](https://github.com/bdougie/contributor.info/issues/439)) ([aa4654d](https://github.com/bdougie/contributor.info/commit/aa4654d65671d2a52f8472cc29d6280d6a179d32))
* Enhance E2E testing infrastructure ([#500](https://github.com/bdougie/contributor.info/issues/500)) ([7ceaa04](https://github.com/bdougie/contributor.info/commit/7ceaa044cde39eeb4820ed602f2314c10768b878)), closes [#497](https://github.com/bdougie/contributor.info/issues/497) [#502](https://github.com/bdougie/contributor.info/issues/502)
* implement trending repositories page and discovery features ([#516](https://github.com/bdougie/contributor.info/issues/516)) ([7e6e7c9](https://github.com/bdougie/contributor.info/commit/7e6e7c99cdeb915fd2831410bcc8df3993cacf2d))
* implement workspace issues capture (Phase 2) ([#519](https://github.com/bdougie/contributor.info/issues/519)) ([cf9e0ff](https://github.com/bdougie/contributor.info/commit/cf9e0ff0840a5d8e52781f05c0e7e5fc10649cf0)), closes [#457](https://github.com/bdougie/contributor.info/issues/457) [#508](https://github.com/bdougie/contributor.info/issues/508)
* Manual backfill integration with gh-datapipe API ([#456](https://github.com/bdougie/contributor.info/issues/456)) ([a2ca9f3](https://github.com/bdougie/contributor.info/commit/a2ca9f3eeec006eec13db84aad38d9e4e9c75e48))
* Migrate long-running functions to Supabase Edge Functions ([#467](https://github.com/bdougie/contributor.info/issues/467)) ([3d41905](https://github.com/bdougie/contributor.info/commit/3d41905e6acf4815d85a181e76a1c421028d50db)), closes [#457](https://github.com/bdougie/contributor.info/issues/457)
* Phase 3 - Aggressive caching & service worker enhancements ([#477](https://github.com/bdougie/contributor.info/issues/477)) ([ca3cb13](https://github.com/bdougie/contributor.info/commit/ca3cb135a4cb7f32c2aedf950555be3c85373dd5)), closes [#466](https://github.com/bdougie/contributor.info/issues/466)
* Phase 3 - Testing & Quality Infrastructure for Design System ([#496](https://github.com/bdougie/contributor.info/issues/496)) ([8eb3056](https://github.com/bdougie/contributor.info/commit/8eb30565e750e4d134faa5536ac7437ed2a9aad8)), closes [#493](https://github.com/bdougie/contributor.info/issues/493) [#493](https://github.com/bdougie/contributor.info/issues/493)
* Replace PageSpeed Insights with lazy-loaded PostHog for Web Vitals ([#490](https://github.com/bdougie/contributor.info/issues/490)) ([e8dd602](https://github.com/bdougie/contributor.info/commit/e8dd60260329d14900420287226e3190a0088056)), closes [#311](https://github.com/bdougie/contributor.info/issues/311)
* Smart Throttling System for Improved First-Visit Experience ([#452](https://github.com/bdougie/contributor.info/issues/452)) ([0121de7](https://github.com/bdougie/contributor.info/commit/0121de7d27395fc7630d60d9ab006d1ef5e00813))
* Workspace Dashboard UI Components (Storybook Implementation) ([#504](https://github.com/bdougie/contributor.info/issues/504)) ([739b8a0](https://github.com/bdougie/contributor.info/commit/739b8a038278f1ed1e6d14019be54453e5cae926)), closes [#394](https://github.com/bdougie/contributor.info/issues/394) [Title...#123](https://github.com/bdougie/Title.../issues/123)
* workspace data fetching infrastructure (Phase 1) ([#518](https://github.com/bdougie/contributor.info/issues/518)) ([15a8c0b](https://github.com/bdougie/contributor.info/commit/15a8c0bc33703f8b80659cf13eaf1def1b4ce9b8)), closes [#508](https://github.com/bdougie/contributor.info/issues/508)
* Workspace UI and repository management with tier limits ([#510](https://github.com/bdougie/contributor.info/issues/510)) ([8112d54](https://github.com/bdougie/contributor.info/commit/8112d54643cf0f0614f45332eaeaab0f75149a64)), closes [#509](https://github.com/bdougie/contributor.info/issues/509)


### 🐛 Bug Fixes

* Add triage workflow for issue assignment ([31f2413](https://github.com/bdougie/contributor.info/commit/31f2413f07acbaff92b82d7ec1f34f801876c4a2))
* add validation for undefined repositoryId in Inngest functions ([#430](https://github.com/bdougie/contributor.info/issues/430)) ([ba36f39](https://github.com/bdougie/contributor.info/commit/ba36f39b0489a86f6fed07cc8faba964419f8148))
* comment continue-review.yml ([b09466b](https://github.com/bdougie/contributor.info/commit/b09466b14fd0672b8a44adb08935009fc6b07821))
* Enable reviewer suggestions in webhook comments ([#441](https://github.com/bdougie/contributor.info/issues/441)) ([af24f9f](https://github.com/bdougie/contributor.info/commit/af24f9fb5c09499e81427d7b89fb200fc818132d)), closes [#221](https://github.com/bdougie/contributor.info/issues/221)
* exclude Netlify functions from TypeScript build compilation ([a83320a](https://github.com/bdougie/contributor.info/commit/a83320a9b021101f9dc5aa699ddafdde543f4182))
* implement user profile support with circular avatars ([#514](https://github.com/bdougie/contributor.info/issues/514)) ([2c754e3](https://github.com/bdougie/contributor.info/commit/2c754e380c97a494848f1a91a4da490c8d65f756))
* make request boxes mobile-friendly ([#433](https://github.com/bdougie/contributor.info/issues/433)) ([#435](https://github.com/bdougie/contributor.info/issues/435)) ([88752a1](https://github.com/bdougie/contributor.info/commit/88752a1695a03c91478871aa5fd9c0c1a14243b8))
* mobile responsiveness issues for distribution charts ([#434](https://github.com/bdougie/contributor.info/issues/434)) ([08ff6e6](https://github.com/bdougie/contributor.info/commit/08ff6e6deef4f7f9a391d1c03e2c7743f4d50f0d)), closes [#431](https://github.com/bdougie/contributor.info/issues/431) [#431](https://github.com/bdougie/contributor.info/issues/431)
* **mobile:** improve workspace table mobile responsiveness ([#515](https://github.com/bdougie/contributor.info/issues/515)) ([4dc1c1d](https://github.com/bdougie/contributor.info/commit/4dc1c1de0495fc3f337a76dcb3edb9787e571ba4))
* Production CSP violations and environment errors ([#491](https://github.com/bdougie/contributor.info/issues/491)) ([56ef2ab](https://github.com/bdougie/contributor.info/commit/56ef2ab9b3674e278cb0a7fc32c354f595b63a29)), closes [#475](https://github.com/bdougie/contributor.info/issues/475)
* reduce repository sync cooldown to 1 hour for timely data updates ([#432](https://github.com/bdougie/contributor.info/issues/432)) ([457afe8](https://github.com/bdougie/contributor.info/commit/457afe854968e610c93e9dbf3d861b56f419798b))
* Replace GitHub identicons with Avatar API to resolve CORS errors ([#480](https://github.com/bdougie/contributor.info/issues/480)) ([94c9242](https://github.com/bdougie/contributor.info/commit/94c92429eaf2a9f6c0cf90fa21f89f8ac9fefc49)), closes [#470](https://github.com/bdougie/contributor.info/issues/470)
* resolve top 404 errors with webhook redirects and route fixes ([#460](https://github.com/bdougie/contributor.info/issues/460)) ([07e3c6f](https://github.com/bdougie/contributor.info/commit/07e3c6fdbeacd23fd8147bf072304a2a6a578bf9)), closes [#454](https://github.com/bdougie/contributor.info/issues/454)
* uncomment continue-review.yml ([c20936f](https://github.com/bdougie/contributor.info/commit/c20936fed2a76cd5bfd58b0d947a2957e988026b))
* update package-lock.json dependency versions ([#438](https://github.com/bdougie/contributor.info/issues/438)) ([cc657f7](https://github.com/bdougie/contributor.info/commit/cc657f7f7760b6bf7b60eefd19be066db8ccbaf3))


### ♻️ Code Refactoring

* extract repository sync cooldown into shared constant ([6fa9c29](https://github.com/bdougie/contributor.info/commit/6fa9c29e2522d8266d2d4eea198128dfd97385e4))


### 📚 Documentation

* add safe FCP/LCP optimization strategies ([f50a2e0](https://github.com/bdougie/contributor.info/commit/f50a2e02a9f5592f4366d70b47a24129d6725736))
* reorganize documentation and scripts into structured folders ([#440](https://github.com/bdougie/contributor.info/issues/440)) ([4e539aa](https://github.com/bdougie/contributor.info/commit/4e539aa19b9d1f1d17a7c5225e88119651035c59))


### 🔧 Maintenance

* update tracked repositories list ([#450](https://github.com/bdougie/contributor.info/issues/450)) ([62f2c17](https://github.com/bdougie/contributor.info/commit/62f2c17cbf2b1a726fb0b0b15b36e3e46b81015f))
* update tracked repositories list ([#507](https://github.com/bdougie/contributor.info/issues/507)) ([8957383](https://github.com/bdougie/contributor.info/commit/895738365176e8ab83a8186ec4ce9b031b963d4d))
* update tracked repositories list [skip ci] ([c7a27e8](https://github.com/bdougie/contributor.info/commit/c7a27e8b9553caa77e4a6e08426514f7df2df812))

## [2.0.0](https://github.com/bdougie/contributor.info/compare/v1.11.0...v2.0.0) (2025-08-12)


### ⚠ BREAKING CHANGES

* critical production deployment and security issues (#259)

### 🚀 Features

* Add comprehensive analytics dashboard to /admin and consolidate admin features ([#412](https://github.com/bdougie/contributor.info/issues/412)) ([8958bed](https://github.com/bdougie/contributor.info/commit/8958bed3fb723d1f3e68e3e1d5beeeb1c426eef9)), closes [#409](https://github.com/bdougie/contributor.info/issues/409)
* add comprehensive bundle analysis tools and reports ([#365](https://github.com/bdougie/contributor.info/issues/365)) ([9ad8556](https://github.com/bdougie/contributor.info/commit/9ad8556f040e6e80624bd6539ef46b3fe8589a4c))
* Add comprehensive integration tests for progressive data loading ([#335](https://github.com/bdougie/contributor.info/issues/335)) ([cd51631](https://github.com/bdougie/contributor.info/commit/cd5163125c503366c63b3e74f0477afbe34a116b))
* Add comprehensive test coverage for progressive data loading hooks ([#318](https://github.com/bdougie/contributor.info/issues/318)) ([fad75cb](https://github.com/bdougie/contributor.info/commit/fad75cb14bb73ae631014664b55a9417979bdbcf)), closes [#285](https://github.com/bdougie/contributor.info/issues/285)
* Add dynamic XML sitemap generation with priority scores ([#313](https://github.com/bdougie/contributor.info/issues/313)) ([dadeb37](https://github.com/bdougie/contributor.info/commit/dadeb37e4670a1ffd0e8daf41ff989303fd8185f)), closes [#277](https://github.com/bdougie/contributor.info/issues/277)
* add FAQ sections to project pages ([#331](https://github.com/bdougie/contributor.info/issues/331)) ([181ae84](https://github.com/bdougie/contributor.info/commit/181ae842240de305731e526a28d7a4bc0d2212e6)), closes [#270](https://github.com/bdougie/contributor.info/issues/270) [#5747](https://github.com/bdougie/contributor.info/issues/5747) [#5747](https://github.com/bdougie/contributor.info/issues/5747) [#5747](https://github.com/bdougie/contributor.info/issues/5747)
* Add GitHub Actions similarity service  ([#344](https://github.com/bdougie/contributor.info/issues/344)) ([1949583](https://github.com/bdougie/contributor.info/commit/1949583e0098f9c5c0437fc3501d6420cb702622)), closes [#342](https://github.com/bdougie/contributor.info/issues/342)
* add more liberal webhook handling for issues and PRs ([3bc787e](https://github.com/bdougie/contributor.info/commit/3bc787e211bbb2f4ad359b4da6764c462a0d3ce7))
* Add organization page with top repositories ([#307](https://github.com/bdougie/contributor.info/issues/307)) ([dde8696](https://github.com/bdougie/contributor.info/commit/dde8696d357d031e577a6ed496cf86672fa786c6))
* Add similarity comments to PR opened events ([#308](https://github.com/bdougie/contributor.info/issues/308)) ([8002426](https://github.com/bdougie/contributor.info/commit/8002426743230bb08731134d80b7b467c3a12a33)), closes [#262](https://github.com/bdougie/contributor.info/issues/262)
* add uPlot base wrapper component (Chart Migration Step 1) ([#378](https://github.com/bdougie/contributor.info/issues/378)) ([904c8a5](https://github.com/bdougie/contributor.info/commit/904c8a564bae5003f94a63bdce77841ba685e8a1)), closes [#359](https://github.com/bdougie/contributor.info/issues/359) [#370](https://github.com/bdougie/contributor.info/issues/370)
* automated tracked repository updates, database docs, and chart improvements ([#380](https://github.com/bdougie/contributor.info/issues/380)) ([8b3f0eb](https://github.com/bdougie/contributor.info/commit/8b3f0ebbcaa12dc89053f12917c946e93cdc9a15)), closes [#371](https://github.com/bdougie/contributor.info/issues/371)
* complete Phase 5 test suite validation and cleanup ([#298](https://github.com/bdougie/contributor.info/issues/298)) ([#348](https://github.com/bdougie/contributor.info/issues/348)) ([af6f168](https://github.com/bdougie/contributor.info/commit/af6f168d59a9c56eff3381ec5c3015830ccc641d))
* configure AI crawler access with robots.txt and llms.txt ([#280](https://github.com/bdougie/contributor.info/issues/280)) ([fca7763](https://github.com/bdougie/contributor.info/commit/fca776317917c40f5f63265cd07b05b740d3342f)), closes [#268](https://github.com/bdougie/contributor.info/issues/268)
* Core Web Vitals monitoring and validation (Phase 3) ([#310](https://github.com/bdougie/contributor.info/issues/310)) ([806bf7d](https://github.com/bdougie/contributor.info/commit/806bf7d971cccaaf42c4014ae9eb5141aa009040)), closes [#283](https://github.com/bdougie/contributor.info/issues/283) [#266](https://github.com/bdougie/contributor.info/issues/266) [#283](https://github.com/bdougie/contributor.info/issues/283) [#283](https://github.com/bdougie/contributor.info/issues/283)
* create bulletproof tests without mocks for UI components ([#345](https://github.com/bdougie/contributor.info/issues/345)) ([ee0d2ef](https://github.com/bdougie/contributor.info/commit/ee0d2efbab026eaef363b34da8ce813f2854ebae))
* enhance treemap with language-based PR visualization and interactive navigation ([#384](https://github.com/bdougie/contributor.info/issues/384)) ([973dc2b](https://github.com/bdougie/contributor.info/commit/973dc2b44d5caeaf6109e3d5e0977786dbc291e8)), closes [#372](https://github.com/bdougie/contributor.info/issues/372)
* implement Chart Migration Step 2 - Core Chart Components ([#379](https://github.com/bdougie/contributor.info/issues/379)) ([1c6c211](https://github.com/bdougie/contributor.info/commit/1c6c2117bd3a104554fc0e5787739ea714237164)), closes [#371](https://github.com/bdougie/contributor.info/issues/371)
* implement comprehensive error boundaries for data loading failures ([#320](https://github.com/bdougie/contributor.info/issues/320)) ([d3a95bb](https://github.com/bdougie/contributor.info/commit/d3a95bbe42b8b23bc06372911b8fd8aaeca6250d)), closes [#318](https://github.com/bdougie/contributor.info/issues/318) [#286](https://github.com/bdougie/contributor.info/issues/286)
* implement content freshness signals for improved LLM citations ([#389](https://github.com/bdougie/contributor.info/issues/389)) ([65e6276](https://github.com/bdougie/contributor.info/commit/65e62763cfb1fffe73279b3ca35baa64243366ab)), closes [#273](https://github.com/bdougie/contributor.info/issues/273) [#273](https://github.com/bdougie/contributor.info/issues/273)
* implement Core Web Vitals optimizations ([#284](https://github.com/bdougie/contributor.info/issues/284)) ([9c6e5e2](https://github.com/bdougie/contributor.info/commit/9c6e5e20836f070902f6d7becc069670b373d649))
* Implement Core Web Vitals performance optimizations ([#309](https://github.com/bdougie/contributor.info/issues/309)) ([27b93bc](https://github.com/bdougie/contributor.info/commit/27b93bcee2806497560192283515d778dcccd931)), closes [#266](https://github.com/bdougie/contributor.info/issues/266) [#235](https://github.com/bdougie/contributor.info/issues/235)
* implement data loading optimizations phase 2 ([#282](https://github.com/bdougie/contributor.info/issues/282)) ([#290](https://github.com/bdougie/contributor.info/issues/290)) ([becb7ec](https://github.com/bdougie/contributor.info/commit/becb7ec6ae50caace35982b416a4cef293091e5e))
* implement embeddable widgets and citation system ([#324](https://github.com/bdougie/contributor.info/issues/324)) ([671af82](https://github.com/bdougie/contributor.info/commit/671af8246f8a0bda06c91822e12dbe0f6dfd1035)), closes [#322](https://github.com/bdougie/contributor.info/issues/322) [#322](https://github.com/bdougie/contributor.info/issues/322)
* implement mobile breadcrumb navigation with sticky positioning ([#322](https://github.com/bdougie/contributor.info/issues/322)) ([009b0b8](https://github.com/bdougie/contributor.info/commit/009b0b852679f433951a8f9d5c00ded259a53b94)), closes [#319](https://github.com/bdougie/contributor.info/issues/319)
* implement offline mode support ([#366](https://github.com/bdougie/contributor.info/issues/366)) ([913b1ff](https://github.com/bdougie/contributor.info/commit/913b1ffe09003555bed3b614a9bec8e214d9703e)), closes [#300](https://github.com/bdougie/contributor.info/issues/300) [#356](https://github.com/bdougie/contributor.info/issues/356)
* implement Phase 4 integration tests for complex features ([#346](https://github.com/bdougie/contributor.info/issues/346)) ([10c3b1c](https://github.com/bdougie/contributor.info/commit/10c3b1c2a742a52934b9317ac5d0e06ac77a33a2)), closes [#297](https://github.com/bdougie/contributor.info/issues/297)
* implement request deduplication for concurrent data fetches ([#325](https://github.com/bdougie/contributor.info/issues/325)) ([f34aea9](https://github.com/bdougie/contributor.info/commit/f34aea99b786ce1dc288880a143616cccbd4decc)), closes [#287](https://github.com/bdougie/contributor.info/issues/287)
* implement retry logic with exponential backoff for failed requests ([#334](https://github.com/bdougie/contributor.info/issues/334)) ([8420740](https://github.com/bdougie/contributor.info/commit/84207407ef5b8adf604cc8a88898dd9f63813697)), closes [#288](https://github.com/bdougie/contributor.info/issues/288)
* implement semantic HTML structure for better LLM comprehension ([#315](https://github.com/bdougie/contributor.info/issues/315)) ([9a066be](https://github.com/bdougie/contributor.info/commit/9a066be0884a0d0e0390f8cf0422b48301955e03)), closes [#269](https://github.com/bdougie/contributor.info/issues/269)
* implement WebP image optimization with fallbacks ([#323](https://github.com/bdougie/contributor.info/issues/323)) ([4395740](https://github.com/bdougie/contributor.info/commit/439574051f37dae3504d4ce76c52ee0bc0cb3968))
* improve light mode contrast and make insights sidebar black ([#410](https://github.com/bdougie/contributor.info/issues/410)) ([5e184c6](https://github.com/bdougie/contributor.info/commit/5e184c677caa2ad2f32f80a2da7adc14e6ac4010)), closes [#F8F9](https://github.com/bdougie/contributor.info/issues/F8F9) [#F8F9](https://github.com/bdougie/contributor.info/issues/F8F9) [#F1F3F5](https://github.com/bdougie/contributor.info/issues/F1F3F5)
* LLM citation tracking system & web vitals fix ([#332](https://github.com/bdougie/contributor.info/issues/332)) ([31617da](https://github.com/bdougie/contributor.info/commit/31617da5a909c37809b4600f20069bc609cbdd80)), closes [#328](https://github.com/bdougie/contributor.info/issues/328) [#275](https://github.com/bdougie/contributor.info/issues/275)
* migrate distribution charts to uPlot ([#373](https://github.com/bdougie/contributor.info/issues/373)) ([#382](https://github.com/bdougie/contributor.info/issues/382)) ([4118a61](https://github.com/bdougie/contributor.info/commit/4118a6159308b26ebcba0cee60adb8e4c803f8f8))
* migrate GitHub webhook handler from Netlify to Fly.io ([#424](https://github.com/bdougie/contributor.info/issues/424)) ([c535034](https://github.com/bdougie/contributor.info/commit/c535034918926120155c3d268e064b98142b3adb)), closes [#423](https://github.com/bdougie/contributor.info/issues/423) [#411](https://github.com/bdougie/contributor.info/issues/411)
* migrate social cards from Netlify to Fly.io ([#423](https://github.com/bdougie/contributor.info/issues/423)) ([ce1b3aa](https://github.com/bdougie/contributor.info/commit/ce1b3aa12b4581f9581a6f55e0115841d0cf2c67)), closes [#402](https://github.com/bdougie/contributor.info/issues/402)
* optimize 404 page for user retention ([#317](https://github.com/bdougie/contributor.info/issues/317)) ([a6812c5](https://github.com/bdougie/contributor.info/commit/a6812c58648d8084c75f0c8fff37213b7eb57136)), closes [#278](https://github.com/bdougie/contributor.info/issues/278)


### 🐛 Bug Fixes

* Add claude security review & gemini ([#341](https://github.com/bdougie/contributor.info/issues/341)) ([a319a69](https://github.com/bdougie/contributor.info/commit/a319a69b1bac39d519ce837789bc93928685a4a9))
* Add comprehensive schema.org markup for contributor.info ([#306](https://github.com/bdougie/contributor.info/issues/306)) ([9a755a4](https://github.com/bdougie/contributor.info/commit/9a755a44e3bf21c2801d49bbdf37154e98ac126a)), closes [#267](https://github.com/bdougie/contributor.info/issues/267)
* add proper MIME types and cache headers for JavaScript modules ([236516a](https://github.com/bdougie/contributor.info/commit/236516ab07c587a16f5465af16ba7dff7c1b0ff7))
* add repository_id column to comments table ([#425](https://github.com/bdougie/contributor.info/issues/425)) ([12f6e61](https://github.com/bdougie/contributor.info/commit/12f6e613f2836316429bfb89fc4c2119b3cbdb6c))
* allow claude npm install ([d62f471](https://github.com/bdougie/contributor.info/commit/d62f4711f35f4ace535de2499d1c7ab5ed24529d))
* claude.yml ([#369](https://github.com/bdougie/contributor.info/issues/369)) ([ed17886](https://github.com/bdougie/contributor.info/commit/ed17886e11f3e0976f8208ecef3fc209d250025d))
* Core Web Vitals optimizations and CLS fixes ([#285](https://github.com/bdougie/contributor.info/issues/285)) ([#319](https://github.com/bdougie/contributor.info/issues/319)) ([081aa3b](https://github.com/bdougie/contributor.info/commit/081aa3b500a8bd6cc30d1bb7a333f91e1ad5e071))
* correct JavaScript MIME types and add performance optimizations ([#415](https://github.com/bdougie/contributor.info/issues/415)) ([cc55b6c](https://github.com/bdougie/contributor.info/commit/cc55b6c3dae12c8a3038471cadfd2f87e2402d27))
* critical production deployment and security issues ([#259](https://github.com/bdougie/contributor.info/issues/259)) ([b280736](https://github.com/bdougie/contributor.info/commit/b280736521cfa77066eda4ea3657027e857c8670))
* disable service worker to resolve stale cache issues ([3ec3574](https://github.com/bdougie/contributor.info/commit/3ec3574c9b632e190eaa957b9eb7629d4713bcd5))
* enable manual major/minor/patch releases in workflow ([#426](https://github.com/bdougie/contributor.info/issues/426)) ([e849f10](https://github.com/bdougie/contributor.info/commit/e849f10640b90086c76620ca519e669a75475110))
* enable skipped test for repository confidence zero stars/forks edge case ([#364](https://github.com/bdougie/contributor.info/issues/364)) ([6a25908](https://github.com/bdougie/contributor.info/commit/6a25908895d3fa68fd46d10c452694d9bf35b606)), closes [#338](https://github.com/bdougie/contributor.info/issues/338)
* improve Request Priority button visibility in light mode ([#343](https://github.com/bdougie/contributor.info/issues/343)) ([82ba0bb](https://github.com/bdougie/contributor.info/commit/82ba0bb2cfae596adbc6b1666d2539baede730f4))
* improve UI responsiveness by removing breadcrumb line and fixing layout ([#305](https://github.com/bdougie/contributor.info/issues/305)) ([98191ea](https://github.com/bdougie/contributor.info/commit/98191ea2d1dc2ca924d567d4294f96c55b20d027))
* only handle 'labeled' events, not 'unlabeled' ([e2a2a8e](https://github.com/bdougie/contributor.info/commit/e2a2a8e65af249df74d597c24dd25ab3794972f8))
* release.yml to publish changelog ([e082c87](https://github.com/bdougie/contributor.info/commit/e082c87d81baaa96f530b3f5aeb2310bfd537cdb))
* remove SECURITY DEFINER from database views for RLS compliance ([#260](https://github.com/bdougie/contributor.info/issues/260)) ([5d316e9](https://github.com/bdougie/contributor.info/commit/5d316e9260836d241c80b687afdbea9819bd9ca3))
* remove unused vite packages causing Netlify build failures ([#413](https://github.com/bdougie/contributor.info/issues/413)) ([c7a3a3a](https://github.com/bdougie/contributor.info/commit/c7a3a3afa73bee090f1808e05aadcf3ad05bb100)), closes [#388](https://github.com/bdougie/contributor.info/issues/388)
* remove vite-bundle-analyzer to resolve Netlify build failure ([#385](https://github.com/bdougie/contributor.info/issues/385)) ([583175d](https://github.com/bdougie/contributor.info/commit/583175d9ce34a69d9d13b2f7fc7418c923fff2f0)), closes [#365](https://github.com/bdougie/contributor.info/issues/365) [#365](https://github.com/bdougie/contributor.info/issues/365)
* repository tracking with local Inngest development ([#407](https://github.com/bdougie/contributor.info/issues/407)) ([#420](https://github.com/bdougie/contributor.info/issues/420)) ([f7ac446](https://github.com/bdougie/contributor.info/commit/f7ac44679a55dc98795970fb6e0fb0803e27c0e3))
* resolve 406 error and implement comprehensive repository sync ([#261](https://github.com/bdougie/contributor.info/issues/261)) ([3bc860a](https://github.com/bdougie/contributor.info/commit/3bc860a53e6869a2fcde4f46a4ba24260aec5c4b))
* resolve 406 errors when tracking new repositories ([#377](https://github.com/bdougie/contributor.info/issues/377)) ([81ed7be](https://github.com/bdougie/contributor.info/commit/81ed7be8e9a0a7a12396069f4a3eadf5d8c7635b)), closes [#375](https://github.com/bdougie/contributor.info/issues/375) [#375](https://github.com/bdougie/contributor.info/issues/375)
* resolve chunk loading issues from PR [#319](https://github.com/bdougie/contributor.info/issues/319) ([aa8c495](https://github.com/bdougie/contributor.info/commit/aa8c495244dc82e8db4ede25e774b6b434a9a58a))
* resolve performance regression and re-enable tree shaking ([#349](https://github.com/bdougie/contributor.info/issues/349)) ([#353](https://github.com/bdougie/contributor.info/issues/353)) ([33d933c](https://github.com/bdougie/contributor.info/commit/33d933cf0e295bbd2677f97d5d3e27a19043192f)), closes [#333](https://github.com/bdougie/contributor.info/issues/333)
* resolve React initialization errors by consolidating vendor bundle ([#354](https://github.com/bdougie/contributor.info/issues/354)) ([fe066f0](https://github.com/bdougie/contributor.info/commit/fe066f0d41a3f96cbaf7b97085dd19e8601041db))
* resolve test hanging by excluding mock-dependent tests ([#294](https://github.com/bdougie/contributor.info/issues/294)) ([befef78](https://github.com/bdougie/contributor.info/commit/befef78a58d1cea7a96162deda01d732e1a6f870)), closes [#293](https://github.com/bdougie/contributor.info/issues/293) [#299](https://github.com/bdougie/contributor.info/issues/299) [#299](https://github.com/bdougie/contributor.info/issues/299) [#299](https://github.com/bdougie/contributor.info/issues/299) [#299](https://github.com/bdougie/contributor.info/issues/299) [#299](https://github.com/bdougie/contributor.info/issues/299) [#299](https://github.com/bdougie/contributor.info/issues/299) [#299](https://github.com/bdougie/contributor.info/issues/299)
* restore data visualization test coverage ([#296](https://github.com/bdougie/contributor.info/issues/296)) ([#347](https://github.com/bdougie/contributor.info/issues/347)) ([8c362fe](https://github.com/bdougie/contributor.info/commit/8c362fe9f7efb1af1c00f02c05a72ec0eecebb9a))
* revert broken manual release trigger from PR [#426](https://github.com/bdougie/contributor.info/issues/426) ([#427](https://github.com/bdougie/contributor.info/issues/427)) ([a9eaac9](https://github.com/bdougie/contributor.info/commit/a9eaac94544ab18f0269cf320d052375123186e3))
* standardize error handling patterns across Inngest functions ([#422](https://github.com/bdougie/contributor.info/issues/422)) ([5e075f6](https://github.com/bdougie/contributor.info/commit/5e075f6de78ac13beb8cec71e49ba042403e8f8f)), closes [#226](https://github.com/bdougie/contributor.info/issues/226)
* Update claude.yml ([b496461](https://github.com/bdougie/contributor.info/commit/b4964617b6a3dc707739ba7e9ec5042897c6885a))
* update skeleton loaders to match actual design ([#327](https://github.com/bdougie/contributor.info/issues/327)) ([d0cd962](https://github.com/bdougie/contributor.info/commit/d0cd9624a7060ab19e61bd2944c49805ec9063db))
* webhook handler not posting comments - comprehensive fix ([0da8c3e](https://github.com/bdougie/contributor.info/commit/0da8c3e371eddc1cb4716b6e96513f6421cfcdbb))
* webhook should use repository info from payload, not database ([#312](https://github.com/bdougie/contributor.info/issues/312)) ([024d388](https://github.com/bdougie/contributor.info/commit/024d38888d6a70e092bad20bede5428eea486992)), closes [#310](https://github.com/bdougie/contributor.info/issues/310)
* widget xss vulnerability ([#329](https://github.com/bdougie/contributor.info/issues/329)) ([9e12054](https://github.com/bdougie/contributor.info/commit/9e120549ea7e234b0ecb7d50fa98b523ebe7c846)), closes [#322](https://github.com/bdougie/contributor.info/issues/322) [#322](https://github.com/bdougie/contributor.info/issues/322)


### ⚡ Performance Improvements

* add HTTP/2 Server Push and font optimization for Core Web Vitals ([#417](https://github.com/bdougie/contributor.info/issues/417)) ([1182ff4](https://github.com/bdougie/contributor.info/commit/1182ff4d36957ecceb492122b8cc1009092bc6ac))
* improve FCP and LCP % through mild code splitting ([#416](https://github.com/bdougie/contributor.info/issues/416)) ([12ab333](https://github.com/bdougie/contributor.info/commit/12ab3333552cd3c604f26ecfc2fdc0d84df04cca)), closes [#20202](https://github.com/bdougie/contributor.info/issues/20202)


### ♻️ Code Refactoring

* Replace automatic discovery with explicit user-controlled tracking ([#405](https://github.com/bdougie/contributor.info/issues/405)) ([187a7fd](https://github.com/bdougie/contributor.info/commit/187a7fd4d022116d82507d9e39525a5fb4751bc5)), closes [#403](https://github.com/bdougie/contributor.info/issues/403) [#403](https://github.com/bdougie/contributor.info/issues/403) [#404](https://github.com/bdougie/contributor.info/issues/404)
* Update sitemap workflow for deprecated ping endpoints ([#316](https://github.com/bdougie/contributor.info/issues/316)) ([c43456d](https://github.com/bdougie/contributor.info/commit/c43456d9554822f601fbf0b98656b10029970d78))


### 📚 Documentation

* add icon library audit document ([#368](https://github.com/bdougie/contributor.info/issues/368)) ([af9f53d](https://github.com/bdougie/contributor.info/commit/af9f53d120b1e9e711a73724b3bcad30cfec8106)), closes [#358](https://github.com/bdougie/contributor.info/issues/358) [#358](https://github.com/bdougie/contributor.info/issues/358)
* add safe FCP/LCP optimization strategies ([#414](https://github.com/bdougie/contributor.info/issues/414)) ([fb89e6c](https://github.com/bdougie/contributor.info/commit/fb89e6c5200c023e0f2ef7292b2ad93f71537673))
* clean up user documentation and improve accessibility ([#233](https://github.com/bdougie/contributor.info/issues/233)) ([0b271d4](https://github.com/bdougie/contributor.info/commit/0b271d4c55582eadf613bb46d5deaaa76342fd7a)), closes [#407](https://github.com/bdougie/contributor.info/issues/407) [#407](https://github.com/bdougie/contributor.info/issues/407)


### 🔧 Maintenance

* update tracked repositories list [skip ci] ([0cba7d6](https://github.com/bdougie/contributor.info/commit/0cba7d6de54d5fb948a1b1ee85a3d132fb3ed33d))

## [1.11.0](https://github.com/bdougie/contributor.info/compare/v1.10.0...v1.11.0) (2025-08-05)


### 🚀 Features

* add .issues command for semantic PR context analysis ([#214](https://github.com/bdougie/contributor.info/issues/214)) ([d58d989](https://github.com/bdougie/contributor.info/commit/d58d9894148a7cfa5f3fb173b14c9a72d5002b9e))
* add pr-review-responder agent and update prime command ([b7ad789](https://github.com/bdougie/contributor.info/commit/b7ad78953387f7f51228ce45317f181a25330b91))
* AI-powered issue similarity detection with free MiniLM embeddings ([#216](https://github.com/bdougie/contributor.info/issues/216)) ([5846248](https://github.com/bdougie/contributor.info/commit/5846248c019b18e8fa94ec25685fa7750c6819bc))
* complete PR reviewer suggestions implementation ([#221](https://github.com/bdougie/contributor.info/issues/221)) ([df528b1](https://github.com/bdougie/contributor.info/commit/df528b1021d21db15f0b417bb3d02f5dbe7eba65))
* enable pytorch repository progressive backfill ([#251](https://github.com/bdougie/contributor.info/issues/251)) ([e763471](https://github.com/bdougie/contributor.info/commit/e76347106d5ad3ca10e69217a38377dd49f11d83))
* enhance bulk-add-repos with progressive backfill support ([#258](https://github.com/bdougie/contributor.info/issues/258)) ([4d48066](https://github.com/bdougie/contributor.info/commit/4d48066958b49b234019fa2ee1b9260fb3e7ac07))
* implement app stats reviewer suggestions based on CODEOWNERS ([#220](https://github.com/bdougie/contributor.info/issues/220)) ([c27bf3c](https://github.com/bdougie/contributor.info/commit/c27bf3c3aba6eded97101968c2821316d6182b79)), closes [#219](https://github.com/bdougie/contributor.info/issues/219)
* implement contributor.info GitHub App for PR insights ([#212](https://github.com/bdougie/contributor.info/issues/212)) ([d808d5e](https://github.com/bdougie/contributor.info/commit/d808d5ebf2aa20c1537ef8a78856ac1ec32f7f18))
* implement GitHub Actions migration with progressive backfill ([eb55431](https://github.com/bdougie/contributor.info/commit/eb554319cc13539e9070dbb15219e762f962a2d2))
* implement PR tier labeling system with comment-based prioritization ([#215](https://github.com/bdougie/contributor.info/issues/215)) ([c5b0c7f](https://github.com/bdougie/contributor.info/commit/c5b0c7f68920bc477cafdd7c16d0b332cf139e6d))


### 🐛 Bug Fixes

* add missing author_id column to reviews table ([#242](https://github.com/bdougie/contributor.info/issues/242)) ([2504d6c](https://github.com/bdougie/contributor.info/commit/2504d6c69158bda2ec020d5c5e931a4f00d3b337))
* add user notifications for untracked repository searches ([#239](https://github.com/bdougie/contributor.info/issues/239)) ([3e0d3a7](https://github.com/bdougie/contributor.info/commit/3e0d3a74fd7fd38ac07b7a0b9769eba025b9696d)), closes [#222](https://github.com/bdougie/contributor.info/issues/222) [#222](https://github.com/bdougie/contributor.info/issues/222)
* Delete scripts/tier-100.sh ([116d43f](https://github.com/bdougie/contributor.info/commit/116d43ff5fee2dabfbbf2b56932953cff7e6cc07))
* improve error handling and logging in inngest capture functions ([#225](https://github.com/bdougie/contributor.info/issues/225)) ([eaecc82](https://github.com/bdougie/contributor.info/commit/eaecc82efd5a559a91402f9220e05d2d16491b96))
* inngest handler export ([#241](https://github.com/bdougie/contributor.info/issues/241)) ([bc1d967](https://github.com/bdougie/contributor.info/commit/bc1d96791305fe6196094a9e8fdeb10dfdff4dac)), closes [#223](https://github.com/bdougie/contributor.info/issues/223) [#223](https://github.com/bdougie/contributor.info/issues/223)
* missing reviews and comments in feed ([#238](https://github.com/bdougie/contributor.info/issues/238)) ([05c2818](https://github.com/bdougie/contributor.info/commit/05c2818bc0fff48274c8d470a986aca7052bc486))
* progressive backfill error handling and consecutive error checking ([#256](https://github.com/bdougie/contributor.info/issues/256)) ([a9f328a](https://github.com/bdougie/contributor.info/commit/a9f328aeff1d808c0c65b3125d491f674db6513a))
* progressive backfill workflow issues for large repositories ([#254](https://github.com/bdougie/contributor.info/issues/254)) ([e56cdd1](https://github.com/bdougie/contributor.info/commit/e56cdd1e64bef23723566540fc893bb469eb69a0)), closes [#251](https://github.com/bdougie/contributor.info/issues/251)
* progressive backfill workflow issues for large repositories ([#254](https://github.com/bdougie/contributor.info/issues/254)) ([#255](https://github.com/bdougie/contributor.info/issues/255)) ([08be29b](https://github.com/bdougie/contributor.info/commit/08be29b034bb55b64c17190a0641a5b5cfdb2de7))
* properly export handler in inngest-prod.js for Netlify Functions ([57658bc](https://github.com/bdougie/contributor.info/commit/57658bc23b214e9de61528956ebc8a24e7bbee29))
* pytorch data errors ([#240](https://github.com/bdougie/contributor.info/issues/240)) ([bdc0631](https://github.com/bdougie/contributor.info/commit/bdc06317e5af00089d46884e16ad4af63528e59f))
* remove non-existent pull_request_number column references ([#244](https://github.com/bdougie/contributor.info/issues/244)) ([239c39a](https://github.com/bdougie/contributor.info/commit/239c39ad7d49140af1c236b51d1461acf6b78e6a))
* repository not found error for new large repos ([#245](https://github.com/bdougie/contributor.info/issues/245)) ([9f8de66](https://github.com/bdougie/contributor.info/commit/9f8de66a1ed5980b578365976517636bd68bbe5f))
* resolve inngest-prod handler export issue ([aed088e](https://github.com/bdougie/contributor.info/commit/aed088e12a4b2845415219f7e3cfd89de28db407))
* resolve PR activity update workflow failures ([#232](https://github.com/bdougie/contributor.info/issues/232)) ([9efe5d9](https://github.com/bdougie/contributor.info/commit/9efe5d95653246f058c5ec19b6d74f07220a16ad))
* update data loading UX to direct users to GitHub discussions ([#257](https://github.com/bdougie/contributor.info/issues/257)) ([55215b0](https://github.com/bdougie/contributor.info/commit/55215b090345c2246f97d9f13b885d6a37a9e818))
* update script paths after folder reorganization ([#252](https://github.com/bdougie/contributor.info/issues/252)) ([1d4f524](https://github.com/bdougie/contributor.info/commit/1d4f52469bc63a25e3de7b91765582d4c9a3d381)), closes [#251](https://github.com/bdougie/contributor.info/issues/251)


### 📚 Documentation

* add comprehensive documentation for GitHub Actions migration ([#249](https://github.com/bdougie/contributor.info/issues/249)) ([bc2154e](https://github.com/bdougie/contributor.info/commit/bc2154eb720e33e2b481bb5a9ca31d3ee0c80da5))
* add comprehensive README documentation for scripts directory ([#231](https://github.com/bdougie/contributor.info/issues/231)) ([1c2bcfd](https://github.com/bdougie/contributor.info/commit/1c2bcfd91c0af15e60d5f7c9381ffd4ee46d2ec1)), closes [#228](https://github.com/bdougie/contributor.info/issues/228)
* add comprehensive README.md files to all documentation folders ([#234](https://github.com/bdougie/contributor.info/issues/234)) ([cef3e98](https://github.com/bdougie/contributor.info/commit/cef3e98cf818099fce57dd2e756642fdf8ae4f9d))

## [1.10.0](https://github.com/bdougie/contributor.info/compare/v1.9.3...v1.10.0) (2025-07-14)


### 🚀 Features

* add PRD for smart data fetching with repository size classification ([#199](https://github.com/bdougie/contributor.info/issues/199)) ([96f50ab](https://github.com/bdougie/contributor.info/commit/96f50ab5dcfac5f41792cabacb9d1672ca3d970d))
* complete Phase 5 UX enhancements with inline repository metadata ([#205](https://github.com/bdougie/contributor.info/issues/205)) ([f25675a](https://github.com/bdougie/contributor.info/commit/f25675a7f2f34703ffc83e100cd59095b5304e78))
* complete Phase 6 example repository updates ([#207](https://github.com/bdougie/contributor.info/issues/207)) ([615ed7a](https://github.com/bdougie/contributor.info/commit/615ed7a582a6c0bdaea8754de44e57afff83ad6b)), closes [#206](https://github.com/bdougie/contributor.info/issues/206)
* implement Phase 3 smart data fetching strategy ([#202](https://github.com/bdougie/contributor.info/issues/202)) ([4efe0b4](https://github.com/bdougie/contributor.info/commit/4efe0b47048191bdbd4d33d527cc87c0a956f82d))
* implement Phase 4 background capture optimization ([#203](https://github.com/bdougie/contributor.info/issues/203)) ([21b341b](https://github.com/bdougie/contributor.info/commit/21b341b3f61d20fdf5181b25213d8547de2595dc))
* implement repository size classification system ([#201](https://github.com/bdougie/contributor.info/issues/201)) ([972d2eb](https://github.com/bdougie/contributor.info/commit/972d2eb73734bb45e2944e9ca3a632a4f6e6d233))
* Resend Welcome Email ([#194](https://github.com/bdougie/contributor.info/issues/194)) ([3d8e1e4](https://github.com/bdougie/contributor.info/commit/3d8e1e40868c32c08fef16e727ced1a1bc6abcc9))


### 🐛 Bug Fixes

* add GitHub Actions error debugging tools and documentation  ([#198](https://github.com/bdougie/contributor.info/issues/198)) ([01fba79](https://github.com/bdougie/contributor.info/commit/01fba79ae3b9da36901e302433d381db9e644125))
* build ([b1eec1b](https://github.com/bdougie/contributor.info/commit/b1eec1b050155714f3c5dc5017cf588984da291a))
* consolidate build scripts for Netlify deployment ([#197](https://github.com/bdougie/contributor.info/issues/197)) ([e63bb1a](https://github.com/bdougie/contributor.info/commit/e63bb1a13e441d27e481913ca09c8a1126041750))
* Delete docs/data-fetching/data-priority.md ([88ee660](https://github.com/bdougie/contributor.info/commit/88ee6604bc03d5020b27eea73569091508fbe974))
* enable RLS on missing tables to resolve security advisories ([#208](https://github.com/bdougie/contributor.info/issues/208)) ([923ebb5](https://github.com/bdougie/contributor.info/commit/923ebb5d985931008e866ddea8437d4fb92612b7))
* exclude test files from production TypeScript build ([3f6b954](https://github.com/bdougie/contributor.info/commit/3f6b954749bcdbfb9e0ba563ea936436473b10c8))
* exclude test-utils.ts from production build ([370d6b1](https://github.com/bdougie/contributor.info/commit/370d6b188752753cb242b14dda41aeda20a4db88))
* handle missing GITHUB_TOKEN in production Inngest functions ([#192](https://github.com/bdougie/contributor.info/issues/192)) ([7abe03d](https://github.com/bdougie/contributor.info/commit/7abe03d38760ce30b7a11d22268c06ac246375b0))
* move @vitejs/plugin-react to dependencies for Netlify build ([2391a54](https://github.com/bdougie/contributor.info/commit/2391a546e11f1bcb8f3cbbcf5eb49b2ecdaaa72a))
* move autoprefixer to dependencies for Netlify builds ([dc8bf51](https://github.com/bdougie/contributor.info/commit/dc8bf51644f69e9f3c5acb9832b8bf1614b82018))
* move vite-imagetools to dependencies for Netlify build ([87e8901](https://github.com/bdougie/contributor.info/commit/87e8901ccce0db66d909bf9d9501d4fd0684680c))
* New Sign Up Auth ([#195](https://github.com/bdougie/contributor.info/issues/195)) ([fa3bd7d](https://github.com/bdougie/contributor.info/commit/fa3bd7dddbdb9c24261f61153821c80b048f9429))
* re organize docs ([a881ffb](https://github.com/bdougie/contributor.info/commit/a881ffb362ebc10f1b4a9a99401aec77320b7d6a))
* register actual Inngest functions in production handler ([#191](https://github.com/bdougie/contributor.info/issues/191)) ([13643eb](https://github.com/bdougie/contributor.info/commit/13643eb85c5857479e9e99d19fc0749cccdbf1ab))
* release manually ([16e365e](https://github.com/bdougie/contributor.info/commit/16e365e324c9c5be020c8827c6d2b941ce6cf8a9))
* resolve 100% error rate in rollout system by fixing job completion ([#210](https://github.com/bdougie/contributor.info/issues/210)) ([1e9757d](https://github.com/bdougie/contributor.info/commit/1e9757d7d64c667509fe1da00a6afd42cc17c7b4)), closes [#211](https://github.com/bdougie/contributor.info/issues/211)
* update environment variable handling for production Inngest functions ([#196](https://github.com/bdougie/contributor.info/issues/196)) ([5f0abb9](https://github.com/bdougie/contributor.info/commit/5f0abb98c5e083635b2f3d8bed5fd75b4720a7db))


### ⚡ Performance Improvements

* optimize Vite build with modern tooling and analysis ([#193](https://github.com/bdougie/contributor.info/issues/193)) ([47090f5](https://github.com/bdougie/contributor.info/commit/47090f5b215b016b33e3b147509ea27e08bd3a88)), closes [#12883](https://github.com/bdougie/contributor.info/issues/12883)


### 📚 Documentation

* document hybrid GraphQL/REST API strategy ([#200](https://github.com/bdougie/contributor.info/issues/200)) ([762827a](https://github.com/bdougie/contributor.info/commit/762827a78ed6d0e52d47ad0585d61584d10a7b59))

## [1.9.3](https://github.com/bdougie/contributor.info/compare/v1.9.2...v1.9.3) (2025-07-11)


### 🐛 Bug Fixes

* build ([2fd5c3b](https://github.com/bdougie/contributor.info/commit/2fd5c3bffa8dde0379bb3be9d903b0bc83a43a5d))
* improve Inngest production mode detection and key handling ([5e8e601](https://github.com/bdougie/contributor.info/commit/5e8e601b2e2db6329246ab612af70be05e81c2de))

## [1.9.2](https://github.com/bdougie/contributor.info/compare/v1.9.1...v1.9.2) (2025-07-11)


### 🐛 Bug Fixes

* build ([#188](https://github.com/bdougie/contributor.info/issues/188)) ([33ff4e7](https://github.com/bdougie/contributor.info/commit/33ff4e7428e04106d8434fa1a7b86d27d46e0c46))

## [1.9.1](https://github.com/bdougie/contributor.info/compare/v1.9.0...v1.9.1) (2025-07-11)


### 🐛 Bug Fixes

* add proper MIME type headers for TypeScript modules ([#187](https://github.com/bdougie/contributor.info/issues/187)) ([6ce5bae](https://github.com/bdougie/contributor.info/commit/6ce5bae2b2a0c68f007154ed588859ad8e3b6e06))

## [1.9.0](https://github.com/bdougie/contributor.info/compare/v1.8.0...v1.9.0) (2025-07-11)


### 🚀 Features

*  Hybrid Rollout Manager Implementation - Live at 10% ([#186](https://github.com/bdougie/contributor.info/issues/186)) ([656df68](https://github.com/bdougie/contributor.info/commit/656df6836f9e7e56313154bc086b48e7e38503c2))

## [1.8.0](https://github.com/bdougie/contributor.info/compare/v1.7.1...v1.8.0) (2025-07-10)


### 🚀 Features

* gradual rollout infrastructure ([#185](https://github.com/bdougie/contributor.info/issues/185)) ([d4bf352](https://github.com/bdougie/contributor.info/commit/d4bf352a7a39aa84013e351b060df8852281134a))

## [1.7.1](https://github.com/bdougie/contributor.info/compare/v1.7.0...v1.7.1) (2025-07-10)


### 🐛 Bug Fixes

* update semantic release config to use main branch ([01e5241](https://github.com/bdougie/contributor.info/commit/01e5241c04681f45d6b05f25344841c0f2cbde43))


### 👷 CI/CD

* update release workflow to trigger on main branch ([b76adda](https://github.com/bdougie/contributor.info/commit/b76adda968bdd88306e4502c16739fffe7cb538d))

## [1.7.0](https://github.com/bdougie/contributor.info/compare/v1.6.0...v1.7.0) (2025-07-10)


### 🚀 Features

* Implement Hybrid Progressive Capture System with GraphQL Integration ([#182](https://github.com/bdougie/contributor.info/issues/182)) ([7615479](https://github.com/bdougie/contributor.info/commit/7615479cee7a1689812dd2172f6089bcec04770a))
* Improved user exp with data capture and inngest ([#179](https://github.com/bdougie/contributor.info/issues/179)) ([e480ace](https://github.com/bdougie/contributor.info/commit/e480ace682f6084f2a44d3a15128b861898000bd))


### 📚 Documentation

* add major release trigger methods to release process guide ([#183](https://github.com/bdougie/contributor.info/issues/183)) ([91d781d](https://github.com/bdougie/contributor.info/commit/91d781d6a2fced95774f5e49f9bb631348c3a209))

## [1.5.0](https://github.com/bdougie/contributor.info/compare/v1.4.0...v1.5.0) (2025-06-22)


### 🚀 Features

* Db performance and health checks ([#114](https://github.com/bdougie/contributor.info/issues/114)) ([3958f01](https://github.com/bdougie/contributor.info/commit/3958f01744df548a93739693dd444321b0ed35cb))
* FOUC Fix ([#113](https://github.com/bdougie/contributor.info/issues/113)) ([47d5a9a](https://github.com/bdougie/contributor.info/commit/47d5a9a07a8b9643ee9ba917e64449eba6b6b4e4))


### 🐛 Bug Fixes

* Filter Distribution Tab to show only merged PRs ([#119](https://github.com/bdougie/contributor.info/issues/119)) ([7d7d5b8](https://github.com/bdougie/contributor.info/commit/7d7d5b8732974aab3e88b1a8503771a173140f36)), closes [#116](https://github.com/bdougie/contributor.info/issues/116)
* improve mobile responsiveness for Feed and Lottery Factor components ([#118](https://github.com/bdougie/contributor.info/issues/118)) ([d7c6074](https://github.com/bdougie/contributor.info/commit/d7c60744df8ed35efe097e343ed6578d57fd1f8c)), closes [#115](https://github.com/bdougie/contributor.info/issues/115)
* Light ([#117](https://github.com/bdougie/contributor.info/issues/117)) ([e0ffe2f](https://github.com/bdougie/contributor.info/commit/e0ffe2fd1bb351d1bf7923e178c59071a3f15e5e))


### 📚 Documentation

* backfill user guide with comprehensive feature documentation ([#121](https://github.com/bdougie/contributor.info/issues/121)) ([d2f1792](https://github.com/bdougie/contributor.info/commit/d2f179272536bb174da5f6bb78cb3b015babe21b)), closes [#120](https://github.com/bdougie/contributor.info/issues/120)

## [1.4.0](https://github.com/bdougie/contributor.info/compare/v1.3.0...v1.4.0) (2025-06-22)


### 🚀 Features

* Data cleanup & new bot role ([#106](https://github.com/bdougie/contributor.info/issues/106)) ([164e4f3](https://github.com/bdougie/contributor.info/commit/164e4f38c4c0fa6268ccf920e696f1949d4bcba8))
* Enhanced Storybook with Advanced Features ([#110](https://github.com/bdougie/contributor.info/issues/110)) ([75e50dc](https://github.com/bdougie/contributor.info/commit/75e50dc8034e5c730b461508526fdc846fda5289)), closes [#64](https://github.com/bdougie/contributor.info/issues/64)
* Performance imp ([#104](https://github.com/bdougie/contributor.info/issues/104)) ([810bb4c](https://github.com/bdougie/contributor.info/commit/810bb4c8c3ad06fbcb78b8617d5c3887cc545b39))
* Self selection debug ([#102](https://github.com/bdougie/contributor.info/issues/102)) ([1464815](https://github.com/bdougie/contributor.info/commit/1464815a17aba5a91dc0fe5976a4122e494c1fd0))
* Set up evals ([#107](https://github.com/bdougie/contributor.info/issues/107)) ([fb079f2](https://github.com/bdougie/contributor.info/commit/fb079f2a6ac3115e07cb6794e727086faf2569f1))


### 🐛 Bug Fixes

* Fixed critical production deployment issues causing white screen and JavaScript module loading errors. ([#112](https://github.com/bdougie/contributor.info/issues/112)) ([720b687](https://github.com/bdougie/contributor.info/commit/720b68749c120e898edcc3b744b7876f1b884e5a))
* Missed some eval updates ([#108](https://github.com/bdougie/contributor.info/issues/108)) ([4569575](https://github.com/bdougie/contributor.info/commit/4569575db92d3caad175defad4a7528c64894201))
* protect the debug page ([#103](https://github.com/bdougie/contributor.info/issues/103)) ([8843d12](https://github.com/bdougie/contributor.info/commit/8843d12da2dcb85299e3aefc7beb39e5681de0d1))

## [1.3.0](https://github.com/bdougie/contributor.info/compare/v1.2.0...v1.3.0) (2025-06-20)


### 🚀 Features

* Events feed and features with events ([#99](https://github.com/bdougie/contributor.info/issues/99)) ([c4abb3f](https://github.com/bdougie/contributor.info/commit/c4abb3fd27d4a5e4f6d07af778ff0dd43014b911))


### 🐛 Bug Fixes

* changelog updates ([#100](https://github.com/bdougie/contributor.info/issues/100)) ([5621553](https://github.com/bdougie/contributor.info/commit/562155352aea19d1d6fce5a7896b6a7d16519252))
* package-lock ([e89fd68](https://github.com/bdougie/contributor.info/commit/e89fd6873b98cb4b97901a2aea9d6371b91e527f))


### 📚 Documentation

* create confidence.md ([0f85cf2](https://github.com/bdougie/contributor.info/commit/0f85cf21fc71743b856a1ca397e53ab807f327d2))


### 🔧 Maintenance

* **release:** 1.0.0 [skip ci] ([0b69c07](https://github.com/bdougie/contributor.info/commit/0b69c077da7b27fd24497a0ef992736d18b2ded5)), closes [#59](https://github.com/bdougie/contributor.info/issues/59) [#40](https://github.com/bdougie/contributor.info/issues/40) [#60](https://github.com/bdougie/contributor.info/issues/60) [#62](https://github.com/bdougie/contributor.info/issues/62) [#67](https://github.com/bdougie/contributor.info/issues/67) [#61](https://github.com/bdougie/contributor.info/issues/61) [#79](https://github.com/bdougie/contributor.info/issues/79) [#28](https://github.com/bdougie/contributor.info/issues/28) [#82](https://github.com/bdougie/contributor.info/issues/82) [#44](https://github.com/bdougie/contributor.info/issues/44) [#69](https://github.com/bdougie/contributor.info/issues/69) [#36](https://github.com/bdougie/contributor.info/issues/36) [#65](https://github.com/bdougie/contributor.info/issues/65) [#63](https://github.com/bdougie/contributor.info/issues/63) [#83](https://github.com/bdougie/contributor.info/issues/83) [#53](https://github.com/bdougie/contributor.info/issues/53) [#48](https://github.com/bdougie/contributor.info/issues/48) [#51](https://github.com/bdougie/contributor.info/issues/51) [#75](https://github.com/bdougie/contributor.info/issues/75) [#74](https://github.com/bdougie/contributor.info/issues/74)

## [1.2.0](https://github.com/bdougie/contributor.info/compare/v1.1.0...v1.2.0) (2025-06-20)


### 🚀 Features

* Distribution Chart updates ([#92](https://github.com/bdougie/contributor.info/issues/92)) ([5967dc0](https://github.com/bdougie/contributor.info/commit/5967dc0c2d31242a39daba74a0fdf9a9b761a0f9))
* implement user guide documentation structure ([#86](https://github.com/bdougie/contributor.info/issues/86)) ([ff0c03e](https://github.com/bdougie/contributor.info/commit/ff0c03e3bf86049a4585f1dda8d35e4a2189f724)), closes [#81](https://github.com/bdougie/contributor.info/issues/81)
* Missing feature ([#93](https://github.com/bdougie/contributor.info/issues/93)) ([b7f559d](https://github.com/bdougie/contributor.info/commit/b7f559db1a4c2a3087b72cc8d04e4ba3c353af21))
* optimize skeleton loaders for performance and accessibility ([#89](https://github.com/bdougie/contributor.info/issues/89)) ([0870114](https://github.com/bdougie/contributor.info/commit/0870114af467c4e5fa8cc12ca0045e0c9a11c566))


### 🐛 Bug Fixes

* build ([#85](https://github.com/bdougie/contributor.info/issues/85)) ([a8eff02](https://github.com/bdougie/contributor.info/commit/a8eff0273a1bdebec6954435a6c656b8c711364d))
* favicon ([#88](https://github.com/bdougie/contributor.info/issues/88)) ([4dd945e](https://github.com/bdougie/contributor.info/commit/4dd945e83fcd48d76d50adcb0b3951833a5df245))
* release on release ([adf2e21](https://github.com/bdougie/contributor.info/commit/adf2e21cc434a81c18ba87408a352fdc52dd899f))
* release.yml ([aea4bd8](https://github.com/bdougie/contributor.info/commit/aea4bd8e72b3506c63b4ac6bf63ab6af0c7d51d4))
* small ui and build fixes ([#87](https://github.com/bdougie/contributor.info/issues/87)) ([a5c90e8](https://github.com/bdougie/contributor.info/commit/a5c90e85d5fff56075496fe23ad2049760df1a66))

## [1.1.0](https://github.com/bdougie/contributor.info/compare/v1.0.0...v1.1.0) (2025-06-17)


### 🚀 Features

* add changelog navigation with anchors, RSS feed, and SEO ([#84](https://github.com/bdougie/contributor.info/issues/84)) ([16e96c6](https://github.com/bdougie/contributor.info/commit/16e96c65a7ea86263ae43839f35f8768e2ba6b76))

## [1.0.0](https://github.com/bdougie/contributor.info/commit/16e96c65a7ea86263ae43839f35f8768e2ba6b76) (2025-06-17)


### 🚀 Features

* add comprehensive PRD for insights sidebar feature ([#59](https://github.com/bdougie/contributor.info/issues/59)) ([971d03f](https://github.com/bdougie/contributor.info/commit/971d03f9c5246877530387acc4dfdfff88a9e4ce))
* add persistent PR activity settings with Zustand ([#50](https://github.com/bdougie/contributor.info/issues/50)) ([dcc3461](https://github.com/bdougie/contributor.info/commit/dcc3461db786592078dae3367f3683842e94ef48)), closes [#40](https://github.com/bdougie/contributor.info/issues/40)
* Error monitoring ([#60](https://github.com/bdougie/contributor.info/issues/60)) ([b1644f2](https://github.com/bdougie/contributor.info/commit/b1644f276224309c8dbfaeba2229d4c9b90e2d9c))
* implement comprehensive production performance monitoring system ([#71](https://github.com/bdougie/contributor.info/issues/71)) ([f35ddb7](https://github.com/bdougie/contributor.info/commit/f35ddb7f1f0e743d8ebbb8340a9a91719780409c)), closes [#62](https://github.com/bdougie/contributor.info/issues/62)
* Implement Dynamic Social Media Cards with Supabase CDN ([#66](https://github.com/bdougie/contributor.info/issues/66)) ([c522e74](https://github.com/bdougie/contributor.info/commit/c522e74feeab42bf4e34775531536734549f9848)), closes [#67](https://github.com/bdougie/contributor.info/issues/67)
* implement improved cascade delete behavior for database ([#70](https://github.com/bdougie/contributor.info/issues/70)) ([53e753b](https://github.com/bdougie/contributor.info/commit/53e753bdacd3df1e0021f4b0e8c731cb2a24cda7)), closes [#61](https://github.com/bdougie/contributor.info/issues/61)
* implement insights sidebar with real-time PR attention detection ([#76](https://github.com/bdougie/contributor.info/issues/76)) ([1d3db43](https://github.com/bdougie/contributor.info/commit/1d3db43f45f1f45f7847267df9785bc775ce0ab6)), closes [#79](https://github.com/bdougie/contributor.info/issues/79)
* Leaderboard ([#27](https://github.com/bdougie/contributor.info/issues/27)) ([d5ef6e5](https://github.com/bdougie/contributor.info/commit/d5ef6e50c607af605a02fdb77bd3d2859ad00fa5)), closes [#28](https://github.com/bdougie/contributor.info/issues/28)
* make the changelog happen ([#82](https://github.com/bdougie/contributor.info/issues/82)) ([4db6f5f](https://github.com/bdougie/contributor.info/commit/4db6f5faba76578d91128bb935a4a857cea18367))
* only count merged PRs for contributor scoring ([#44](https://github.com/bdougie/contributor.info/issues/44)) ([4b7e4fd](https://github.com/bdougie/contributor.info/commit/4b7e4fd7c6235ebcf62b242f51369cd4a210428b))
* Phase 1 DB improvements - Enhanced Input Validation ([#69](https://github.com/bdougie/contributor.info/issues/69)) ([8a7675f](https://github.com/bdougie/contributor.info/commit/8a7675f78f124496fc8d9fdfc6982bfe11f9ff34))
* Separate charts onto dedicated pages and add Activity tab ([91c69b5](https://github.com/bdougie/contributor.info/commit/91c69b52e3fbf1c4df291ea0747d23a84f5056ac))
* skeleton loaders ([#36](https://github.com/bdougie/contributor.info/issues/36)) ([c2c6ce0](https://github.com/bdougie/contributor.info/commit/c2c6ce03abee92556ec0f79770840baffb3aca83))
* Social Card ([#65](https://github.com/bdougie/contributor.info/issues/65)) ([6bed3e1](https://github.com/bdougie/contributor.info/commit/6bed3e1e5b68719d4d0fd838c8aa585b2736deef))
* Storybook Setup ([#63](https://github.com/bdougie/contributor.info/issues/63)) ([f233335](https://github.com/bdougie/contributor.info/commit/f23333525b434f270d1a3205fabe77d0c5107cc9))


### 🐛 Bug Fixes

* bad json ([#83](https://github.com/bdougie/contributor.info/issues/83)) ([33a0966](https://github.com/bdougie/contributor.info/commit/33a0966927a20bc7110550fc0e04e46e25535e1c))
* example-repos.tsx ([4360c29](https://github.com/bdougie/contributor.info/commit/4360c29b9872178f6e7385199d160567e2ffbd26))
* improve 404 page mobile interaction and color palette consistency ([#53](https://github.com/bdougie/contributor.info/issues/53)) ([1c6ee88](https://github.com/bdougie/contributor.info/commit/1c6ee881b6eec488c29aae134a96df26b0f0eb17))
* improve mobile responsiveness for contributions chart ([#52](https://github.com/bdougie/contributor.info/issues/52)) ([2c62ce4](https://github.com/bdougie/contributor.info/commit/2c62ce4831ca4313b918b33aef4e49d28b1e524d)), closes [#48](https://github.com/bdougie/contributor.info/issues/48)
* remove debug elements from login page ([#54](https://github.com/bdougie/contributor.info/issues/54)) ([4dc4870](https://github.com/bdougie/contributor.info/commit/4dc4870bec3d06e00efc7f0df572842d6a996eb9)), closes [#51](https://github.com/bdougie/contributor.info/issues/51)
* skip tests in Netlify production build to resolve vitest dependency issue ([#75](https://github.com/bdougie/contributor.info/issues/75)) ([3aec151](https://github.com/bdougie/contributor.info/commit/3aec151f61a13c80ae438dacdd9c688d00f445ab)), closes [#74](https://github.com/bdougie/contributor.info/issues/74)


### ♻️ Code Refactoring

* consolidate time range handling and fix display issues ([0b75489](https://github.com/bdougie/contributor.info/commit/0b75489e563b34f4e8efbef84b3a11a784c1bef5))
