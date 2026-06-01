/**
 * Smart Budget Pro — Backend Server (Security Hardened)
 * Stack: Node.js + Express + Supabase
 * Patches: Rate limiting, CORS, Input sanitisation,
 *          PayFast IP whitelist, HTTPS redirect, Signature verify
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const crypto    = require("crypto");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ════════════════════════════════════════════
//  PATCH 1 — HTTPS REDIRECT (production only)
// ════════════════════════════════════════════
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(301, "https://" + req.headers.host + req.url);
  }
  next();
});

// ════════════════════════════════════════════
//  PATCH 2 — CORS RESTRICTION
// ════════════════════════════════════════════
const ALLOWED_ORIGINS = [
  "https://teddy-williams.github.io",
  "https://smartbudgetpro.co.za",       // add your domain here when purchased
  "https://www.smartbudgetpro.co.za",
  "http://localhost:5500",              // local dev
  "http://127.0.0.1:5500",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked: ${origin}`);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "10kb" })); // limit body size
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ════════════════════════════════════════════
//  PATCH 3 — RATE LIMITING
// ════════════════════════════════════════════
// General API limiter — 100 requests per 15 min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again later." },
});

// Strict limiter for auth endpoints — 10 per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please wait before trying again." },
});

// Webhook limiter — only PayFast should be hitting this
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: "Too many webhook requests." },
});

app.use("/api/", apiLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/status", authLimiter);
app.use("/api/payfast/webhook", webhookLimiter);

// ════════════════════════════════════════════
//  PATCH 4 — INPUT SANITISATION HELPER
// ════════════════════════════════════════════
function sanitiseName(name) {
  if (!name || typeof name !== "string") return null;
  return name.replace(/<[^>]*>/g, "").replace(/['"`;]/g, "").trim().slice(0, 60);
}

function sanitiseEmail(email) {
  if (!email || typeof email !== "string") return null;
  const clean = email.toLowerCase().trim().slice(0, 100);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean) ? clean : null;
}

// ════════════════════════════════════════════
//  PATCH 5 — PAYFAST IP WHITELIST
// ════════════════════════════════════════════
// Official PayFast server IPs (from their documentation)
const PAYFAST_IPS = [
  "197.97.145.144",
  "197.97.145.145",
  "197.97.145.146",
  "197.97.145.147",
  "41.74.179.194",
];

function verifyPayfastIP(req, res, next) {
  // Skip IP check in sandbox/dev mode
  if (process.env.NODE_ENV !== "production") return next();

  const raw     = req.ip || req.connection.remoteAddress || "";
  const cleanIP = raw.replace("::ffff:", "").trim();

  if (!PAYFAST_IPS.includes(cleanIP)) {
    console.warn(`⚠️  Blocked webhook attempt from unknown IP: ${cleanIP}`);
    return res.status(403).json({ error: "Forbidden — unrecognised source IP" });
  }
  next();
}

// ════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════

/**
 * POST /api/auth/signup
 * Register new user + start 14-day trial
 */
app.post("/api/auth/signup", async (req, res) => {
  // Sanitise inputs
  const name  = sanitiseName(req.body.name);
  const email = sanitiseEmail(req.body.email);

  if (!name)  return res.status(400).json({ error: "Invalid name provided" });
  if (!email) return res.status(400).json({ error: "Invalid email address" });

  // Check if user already exists
  const { data: existing } = await supabase
    .from("users")
    .select("id, email, tier, trial_end")
    .eq("email", email)
    .single();

  if (existing) {
    // Return existing user — don't create duplicate
    const daysLeft = existing.trial_end
      ? Math.max(0, Math.ceil((new Date(existing.trial_end) - new Date()) / (1000 * 60 * 60 * 24)))
      : 0;
    return res.json({ user: { ...existing, daysLeft }, existing: true });
  }

  // Create in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });
  if (authError) return res.status(400).json({ error: authError.message });

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  const { error: dbError } = await supabase.from("users").insert({
    id:          authData.user.id,
    name,
    email,
    tier:        "trial",
    trial_start: new Date().toISOString(),
    trial_end:   trialEnd.toISOString(),
    created_at:  new Date().toISOString(),
  });

  if (dbError) return res.status(500).json({ error: dbError.message });

  res.json({
    success: true,
    user: { id: authData.user.id, name, email, tier: "trial", trial_end: trialEnd, daysLeft: 14 },
  });
});

/**
 * GET /api/auth/status?email=xxx
 * Returns current tier — used for multi-device sync
 */
app.get("/api/auth/status", async (req, res) => {
  const email = sanitiseEmail(req.query.email);
  if (!email) return res.status(400).json({ error: "Invalid email" });

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) return res.status(404).json({ error: "User not found" });

  // Auto-expire trial
  let tier = data.tier;
  if (tier === "trial" && new Date(data.trial_end) < new Date()) {
    tier = "expired";
    await supabase.from("users").update({ tier: "expired" }).eq("email", email);
  }

  const daysLeft = tier === "trial"
    ? Math.max(0, Math.ceil((new Date(data.trial_end) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  res.json({ tier, daysLeft, name: data.name, email: data.email, trial_end: data.trial_end });
});

// ════════════════════════════════════════════
//  PAYFAST ROUTES
// ════════════════════════════════════════════

/**
 * POST /api/payfast/initiate
 * Generate PayFast subscription payment params
 */
app.post("/api/payfast/initiate", async (req, res) => {
  const email = sanitiseEmail(req.body.email);
  const name  = sanitiseName(req.body.name);
  if (!email) return res.status(400).json({ error: "Invalid email" });

  const paymentId  = `SBP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const today      = new Date();
  const billingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const params = {
    merchant_id:       process.env.PAYFAST_MERCHANT_ID,
    merchant_key:      process.env.PAYFAST_MERCHANT_KEY,
    return_url:        `${process.env.FRONTEND_URL}/app.html?status=success`,
    cancel_url:        `${process.env.FRONTEND_URL}/app.html?status=cancelled`,
    notify_url:        `${process.env.BACKEND_URL}/api/payfast/webhook`,
    name_first:        name?.split(" ")[0] || "User",
    name_last:         name?.split(" ").slice(1).join(" ") || "",
    email_address:     email,
    m_payment_id:      paymentId,
    amount:            "50.00",
    item_name:         "Smart Budget Pro Premium",
    item_description:  "Monthly subscription",
    subscription_type: "1",
    billing_date:      billingDate,
    recurring_amount:  "50.00",
    frequency:         "3",
    cycles:            "0",
  };

  const pfString  = Object.keys(params)
    .map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, "+")}`)
    .join("&");
  const signature = crypto
    .createHash("md5")
    .update(pfString + `&passphrase=${process.env.PAYFAST_PASSPHRASE}`)
    .digest("hex");

  await supabase.from("payments").insert({
    payment_id: paymentId, email, status: "pending",
    amount: 50.00, created_at: new Date().toISOString(),
  });

  const isSandbox = process.env.NODE_ENV !== "production";
  const payUrl = isSandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  res.json({ payUrl, params: { ...params, signature } });
});

/**
 * POST /api/payfast/webhook
 * PayFast ITN — verified by IP + MD5 signature
 */
app.post("/api/payfast/webhook", verifyPayfastIP, async (req, res) => {
  const data = req.body;

  // ── PATCH: Verify MD5 signature ──
  const pfData = { ...data };
  delete pfData.signature;
  const pfString = Object.keys(pfData)
    .map(k => `${k}=${encodeURIComponent(pfData[k]).replace(/%20/g, "+")}`)
    .join("&");
  const expectedSig = crypto
    .createHash("md5")
    .update(pfString + `&passphrase=${process.env.PAYFAST_PASSPHRASE}`)
    .digest("hex");

  if (expectedSig !== data.signature) {
    console.error("⚠️  PayFast: Invalid signature — possible spoofing attempt");
    return res.status(400).send("Invalid signature");
  }

  const { payment_status, email_address, m_payment_id, amount_gross } = data;
  const email = sanitiseEmail(email_address);
  if (!email) return res.status(400).send("Invalid email in payload");

  if (payment_status === "COMPLETE") {
    await supabase.from("users").update({
      tier:               "premium",
      premium_since:      new Date().toISOString(),
      payfast_payment_id: m_payment_id,
    }).eq("email", email);

    await supabase.from("payments").insert({
      payment_id:   m_payment_id, email,
      status:       "complete",
      amount:       parseFloat(amount_gross),
      completed_at: new Date().toISOString(),
    });

    console.log(`✅ Payment complete — ${email} upgraded to Premium`);
  }

  if (payment_status === "CANCELLED") {
    await supabase.from("users").update({ tier: "expired" }).eq("email", email);
    await supabase.from("payments").upsert({
      payment_id: m_payment_id, email, status: "cancelled",
      amount: parseFloat(amount_gross),
    });
    console.log(`❌ Subscription cancelled — ${email}`);
  }

  res.status(200).send("OK");
});

/**
 * POST /api/payfast/cancel
 */
app.post("/api/payfast/cancel", async (req, res) => {
  const email = sanitiseEmail(req.body.email);
  if (!email) return res.status(400).json({ error: "Invalid email" });
  await supabase.from("users").update({ tier: "cancelled" }).eq("email", email);
  res.json({ success: true, message: "Subscription cancelled." });
});

// ════════════════════════════════════════════
//  CLOUD DATA SYNC (Premium)
// ════════════════════════════════════════════
async function verifyPremium(req, res, next) {
  const email = sanitiseEmail(req.body?.email || req.query?.email);
  if (!email) return res.status(401).json({ error: "Unauthorized" });
  const { data } = await supabase.from("users").select("tier").eq("email", email).single();
  if (!data || !["premium", "trial"].includes(data.tier)) {
    return res.status(403).json({ error: "Premium subscription required" });
  }
  next();
}

app.post("/api/data/save", verifyPremium, async (req, res) => {
  const email = sanitiseEmail(req.body.email);
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: "No data provided" });
  const { error } = await supabase.from("budget_data").upsert({
    email, data: JSON.stringify(data), updated_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/data/load", verifyPremium, async (req, res) => {
  const email = sanitiseEmail(req.query.email);
  const { data, error } = await supabase
    .from("budget_data").select("data, updated_at").eq("email", email).single();
  if (error) return res.status(404).json({ error: "No data found" });
  res.json({ data: JSON.parse(data.data), updated_at: data.updated_at });
});

// ── Health check ──
app.get("/health", (req, res) => res.json({
  status: "ok",
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || "development",
}));

// ── 404 handler ──
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  if (err.message.includes("CORS")) return res.status(403).json({ error: err.message });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => console.log(`🚀 Smart Budget Pro API on port ${PORT} [${process.env.NODE_ENV || "development"}]`));
module.exports = app;
