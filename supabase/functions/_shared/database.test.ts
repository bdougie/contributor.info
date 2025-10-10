import { assertEquals, assertRejects, assertExists } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { ensureContributor, getContributorByGitHubId, getOrCreateContributor } from './database.ts';
import { MockSupabaseClient, generateTestUser } from '../tests/setup.ts';

Deno.test('ensureContributor - creates new contributor', async () => {
  const supabase = new MockSupabaseClient();
  const userData = generateTestUser();

  const result = await ensureContributor(supabase as any, userData);

  assertExists(result);
  const contributors = supabase.getData('contributors');
  assertEquals(contributors.length, 1);
  assertEquals(contributors[0].username, userData.login);
  assertEquals(contributors[0].github_id, userData.id);
});

Deno.test('ensureContributor - updates existing contributor', async () => {
  const supabase = new MockSupabaseClient();
  const userData = generateTestUser();

  // Create contributor first time
  await ensureContributor(supabase as any, userData);

  // Update with new data
  const updatedData = { ...userData, name: 'Updated Name' };
  const result = await ensureContributor(supabase as any, updatedData);

  assertExists(result);
  const contributors = supabase.getData('contributors');
  assertEquals(contributors.length, 1);
  assertEquals(contributors[0].display_name, 'Updated Name');
});

Deno.test('ensureContributor - handles missing required fields', async () => {
  const supabase = new MockSupabaseClient();
  const userData = generateTestUser({ id: undefined });

  const result = await ensureContributor(supabase as any, userData);
  assertEquals(result, null);
});

Deno.test('ensureContributor - detects bot accounts', async () => {
  const supabase = new MockSupabaseClient();
  const botUserData = generateTestUser({ 
    login: 'dependabot[bot]',
    type: 'Bot'
  });

  await ensureContributor(supabase as any, botUserData);
  
  const contributors = supabase.getData('contributors');
  assertEquals(contributors[0].is_bot, true);
});

Deno.test('ensureContributor - handles extended user data', async () => {
  const supabase = new MockSupabaseClient();
  const userData = generateTestUser({
    bio: 'Test bio',
    company: 'Test Company',
    location: 'Test Location',
    blog: 'https://test.com',
    followers: 100,
    following: 50,
    public_repos: 25,
    github_created_at: '2020-01-01T00:00:00Z'
  });

  await ensureContributor(supabase as any, userData);
  
  const contributors = supabase.getData('contributors');
  assertEquals(contributors[0].bio, 'Test bio');
  assertEquals(contributors[0].company, 'Test Company');
  assertEquals(contributors[0].location, 'Test Location');
  assertEquals(contributors[0].followers, 100);
  assertEquals(contributors[0].following, 50);
  assertEquals(contributors[0].public_repos, 25);
});

Deno.test('getContributorByGitHubId - finds existing contributor', async () => {
  const supabase = new MockSupabaseClient();
  const userData = generateTestUser();
  
  // Seed data
  supabase.seed('contributors', [{
    id: 'test-id',
    github_id: userData.id,
    username: userData.login
  }]);

  const result = await getContributorByGitHubId(supabase as any, userData.id);
  assertEquals(result, 'test-id');
});

Deno.test('getContributorByGitHubId - returns null for non-existent contributor', async () => {
  const supabase = new MockSupabaseClient();
  
  const result = await getContributorByGitHubId(supabase as any, 99999);
  assertEquals(result, null);
});

Deno.test('getOrCreateContributor - returns existing contributor ID', async () => {
  const supabase = new MockSupabaseClient();
  const userData = generateTestUser();
  
  // Seed data
  supabase.seed('contributors', [{
    id: 'existing-id',
    github_id: userData.id,
    username: userData.login
  }]);

  const result = await getOrCreateContributor(supabase as any, userData);
  assertEquals(result, 'existing-id');
});

Deno.test('getOrCreateContributor - creates new contributor if none exists', async () => {
  const supabase = new MockSupabaseClient();
  const userData = generateTestUser();

  const result = await getOrCreateContributor(supabase as any, userData);
  
  assertExists(result);
  const contributors = supabase.getData('contributors');
  assertEquals(contributors.length, 1);
  assertEquals(contributors[0].username, userData.login);
});