import { app } from './app';
import { ENV } from './config/env.config';

export function startServer() {
  return app.listen(ENV.PORT, () => {
    console.log(`SplitCart AI Backend live on http://localhost:${ENV.PORT}`);
    console.log(`Health check: http://localhost:${ENV.PORT}/api/health`);
  });
}

if (require.main === module) {
  startServer();
}
