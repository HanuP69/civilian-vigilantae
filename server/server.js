import app from './src/app.js';
import config from './src/config/env.js';

app.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   CITIZEN-VIGILANTAE  API  SERVER            ║
  ║   Port : ${String(config.port).padEnd(35)}║
  ║   Env  : ${config.nodeEnv.padEnd(35)}║
  ║   CORS : ${config.clientUrl.padEnd(35)}║
  ╚══════════════════════════════════════════════╝
  `);
});
