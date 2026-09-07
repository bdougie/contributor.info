/** End-to-end QA against the running local Auth/API/database; no request mocks. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 853, height: 863 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const switchAccount = async (name: string) => {
    await page.getByRole('combobox', { name: 'Local QA account' }).click();
    await Promise.all([
      page.waitForEvent('domcontentloaded'),
      page.getByRole('option', { name, exact: true }).click(),
    ]);
    await page.getByRole('button', { name: 'Sign out locally', exact: true }).waitFor();
  };
  await page.goto('http://localhost:5175/review-labels?source=human');
  await page.getByRole('button', { name: 'Choose QA account', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/review-labels');
  await switchAccount('Owner · bdougie');
  await page.goto('http://localhost:5175/');
  await page.getByRole('button', { name: /^Select workspace/ }).click();
  const reviewLabelsLink = page.getByRole('menuitem', { name: 'Review labels', exact: true });
  const workspacePath = await reviewLabelsLink.getAttribute('href');
  assert.match(workspacePath || '', /^\/review-labels\?workspace=[a-f0-9-]+$/);
  await page.screenshot({ path: resolve('.review-labels-qa/workspace-menu.png'), fullPage: true });
  await reviewLabelsLink.click();
  await page.waitForURL('**' + workspacePath);
  await page.setViewportSize({ width: 390, height: 863 });
  await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Review labels', exact: true })
    .click();
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, workspacePath);
  await page.setViewportSize({ width: 853, height: 863 });
  await page.getByRole('heading', { name: 'Invite reviewers', exact: true }).waitFor();
  if (await page.getByRole('button', { name: 'Choose new repositories', exact: true }).count()) {
    await page.getByRole('button', { name: 'Choose new repositories', exact: true }).click();
  }
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Save repositories', exact: true }).click();
  await page.getByLabel('GitHub login', { exact: true }).fill('yeazelm');
  const inviteResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api-review-labels') &&
      response.request().postDataJSON()?.action === 'invite'
  );
  await page.getByRole('button', { name: 'Create invite link', exact: true }).click();
  const createdInvite = (await (await inviteResponse).json()) as { id: string };
  const link = await page.getByLabel('Personal invite link · expires in 7 days').inputValue();
  assert.match(link, /^http:\/\/localhost:5175\/review-labels\/[a-f0-9]{64}\/invite$/);
  await page.goto(link);
  await page.getByRole('button', { name: 'Join workspace', exact: true }).waitFor();
  await switchAccount('John · jpmcb');
  await page.getByRole('button', { name: 'Join workspace', exact: true }).click();
  await page.getByText('Sign in with the invited GitHub account', { exact: true }).waitFor();
  await switchAccount('Matt · yeazelm');
  await page.getByRole('button', { name: 'Join workspace', exact: true }).click();
  await page.getByRole('heading', { name: 'Your past pull requests', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Human reviews', exact: true }).click();
  await page
    .getByRole('button', { name: /Label comment by jpmcb/ })
    .first()
    .click();
  await page.getByRole('button', { name: /^good/i }).click();
  await page
    .getByRole('heading', { name: 'All comments in this view are labeled', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Mark something missed', exact: true }).click();
  await page.getByLabel('Missed', { exact: true }).fill('Local QA: check shutdown races.');
  await page.getByRole('button', { name: 'Save missed', exact: true }).click();
  await page.getByText('Local QA: check shutdown races.', { exact: true }).waitFor();
  for (const width of [390, 853, 1440]) {
    await page.setViewportSize({ width, height: 863 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false
    );
  }
  await page.setViewportSize({ width: 853, height: 863 });
  await page.screenshot({ path: resolve('.review-labels-qa/review.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my labels', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) content += chunk;
  const labels = content
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line)) as {
    demo: boolean;
    qa: boolean;
    label: string;
    comment?: { author: string };
  }[];
  assert.ok(labels.every((label) => label.demo === true && label.qa === true));
  assert.ok(labels.some((label) => label.comment?.author === 'jpmcb' && label.label === 'good'));
  await page.reload();
  await page.getByText('good', { exact: true }).waitFor();
  await switchAccount('Owner · bdougie');
  await page.getByRole('heading', { name: 'Invite reviewers', exact: true }).waitFor();
  const refreshedHome = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api-review-labels') &&
      response.request().postDataJSON()?.action === 'home'
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const home = (await (await refreshedHome).json()) as {
    workspaces: { invites: { id: string; accepted_at: string | null; view_count: number }[] }[];
  };
  const trackedInvite = home.workspaces
    .flatMap((workspace) => workspace.invites)
    .find((invite) => invite.id === createdInvite.id);
  assert.ok(trackedInvite?.accepted_at);
  assert.equal(trackedInvite.view_count, 1);
  await page.screenshot({ path: resolve('.review-labels-qa/owner-return.png'), fullPage: true });
  await page.getByText('Accepted', { exact: true }).and(page.locator('div')).waitFor();
  await page.getByText('Last viewed · 1 sessions', { exact: true }).waitFor();
  await page.screenshot({ path: resolve('.review-labels-qa/invite-status.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'Passed: workspace and mobile navigation, local sign-in, invite creation, view deduplication, wrong-account rejection, acceptance, human/missed labels, reload persistence, test exports, and responsive layout.'
  );
} finally {
  await browser.close();
}
