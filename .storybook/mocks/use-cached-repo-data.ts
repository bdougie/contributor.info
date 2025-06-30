// Mock for use-cached-repo-data hook in Storybook
import { fn } from "@storybook/test";

export const useCachedRepoData = fn(() => ({
  data: {
    owner: "facebook",
    name: "react",
    full_name: "facebook/react",
    description: "The library for web and native user interfaces",
    stargazers_count: 228000,
    forks_count: 46000,
    language: "JavaScript",
    contributors: []
  },
  loading: false,
  error: null,
  refetch: fn()
}));