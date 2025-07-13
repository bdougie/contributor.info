// Example repositories for demos and testing
// Organized by priority and use case

export interface ExampleCategory {
  name: string;
  description?: string;
  repos: {
    name: string;
    description?: string;
    notes?: string;
  }[];
}

export const EXAMPLE_CATEGORIES: ExampleCategory[] = [
  {
    name: "Priority Demos",
    description: "Primary repositories for demos and presentations",
    repos: [
      {
        name: "continuedev/continue",
        description: "AI code assistant",
        notes: "Primary demo repo with good contributor diversity"
      },
      {
        name: "vitejs/vite",
        description: "Frontend tooling",
        notes: "Popular, active project with clear contribution patterns"
      },
      {
        name: "facebook/react",
        description: "UI library",
        notes: "Well-known project, good for recognition"
      }
    ]
  },
  {
    name: "Large Scale Projects",
    description: "Enterprise-scale repositories (use with caution)",
    repos: [
      {
        name: "kubernetes/kubernetes",
        description: "Container orchestration",
        notes: "⚠️ Protected from resource exhaustion - very large repo"
      },
      {
        name: "etcd-io/etcd",
        description: "Distributed key-value store",
        notes: "Good example of distributed systems project"
      }
    ]
  },
  {
    name: "Customer Demos",
    description: "Repositories for specific customer demonstrations",
    repos: [
      // Add customer-specific repos here as needed
      // {
      //   name: "company/repo",
      //   description: "Description",
      //   notes: "Customer: X, Demo date: Y"
      // }
    ]
  },
  {
    name: "Testing",
    description: "Repositories for testing specific features",
    repos: [
      // Add test repos here
      // {
      //   name: "small/test-repo",
      //   description: "Small repo for quick tests",
      //   notes: "~50 PRs, good for testing"
      // }
    ]
  }
];

// Get all repositories as a flat array
export function getAllExampleRepos(): string[] {
  return EXAMPLE_CATEGORIES
    .flatMap(category => category.repos)
    .map(repo => repo.name);
}

// Get repositories by category
export function getReposByCategory(categoryName: string): string[] {
  const category = EXAMPLE_CATEGORIES.find(cat => cat.name === categoryName);
  return category ? category.repos.map(repo => repo.name) : [];
}

// Get priority demo repositories (first category by default)
export function getPriorityDemos(): string[] {
  return EXAMPLE_CATEGORIES[0]?.repos.map(repo => repo.name) || [];
}

// Check if a repository is marked as resource-intensive
export function isResourceIntensiveRepo(repoName: string): boolean {
  const largeRepos = ["kubernetes/kubernetes", "microsoft/vscode", "tensorflow/tensorflow"];
  return largeRepos.includes(repoName);
}

// Add a new example repository
export function addExampleRepo(
  categoryName: string,
  repo: { name: string; description?: string; notes?: string }
): void {
  const category = EXAMPLE_CATEGORIES.find(cat => cat.name === categoryName);
  if (category && !category.repos.find(r => r.name === repo.name)) {
    category.repos.push(repo);
  }
}