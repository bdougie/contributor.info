import { GitHubSearchInput } from '@/components/ui/github-search-input';

export default function TestPalette() {
  return (
    <div className="p-10 bg-background min-h-screen text-foreground">
      <h1 className="mb-4 text-xl font-bold">Test Palette</h1>
      <GitHubSearchInput
        placeholder="Search repositories (e.g., facebook/react)"
        onSearch={() => {}}
        searchLocation="homepage"
      />
    </div>
  );
}
