import { defineConfig } from 'inngest';

export default defineConfig({
  client: {
    id: 'contributor-info',
  },
  serve: {
    host: 'localhost',
    port: 3001,
  },
});
