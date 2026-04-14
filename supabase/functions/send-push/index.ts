// supabase/functions/send-push/index.ts
// Supabase Edge Function — sends Web Push notifications to subscribers
//
// Deploy:   supabase functions deploy send-push
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── base64url helpers ─────────────────────────────────────────────────────────
function b64uDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function b64uEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Build VAPID Authorization header (ES256 JWT) ─────────────────────────────
async function vapidAuth(endpoint: string, pubKey: string, privKeyB64: string, subject: string) {
  const { protocol, host } = new URL(endpoint);
  const aud = `${protocol}//${host}`;
  const exp = Math.floor(Date.now() / 1000) + 43200;

  const hdr = b64uEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pay = b64uEncode(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: subject })));
  const msg = new TextEncoder().encode(`${hdr}.${pay}`);

  // Import raw EC private key for signing
  const rawPriv = b64uDecode(privKeyB64);
  // We need the key as JWK — derive from raw using a fixed approach
  const privJwk = {
    kty: "EC", crv: "P-256", d: privKeyB64,
    x: pubKey.slice(0, 43), y: pubKey.slice(43),  // rough split for P-256
    key_ops: ["sign"],
  };
  let signingKey: CryptoKey;
  try {
    signingKey = await crypto.subtle.importKey(
      "jwk", privJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["sign"]
    );
  } catch {
    // Fallback: try pkcs8 import
    const pkcs8 = new Uint8Array([
      0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13,
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
      0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
      ...rawPriv
    ]);
    signingKey = await crypto.subtle.importKey(
      "pkcs8", pkcs8,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["sign"]
    );
  }

  const sig    = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, msg);
  const token  = `${hdr}.${pay}.${b64uEncode(new Uint8Array(sig))}`;
  return `vapid t=${token},k=${pubKey}`;
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const VAPID_PUB  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
  const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const VAPID_SUB  = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:admin@example.com";
  const SB_URL     = Deno.env.get("SUPABASE_URL")      ?? "";
  const SB_SRV     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!VAPID_PUB || !VAPID_PRIV) {
    return new Response(JSON.stringify({ error: "VAPID keys not set" }), { status: 500, headers: cors });
  }

  const sb = createClient(SB_URL, SB_SRV);
  let body: any;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { event, contest_id, caption_id, target_emails, title, message } = body;

  const prefCol: Record<string, string> = {
    results:     "notify_results",
    voting:      "notify_voting",
    new_contest: "notify_new_contest",
    flagged:     "notify_flagged",
  };

  let q = sb.from("push_subscriptions").select("id,email,subscription");
  if (target_emails?.length) q = q.in("email", target_emails);
  const pc = prefCol[event];
  if (pc) q = (q as any).eq(pc, true);

  const { data: subs, error: subErr } = await q;
  if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: cors });
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: cors });

  const payload = JSON.stringify({
    title: title ?? "CaptionClash ⚡",
    body:  message ?? "Check the contest!",
    icon:  "/icons/icon-192.png",
    data:  { contest_id, caption_id, event, url: "/" },
  });
  const payloadBytes = new TextEncoder().encode(payload);

  let sent = 0, failed = 0;
  const expired: string[] = [];

  await Promise.allSettled(subs.map(async (sub) => {
    const ep = sub.subscription?.endpoint;
    if (!ep) return;
    try {
      const authHeader = await vapidAuth(ep, VAPID_PUB, VAPID_PRIV, VAPID_SUB);
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/octet-stream", "TTL": "86400" },
        body: payloadBytes,
      });
      if (r.status === 410 || r.status === 404) expired.push(sub.id);
      else if (r.ok || r.status === 201) sent++;
      else failed++;
    } catch { failed++; }
  }));

  if (expired.length) await sb.from("push_subscriptions").delete().in("id", expired);

  return new Response(JSON.stringify({ sent, failed, expired: expired.length }), { headers: { ...cors, "Content-Type": "application/json" } });
});
