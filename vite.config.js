import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.RELATIVE_BASE === 'true'
    ? './'
    : process.env.GITHUB_PAGES === 'true'
      ? '/trip-splitter/'
      : '/',
});
