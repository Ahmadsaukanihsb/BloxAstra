/**
 * BloxAstra production process set (this PC is the server).
 *
 *  Usage:
 *    npm i -g pm2
 *    pm2 start ecosystem.config.js
 *    pm2 save
 *    pm2 logs            # tail both processes
 *    pm2 restart all     # after a new `npm run build`
 *
 *  Boot persistence (Windows has no `pm2 startup`): create ONE Scheduled Task
 *  "At startup" (run as Administrator, whether logged on or not) that runs:
 *    pm2 resurrect
 *  in C:\Users\Administrator\Desktop\test\BloxAstra
 *
 *  Ports: web = 3132 (tunnel ingress), dev server stays on 3000.
 */
const ROOT = "C:\\Users\\Administrator\\Desktop\\test\\BloxAstra";

module.exports = {
  apps: [
    {
      name: "bloxastra-web",
      cwd: ROOT,
      script: "node_modules\\next\\dist\\bin\\next",
      args: "start -p 3132",
      autorestart: true,
      max_restarts: 30,
      min_uptime: 10000,
      out_file: `${ROOT}\\logs\\web-out.log`,
      error_file: `${ROOT}\\logs\\web-err.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: { NODE_ENV: "production", PORT: "3132" },
    },
    {
      name: "bloxastra-tunnel",
      // Single tunnel only — the "bloxastra" tunnel whose ingress serves
      // bloxastra.com + www.bloxastra.com → 127.0.0.1:3132.
      // (The legacy config.yml tunnel stays OFF so the two never fight.)
      script: "C:\\Users\\Administrator\\.cloudflared\\cloudflared.exe",
      args: "tunnel --config C:\\Users\\Administrator\\.cloudflared\\config-bloxastra.yml run bloxastra",
      autorestart: true,
      max_restarts: 30,
      min_uptime: 10000,
      out_file: `${ROOT}\\logs\\tunnel-out.log`,
      error_file: `${ROOT}\\logs\\tunnel-err.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
