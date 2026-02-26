import { calculateLotteryFactor } from './src/lib/utils';
import { PullRequest } from './src/lib/types';

// Mock PR data
const users = [
  { login: 'user1', type: 'User' },
  { login: 'user2', type: 'User' },
  { login: 'renovate', type: 'User' }, // Bot masquerading as user type sometimes or just standard user
  { login: 'dependabot[bot]', type: 'Bot' },
  { login: 'active-contributor', type: 'User' },
];

const prs: PullRequest[] = [];
const N = 100000;

for (let i = 0; i < N; i++) {
  const user = users[i % users.length];
  prs.push({
    id: i,
    number: i,
    title: `PR ${i}`,
    user: {
      login: user.login,
      avatar_url: '...',
      type: user.type,
      id: i,
    },
    created_at: new Date().toISOString(), // recent
    state: 'open',
    html_url: '...',
    // ... other fields mocked
  } as any);
}

console.time('calculateLotteryFactor');
calculateLotteryFactor(prs, '30', false);
console.timeEnd('calculateLotteryFactor');
