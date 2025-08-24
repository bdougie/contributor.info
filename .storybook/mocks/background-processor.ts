export const initializeBackgroundProcessor = () => {
  console.log('[Mock] Background processor disabled in Storybook');
};

export const BackgroundProcessor = {
  start: () => {},
  stop: () => {},
  process: () => Promise.resolve(),
};

export default {};