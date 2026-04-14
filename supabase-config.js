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

// ── Hugging Face API (AI image generation — FREE) ─────
// 1. Go to huggingface.co
// 2. Click your profile avatar (top-right) → Settings → Access Tokens
// 3. Click "New token", name it anything, choose "Read" role, click Create
// 4. Copy the token (starts with hf_...) and paste below
//
// This is the SHARED key used when a user doesn't enter their own.
// Leave as "" to require users to bring their own key.
// Note: key is visible in deployed JS — fine for private groups.
const HF_API_KEY = "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";  // e.g. "hf_aBcDeFgHiJ..."

// ── VAPID Public Key (Web Push notifications) ─────────
// See SETUP.md for instructions. Leave blank to disable push.
const VAPID_PUBLIC_KEY = "BCIiOFPx02FHVO7dB_MS4SnrKGoThyKrnrKCxtQBL_fqk-EVb4DXMiJA47Gzn5IuaX8H-thvnlUUbtS08DZ27bk";
