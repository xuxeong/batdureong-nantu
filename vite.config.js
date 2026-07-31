import { defineConfig } from 'vite'

export default defineConfig({
  // 게임 코드는 src/, 정적 파일(favicon·og 이미지)은 public/ 에 둔다.
  publicDir: 'public',

  build: {
    outDir: 'dist',
    // 데이터 오류를 조용히 넘기지 않도록 경고를 눈에 띄게 유지한다.
    chunkSizeWarningLimit: 1500,
  },

  server: {
    port: 5173,
    open: true,
  },
})
