# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
