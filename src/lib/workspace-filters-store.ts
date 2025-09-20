import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PRState = 'open' | 'closed' | 'merged' | 'draft';
export type IssueState = 'open' | 'closed';
export type IssueAssignmentFilter = 'all' | 'assigned' | 'unassigned';

interface WorkspaceFiltersState {
  // PR Filters
  prStates: PRState[];
  prIncludeBots: boolean;
  setPRStates: (states: PRState[]) => void;
  setPRIncludeBots: (include: boolean) => void;
  togglePRState: (state: PRState) => void;

  // Issue Filters
  issueStates: IssueState[];
  issueIncludeBots: boolean;
  issueAssignmentFilter: IssueAssignmentFilter;
  setIssueStates: (states: IssueState[]) => void;
  setIssueIncludeBots: (include: boolean) => void;
  setIssueAssignmentFilter: (filter: IssueAssignmentFilter) => void;
  toggleIssueState: (state: IssueState) => void;

  // Reset filters
  resetPRFilters: () => void;
  resetIssueFilters: () => void;
}

const DEFAULT_PR_STATES: PRState[] = ['open', 'closed', 'merged', 'draft'];
const DEFAULT_ISSUE_STATES: IssueState[] = ['open', 'closed'];

export const useWorkspaceFiltersStore = create<WorkspaceFiltersState>()(
  persist(
    (set) => ({
      // PR Filter State
      prStates: DEFAULT_PR_STATES,
      prIncludeBots: true,
      setPRStates: (states) => set({ prStates: states }),
      setPRIncludeBots: (include) => set({ prIncludeBots: include }),
      togglePRState: (state) =>
        set((current) => {
          const isCurrentlySelected = current.prStates.includes(state);
          const newStates = isCurrentlySelected
            ? current.prStates.filter((s) => s !== state)
            : [...current.prStates, state];

          // Prevent empty state selection - keep at least one state selected
          return {
            prStates: newStates.length > 0 ? newStates : [state],
          };
        }),

      // Issue Filter State
      issueStates: DEFAULT_ISSUE_STATES,
      issueIncludeBots: true,
      issueAssignmentFilter: 'all',
      setIssueStates: (states) => set({ issueStates: states }),
      setIssueIncludeBots: (include) => set({ issueIncludeBots: include }),
      setIssueAssignmentFilter: (filter) => set({ issueAssignmentFilter: filter }),
      toggleIssueState: (state) =>
        set((current) => {
          const isCurrentlySelected = current.issueStates.includes(state);
          const newStates = isCurrentlySelected
            ? current.issueStates.filter((s) => s !== state)
            : [...current.issueStates, state];

          // Prevent empty state selection - keep at least one state selected
          return {
            issueStates: newStates.length > 0 ? newStates : [state],
          };
        }),

      // Reset methods
      resetPRFilters: () =>
        set({
          prStates: DEFAULT_PR_STATES,
          prIncludeBots: true,
        }),
      resetIssueFilters: () =>
        set({
          issueStates: DEFAULT_ISSUE_STATES,
          issueIncludeBots: true,
          issueAssignmentFilter: 'all',
        }),
    }),
    {
      name: 'workspace-filters',
      // Add storage error handling
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          } catch (err) {
            console.warn('Failed to load workspace filters from localStorage:', err);
            return null; // Return null to use default values
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (err) {
            console.warn('Failed to save workspace filters to localStorage:', err);
            // Silently fail - the app will continue to work without persistence
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch (err) {
            console.warn('Failed to remove workspace filters from localStorage:', err);
            // Silently fail
          }
        },
      },
    }
  )
);
