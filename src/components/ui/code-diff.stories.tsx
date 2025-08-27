import type { Meta, StoryObj } from '@storybook/react';
import { CodeDiff, InlineCodeDiff, MultiLineDiff } from './code-diff';

const meta = {
  title: 'UI/CodeDiff',
  component: CodeDiff,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
## CodeDiff Components

A set of components for visualizing code changes in pull requests.

### InlineCodeDiff - 5-Box Ratio Visualization

The \`InlineCodeDiff\` component uses a unique 5-box system to represent the ratio of changes:

- **Green boxes**: Proportion of lines added
- **Red boxes**: Proportion of lines deleted
- **Gray boxes**: Remaining ratio (represents unchanged context)

#### How it works:
1. Always displays exactly **5 boxes** total
2. Uses \`Math.floor((additions / totalChanged) * 5)\` for green boxes
3. Uses \`Math.floor((deletions / totalChanged) * 5)\` for red boxes
4. Gray boxes fill the remainder to ensure exactly 5 boxes

#### Why 5 boxes?
Using 5 boxes (an odd number) makes it easier to show the weighting of changes:
- Mostly additions: 4 green, 1 red
- Balanced changes: 2 green, 2 red, 1 gray
- Mostly deletions: 1 green, 4 red

This visual system helps users quickly understand if a PR is adding new features (mostly green), 
removing code (mostly red), or refactoring (balanced).
        `,
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CodeDiff>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    before: 'Math.floor((linesAdded / linesChanged) * totalSquares)',
    after: 'Math.floor((linesDeleted / linesChanged) * totalSquares)',
    additions: 36,
    deletions: 10,
  },
};

export const LargeChanges: Story = {
  args: {
    before: 'const result = calculateValue(oldMethod, deprecatedParams)',
    after: 'const result = computeOptimizedValue(newMethod, modernParams, { cache: true })',
    additions: 150,
    deletions: 45,
  },
};

export const SmallChanges: Story = {
  args: {
    before: 'let x = 5',
    after: 'const x = 5',
    additions: 1,
    deletions: 1,
  },
};

export const InlineDiff: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg mb-6">
        <h4 className="font-semibold mb-2">Designer's Note:</h4>
        <p className="text-sm text-muted-foreground">
          "The boxes are a visual representation of the ratio of lines of code added and deleted out
          of all the files changed in a pull request. Gray boxes show if there is a high enough
          ratio of unchanged lines of code within the files changed. Using 5 boxes helps to show a
          weighting of more or less added/deleted/unchanged for the PR, which would be hard to
          represent with an even number."
        </p>
      </div>

      <h3 className="text-lg font-semibold mb-4">5-Box Ratio Visualization Examples</h3>

      <div className="flex items-center gap-4">
        <span className="w-32">All additions:</span>
        <InlineCodeDiff additions={100} deletions={0} />
        <span className="text-sm text-muted-foreground">(5 green boxes)</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-32">All deletions:</span>
        <InlineCodeDiff additions={0} deletions={100} />
        <span className="text-sm text-muted-foreground">(5 red boxes)</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-32">Mostly additions:</span>
        <InlineCodeDiff additions={36} deletions={10} />
        <span className="text-sm text-muted-foreground">(~4 green, 1 red)</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-32">Equal changes:</span>
        <InlineCodeDiff additions={50} deletions={50} />
        <span className="text-sm text-muted-foreground">(2 green, 2 red, 1 gray)</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-32">Small changes:</span>
        <InlineCodeDiff additions={5} deletions={3} />
        <span className="text-sm text-muted-foreground">(3 green, 1 red, 1 gray)</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-32">Mostly deletions:</span>
        <InlineCodeDiff additions={10} deletions={40} />
        <span className="text-sm text-muted-foreground">(1 green, 4 red)</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-32">No changes:</span>
        <InlineCodeDiff additions={0} deletions={0} />
        <span className="text-sm text-muted-foreground">(5 gray boxes)</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-32">Large PR:</span>
        <InlineCodeDiff additions={1250} deletions={750} />
        <span className="text-sm text-muted-foreground">(3 green, 1 red, 1 gray)</span>
      </div>
    </div>
  ),
};

export const MultiLine: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Function Refactor</h3>
      <MultiLineDiff
        lines={[
          { type: 'unchanged', content: 'function calculateMetrics(data) {' },
          { type: 'deletion', content: '  const added = data.linesAdded;' },
          { type: 'deletion', content: '  const changed = data.linesChanged;' },
          {
            type: 'addition',
            content: '  const { linesAdded, linesDeleted, linesChanged } = data;',
          },
          { type: 'unchanged', content: '  const totalSquares = 10;' },
          { type: 'unchanged', content: '' },
          { type: 'deletion', content: '  return Math.floor((added / changed) * totalSquares);' },
          {
            type: 'addition',
            content:
              '  const addedSquares = Math.floor((linesAdded / linesChanged) * totalSquares);',
          },
          {
            type: 'addition',
            content:
              '  const deletedSquares = Math.floor((linesDeleted / linesChanged) * totalSquares);',
          },
          { type: 'addition', content: '  return { addedSquares, deletedSquares };' },
          { type: 'unchanged', content: '}' },
        ]}
      />
    </div>
  ),
};

export const MultiLineWithLineNumbers: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Component Update</h3>
      <MultiLineDiff
        showLineNumbers={true}
        lines={[
          { type: 'unchanged', content: 'import React from "react";', lineNumber: 1 },
          { type: 'deletion', content: 'import { oldHook } from "./hooks";', lineNumber: 2 },
          {
            type: 'addition',
            content: 'import { useOptimizedHook } from "./hooks";',
            lineNumber: 2,
          },
          { type: 'unchanged', content: '', lineNumber: 3 },
          { type: 'unchanged', content: 'export function MyComponent() {', lineNumber: 4 },
          { type: 'deletion', content: '  const data = oldHook();', lineNumber: 5 },
          {
            type: 'addition',
            content: '  const data = useOptimizedHook({ cache: true });',
            lineNumber: 5,
          },
          { type: 'unchanged', content: '  return <div>{data}</div>;', lineNumber: 6 },
          { type: 'unchanged', content: '}', lineNumber: 7 },
        ]}
      />
    </div>
  ),
};

export const DarkMode: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="dark bg-gray-900 p-6 rounded-lg">
        <Story />
      </div>
    ),
  ],
  args: {
    before: 'Math.floor((linesAdded / linesChanged) * totalSquares)',
    after: 'Math.floor((linesDeleted / linesChanged) * totalSquares)',
    additions: 36,
    deletions: 10,
  },
};

export const MultipleExamples: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Variable Rename</h3>
        <CodeDiff
          before="const userName = getUserName();"
          after="const currentUserName = getUserName();"
          additions={1}
          deletions={1}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Method Signature Change</h3>
        <CodeDiff
          before="function process(data) { return data.map(transform); }"
          after="async function processAsync(data, options = {}) { return await Promise.all(data.map(item => transform(item, options))); }"
          additions={45}
          deletions={12}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Import Statement Update</h3>
        <CodeDiff
          before='import Component from "./old-path/Component";'
          after='import { Component } from "@/components/ui/Component";'
          additions={8}
          deletions={6}
        />
      </div>
    </div>
  ),
};
