## Local Development Setup Guide

This guide provides a complete, step-by-step process for setting up your local development environment for [Contributor.info](http://contributor.info/). Following these steps will ensure you have all the necessary services running to contribute effectively.

### Prerequisites Checklist

Before you begin, ensure you have the following installed and configured:

  * [ ] **Node.js**: v18 or later.
  * [ ] **npm** or **yarn**.
  * [ ] **Docker Desktop**: Must be installed and running.
  * [ ] **Git**: Configured with your SSH keys for GitHub.
  * [ ] **Supabase CLI**: Install globally with `npm install -g supabase`.
  * [ ] **Netlify CLI**: Install globally with `npm install -g netlify-cli`.
  * [ ] **Inngest CLI**: Install globally with `npm install -g inngest-cli`.
  * [ ] **GitHub Account**: With a [Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) created.

-----

### Setup Order

For a smooth setup, please follow these steps in order:

1.  **Clone the Repository**: Get the code on your local machine.
2.  **Configure Environment Variables**: Set up your `.env.local` file.
3.  **Set Up Supabase**: Initialize the local database.
4.  **Set Up Inngest**: Configure the background job processor.
5.  **Install Dependencies**: Install all project dependencies.
6.  **Verify Setup**: Run the verification script to check your configuration.
7.  **Start Development**: Launch the development servers.

-----

### Step-by-Step Instructions

#### 1\. Clone the Repository

First, fork the official repository to your GitHub account and then clone your fork to your local machine.

```bash
git clone https://github.com/[your-fork]/contributor.info.git
cd contributor.info
```

#### 2\. Configure Environment Variables

Create a `.env.local` file by copying the example file.

```bash
cp .env.example .env.local
```

Now, open `.env.local` and fill in the required values. You will get the Supabase and Inngest keys in the following steps.

```env
# REQUIRED - Core Services
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY= # Get this from `supabase status`
VITE_GITHUB_TOKEN=ghp_... # Your GitHub Personal Access Token

# REQUIRED - Inngest
INNGEST_EVENT_KEY= # Get this from your Inngest dashboard
INNGEST_SIGNING_KEY= # Get this from your Inngest dashboard

# OPTIONAL - Analytics & Monitoring
VITE_POSTHOG_KEY=
VITE_SENTRY_DSN=

# OPTIONAL - AI Features
OPENAI_API_KEY=

# OPTIONAL - URL Shortening
VITE_DUB_CO_KEY=
```

#### 3\. Set Up Supabase (Database)

We use Supabase for our database and authentication. The following commands will start a local, containerized version of Supabase.

```bash
# Initialize Supabase (only needs to be run once)
supabase init

# Start the Supabase stack
supabase start

# Apply database migrations
supabase db push

# Seed the database with test data
supabase db seed
```

After running `supabase start`, you will see the local credentials. Copy the `anon key` and paste it into `VITE_SUPABASE_ANON_KEY` in your `.env.local` file.

#### 4\. Set Up Inngest (Background Jobs)

Inngest is used for managing background jobs. You'll need to start the Netlify dev server first, as the Inngest CLI connects to it.

```bash
# In a new terminal, start the Netlify dev server
netlify dev --port 8888
```

```bash
# In a second terminal, start the Inngest dev server
npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest-local
```

You can now view the Inngest dashboard at [http://localhost:8288](https://www.google.com/search?q=http://localhost:8288).

#### 5\. Install Dependencies

Now, you can install the project's npm dependencies.

```bash
npm install
```

#### 6\. Verify Your Setup

We've created a script to help you verify that your local environment is configured correctly.

```bash
npm run setup:verify
```

This script will check your Node.js version, environment variables, and Docker/Supabase status.

#### 7\. Start Development

To start the development server and all related services, use the `dev:all` command.

```bash
npm run dev:all
```

This will concurrently start the Vite development server and the Inngest development server. Your application will be available at `http://localhost:3000`.

-----

### Troubleshooting Common Issues

  * **Supabase won't start**
      * **Issue**: "Docker daemon not running"
      * **Solution**: Ensure that Docker Desktop is running before you execute `supabase start`.
  * **Inngest not connecting**
      * **Issue**: "SDK response was not signed"
      * **Solution**: Verify that `INNGEST_SIGNING_KEY` in your `.env.local` is set correctly.
  * **GitHub API rate limiting**
      * **Issue**: "API rate limit exceeded"
      * **Solution**: Make sure `VITE_GITHUB_TOKEN` is a valid Personal Access Token with the necessary scopes.
  * **Database migrations fail**
      * **Issue**: "Migration error"
      * **Solution**: Run `supabase db reset` to start with a fresh, clean database.
