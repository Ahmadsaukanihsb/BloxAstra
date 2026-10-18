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
 *  Boot persistence (Windows has no `pm2 startup`): Scheduled Task
 *  "BloxAstraPM2" menjalankan C:\Users\Administrator\BloxAstraPm2Boot.ps1 saat
 *  logon DESKTOP-I28MNTR\Administrator (interactive, delay 30s). Log hasilnya:
 *  logs\pm2-boot.log.
 *
 *  Watchdog: Scheduled Task "BloxAstraPM2Watchdog" menjalankan
 *  C:\Users\Administrator\BloxAstraPm2Watchdog.ps1 tiap 5 menit — memeriksa
 *  ketiga app masih online di pm2, memeriksa 127.0.0.1:3132 dan bloxastra.com,
 *  lalu memulihkannya sendiri (start app yang hilang / restart app atau tunnel
 *  yang tidak menjawab). Log: logs\pm2-watchdog.log.
 *
 *  Task itu WAJIB login sebagai Administrator di sesi interaktif. Versi lama
 *  memakai boot trigger sebagai SYSTEM: daemon pm2-nya hidup di sesi lain,
 *  jadi `pm2 ls` di terminal tampak kosong setelah reboot padahal dump.pm2
 *  masih berisi kedua app. Jangan tambahkan autostart kedua untuk app yang
 *  sama (task/logon-script yang menjalankan `next start` atau cloudflared
 *  sendiri) — dua pengelola akan berebut port 3132.
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
      // Self-hosted WhatsApp OTP sender (Baileys). Loopback-only HTTP on
      // 127.0.0.1:3140; the web app posts to it with WA_BOT_TOKEN.
      // One-time setup: `pm2 logs bloxastra-wa` shows a QR to scan with the
      // dedicated bot number. Session lives in wa-bot/auth (never committed).
      name: "bloxastra-wa",
      cwd: ROOT,
      script: "wa-bot\\bot.mjs",
      autorestart: true,
      max_restarts: 30,
      min_uptime: 10000,
      // Give it room to settle the WA handshake before PM2 emails a restart.
      restart_delay: 5000,
      out_file: `${ROOT}\\logs\\wa-out.log`,
      error_file: `${ROOT}\\logs\\wa-err.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: { NODE_ENV: "production", WA_BOT_PORT: "3140" },
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
