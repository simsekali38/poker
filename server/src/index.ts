import { createApp } from './app.js';
import { formatCorsOriginsForLog, parseCorsOrigins } from './cors-config.js';
import { env } from './config/env.js';

const app = createApp();
app.listen(env.PORT, () => {
  const corsParsed = parseCorsOrigins(env);
  console.log(`poker-planning-server listening on :${env.PORT}`);
  console.log(`CORS allowed origins: ${formatCorsOriginsForLog(corsParsed)}`);
});
