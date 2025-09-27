// Mock for use-on-demand-sync hook in Storybook
export const useOnDemandSync = () => ({
  hasData: true,
  syncStatus: { isTriggering: false, isInProgress: false, error: null },
  triggerSync: () => {},
});
