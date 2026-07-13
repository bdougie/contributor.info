import { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
import { getSupabase } from '@/lib/supabase-lazy';
import { env } from '@/lib/env';
import {
  toOrgImportRepo,
  sortByMostRecentlyPushed,
  type OrgImportRepo,
  type OctokitOrgRepo,
} from '@/lib/utils/org-import';

const MAX_ORG_REPOS = 200;
const PER_PAGE = 100;

export interface UseOrgReposForImportState {
  repos: OrgImportRepo[];
  appInstalled: boolean;
  isLoading: boolean;
  error: string | null;
}

const IDLE_STATE: UseOrgReposForImportState = {
  repos: [],
  appInstalled: false,
  isLoading: false,
  error: null,
};

/**
 * List an org's repositories for the workspace import flow.
 *
 * Uses the signed-in user's GitHub OAuth token when available so private
 * repos they can see are included; falls back to the public app token.
 * Also reports whether the org has an active contributor.info GitHub App
 * installation, which gates tracking private repositories.
 */
export function useOrgReposForImport(org: string | null): UseOrgReposForImportState {
  const [state, setState] = useState<UseOrgReposForImportState>(IDLE_STATE);

  useEffect(() => {
    if (!org) {
      setState(IDLE_STATE);
      return;
    }

    let cancelled = false;

    const fetchOrgRepos = async () => {
      setState({ repos: [], appInstalled: false, isLoading: true, error: null });

      try {
        const supabase = await getSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const octokit = new Octokit({
          auth: session?.provider_token || env.GITHUB_TOKEN,
        });

        const rawRepos: OctokitOrgRepo[] = [];
        for (let page = 1; rawRepos.length < MAX_ORG_REPOS; page++) {
          const { data } = await octokit.rest.repos.listForOrg({
            org,
            type: 'all',
            sort: 'pushed',
            direction: 'desc',
            per_page: PER_PAGE,
            page,
          });
          rawRepos.push(...data);
          if (data.length < PER_PAGE) break;
        }

        // Active org-wide GitHub App installation gates private-repo tracking
        const { data: installations } = await supabase
          .from('github_app_installations')
          .select('id')
          .ilike('account_name', org)
          .is('deleted_at', null)
          .is('suspended_at', null)
          .limit(1);

        if (cancelled) return;

        setState({
          repos: sortByMostRecentlyPushed(rawRepos.slice(0, MAX_ORG_REPOS).map(toOrgImportRepo)),
          appInstalled: Boolean(installations && installations.length > 0),
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        let message = 'Failed to fetch organization repositories';
        if (err && typeof err === 'object' && 'status' in err) {
          const status = (err as { status: number }).status;
          if (status === 404) {
            message = `Organization "${org}" not found`;
          } else if (status === 403) {
            message = 'GitHub rate limit exceeded. Please try again later.';
          }
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }

        setState({ repos: [], appInstalled: false, isLoading: false, error: message });
      }
    };

    fetchOrgRepos();

    return () => {
      cancelled = true;
    };
  }, [org]);

  return state;
}
