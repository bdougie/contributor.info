import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { useContributorProfileRoute } from '../use-contributor-profile-route';

function ProfileRouteHarness() {
  const profile = useContributorProfileRoute();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="url">{location.pathname + location.search + location.hash}</output>
      <output data-testid="profile">{profile.username || 'closed'}</output>
      <output data-testid="tab">{profile.activeTab}</output>
      <button onClick={() => profile.openProfile('bdougie')}>Open</button>
      <button onClick={() => profile.setActiveTab('reviews')}>Reviews</button>
      <button onClick={() => profile.setActiveTab('overview')}>Overview</button>
      <button onClick={profile.closeProfile}>Close</button>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
    </>
  );
}

const base = '/i/open-source-repos/contributors';
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const value = (name: string) => screen.getByTestId(name).textContent;

function setup(url = base) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ProfileRouteHarness />
    </MemoryRouter>
  );
}

describe('contributor profile navigation', () => {
  afterEach(cleanup);

  it('opens a shareable profile without losing other query parameters or the hash', () => {
    setup(`${base}?filter=active#contributors`);
    expect(value('profile')).toBe('closed');
    click('Open');
    expect(value('url')).toBe(`${base}?filter=active&contributor=bdougie#contributors`);
    expect(value('profile')).toBe('bdougie');
  });

  it('uses one history entry for a profile and its tabs, with Back and Forward support', () => {
    setup();
    click('Open');
    click('Reviews');
    expect(value('url')).toBe(`${base}?contributor=bdougie&profileTab=reviews`);
    click('Back');
    expect(value('profile')).toBe('closed');
    click('Forward');
    expect(value('profile')).toBe('bdougie');
    expect(value('tab')).toBe('reviews');
    click('Close');
    expect(value('url')).toBe(base);
  });

  it('restores a shared tab and closes within the workspace without a prior list entry', () => {
    setup(`${base}?filter=active&contributor=bdougie&profileTab=reviews#contributors`);
    expect(value('profile')).toBe('bdougie');
    expect(value('tab')).toBe('reviews');
    click('Close');
    expect(value('url')).toBe(`${base}?filter=active#contributors`);
  });

  it('falls back to overview for an invalid tab and omits the default tab from links', () => {
    setup(`${base}?contributor=bdougie&profileTab=invalid`);
    expect(value('tab')).toBe('overview');
    click('Reviews');
    click('Overview');
    expect(value('url')).toBe(`${base}?contributor=bdougie`);
  });

  it('does not open an empty contributor selection', () => {
    setup(`${base}?contributor=%20`);
    expect(value('profile')).toBe('closed');
  });
});
