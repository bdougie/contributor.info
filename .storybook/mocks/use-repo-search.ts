// Mock for use-repo-search hook in Storybook
import { fn } from "@storybook/test";

export const useRepoSearch = fn(() => ({
  searchResults: [],
  isSearching: false,
  searchRepo: fn(),
  selectedRepo: null,
  setSelectedRepo: fn(),
  clearSearch: fn()
}));