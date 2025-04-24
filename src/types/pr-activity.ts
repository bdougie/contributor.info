export type ActivityType = 'opened' | 'closed' | 'merged' | 'reviewed' | 'commented';

export interface User {
  id: string;
  name: string;
  avatar: string;
  isBot?: boolean;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  url: string;
}

export interface PullRequestActivity {
  id: string;
  type: ActivityType;
  user: User;
  pullRequest: {
    id: string;
    number: number;
    title: string;
    url: string;
  };
  repository: Repository;
  timestamp: string;
  createdAt: Date;
}