const { getJestConfig } = require('@storybook/test-runner');

const config = getJestConfig();
console.log('Jest Config from test-runner:');
console.log(JSON.stringify(config, null, 2));