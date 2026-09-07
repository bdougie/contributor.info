import { useLocation, useNavigate, useSearchParams } from 'react-router';

export const CONTRIBUTOR_PROFILE_TABS = [
  'overview',
  'insights',
  'activity',
  'reviews',
  'notes',
  'stats',
] as const;

export type ContributorProfileTab = (typeof CONTRIBUTOR_PROFILE_TABS)[number];

export function isContributorProfileTab(value: string | null): value is ContributorProfileTab {
  return CONTRIBUTOR_PROFILE_TABS.some((tab) => tab === value);
}

/** Keep profiles shareable while retaining the workspace behind the dialog. */
export function useContributorProfileRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('contributor')?.trim() || null;
  const requestedTab = searchParams.get('profileTab');
  const activeTab = isContributorProfileTab(requestedTab) ? requestedTab : 'overview';

  const openProfile = (contributorUsername: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('contributor', contributorUsername);
    params.delete('profileTab');
    navigate(
      { pathname: location.pathname, search: params.toString(), hash: location.hash },
      {
        replace: Boolean(username),
        preventScrollReset: true,
        state: username ? location.state : { ...location.state, contributorProfileFromList: true },
      }
    );
  };

  const setActiveTab = (tab: ContributorProfileTab) => {
    const params = new URLSearchParams(searchParams);
    if (tab === 'overview') params.delete('profileTab');
    else params.set('profileTab', tab);
    navigate(
      { pathname: location.pathname, search: params.toString(), hash: location.hash },
      { replace: true, preventScrollReset: true, state: location.state }
    );
  };

  const closeProfile = () => {
    // Opening adds one history entry; tab changes replace it, so Back closes the profile.
    if (location.state?.contributorProfileFromList) {
      navigate(-1);
      return;
    }

    // A shared URL may be the first entry. Keep the visitor in this workspace.
    const params = new URLSearchParams(searchParams);
    params.delete('contributor');
    params.delete('profileTab');
    navigate(
      { pathname: location.pathname, search: params.toString(), hash: location.hash },
      { replace: true, preventScrollReset: true, state: location.state }
    );
  };

  return { username, activeTab, openProfile, closeProfile, setActiveTab };
}
