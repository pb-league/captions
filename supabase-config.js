// ═══════════════════════════════════════════════════════
//  CAPTION CLASH — Configuration
//  Fill in your values, then deploy.
//  DO NOT commit this file with real secrets to a public repo.
// ═══════════════════════════════════════════════════════

// ── Supabase ─────────────────────────────────────────

const SUPABASE_URL      = "https://fvkyomenudruyukqnjak.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xc5tUcgfnRrVtoKizSYFjg_irjTwwt2";

// ── Admin ─────────────────────────────────────────────
const ADMIN_PASSWORD = "caption2024";  // change this!

// ── Anthropic API (AI image generation) ──────────────
// Leave blank to require users to bring their own key.
const ANTHROPIC_API_KEY = "";

// ── VAPID Public Key (Web Push notifications) ─────────
// Generate a VAPID key pair:
//   npx web-push generate-vapid-keys
// Then set the private key as a Supabase secret:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
// Paste ONLY the public key here — the private key lives server-side only.
const VAPID_PUBLIC_KEY = "BCIiOFPx02FHVO7dB_MS4SnrKGoThyKrnrKCxtQBL_fqk-EVb4DXMiJA47Gzn5IuaX8H-thvnlUUbtS08DZ27bk";  // e.g. "BNtWp5_abc123..."
