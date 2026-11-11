import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { createProjectMiddleware } from './server/local.ts';
import { createAiMiddleware, resolveAiConfig } from './server/ai.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const middleware = createAiMiddleware(resolveAiConfig(env));
  const projects = createProjectMiddleware(resolve(env.ARCHSKETCH_PROJECTS_DIR || 'projects'), resolveAiConfig(env));
  const ai: Plugin = {
    name: 'archsketch-local-ai',
    configureServer(server) { server.middlewares.use(projects); server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(projects); server.middlewares.use(middleware); },
  };
  // STORY-035：项目目录（含交付包 review.html）是数据，不是源码；不让开发服务因写入交付包而整页刷新
  return { plugins: [react(), ai], server: { watch: { ignored: ['**/projects/**'] } } };
});
