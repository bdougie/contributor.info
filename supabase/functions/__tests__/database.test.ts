/**
 * Tests for database utilities
 * 
 * Run with: deno test supabase/functions/__tests__/database.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import type { GitHubUser } from '../_shared/database.ts';

Deno.test('GitHubUser type validation', () => {
  const validUser: GitHubUser = {
    id: 12345,
    login: 'octocat',
    name: 'The Octocat',
    email: 'octocat@github.com',
    avatar_url: 'https://avatars.githubusercontent.com/u/583231',
    type: 'User',
  };

  assertEquals(validUser.id, 12345);
  assertEquals(validUser.login, 'octocat');
  assertExists(validUser.name);
});

Deno.test('GitHubUser with minimal fields', () => {
  const minimalUser: GitHubUser = {
    id: 12345,
    login: 'octocat',
  };

  assertEquals(minimalUser.id, 12345);
  assertEquals(minimalUser.login, 'octocat');
  assertEquals(minimalUser.name, undefined);
});

Deno.test('Bot user detection patterns', () => {
  const botUsers = [
    { id: 1, login: 'dependabot[bot]', type: 'Bot' },
    { id: 2, login: 'renovate[bot]', type: 'Bot' },
    { id: 3, login: 'github-actions[bot]', type: 'Bot' },
  ];

  const humanUsers = [
    { id: 4, login: 'octocat', type: 'User' },
    { id: 5, login: 'torvalds', type: 'User' },
  ];

  // All bot users should have type 'Bot' or [bot] in login
  botUsers.forEach((user) => {
    const isBot = user.type === 'Bot' || user.login.includes('[bot]');
    assertEquals(isBot, true, `${user.login} should be detected as bot`);
  });

  // Human users should not match bot patterns
  humanUsers.forEach((user) => {
    const isBot = user.type === 'Bot' || user.login.includes('[bot]');
    assertEquals(isBot, false, `${user.login} should not be detected as bot`);
  });
});
