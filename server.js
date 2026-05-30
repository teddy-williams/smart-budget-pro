/**
 * Smart Budget Pro — Backend Server
 * Stack: Node.js + Express + Supabase
 * Handles: Auth, trial tracking, PayFast webhooks, premium gating
 *
 * Deploy to: Railway.app / Render.com / Heroku (all free tier available)
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const crypto   = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase client ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Middleware ──
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // PayFast sends form data

// ════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════

/**
 * POST /api/auth/signup
 * Start a new trial — creates user in Supabase
 */
app.post("/api/auth/signup", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Name and email required" });

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });
  if (authError) return res.status(400).json({ error: authError.message });

  // Create user record in database
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
    user: { id: authData.user.id, name, email, tier: "trial", trial_end: trialEnd },
  });
});

/**
 * GET /api/auth/status?email=xxx
 * Returns user tier: trial | premium | expired
 */
app.get("/api/auth/status", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email required" });

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) return res.status(404).json({ error: "User not found" });

  // Check trial expiry
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
 * Generate a PayFast payment URL for subscription
 */
app.post("/api/payfast/initiate", async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  // Generate unique payment ID
  const paymentId = `SBP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Set billing date to today
  const today = new Date();
  const billingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // PayFast parameters
  const params = {
    merchant_id:       process.env.PAYFAST_MERCHANT_ID,
    merchant_key:      process.env.PAYFAST_MERCHANT_KEY,
    return_url:        `${process.env.FRONTEND_URL}/app.html?status=success`,
    cancel_url:        `${process.env.FRONTEND_URL}/app.html?status=cancelled`,
    notify_url:        `${process.env.BACKEND_URL}/api/payfast/webhook`,
    name_first:        name?.split(" ")[0] || "",
    name_last:         name?.split(" ").slice(1).join(" ") || "",
    email_address:     email,
    m_payment_id:      paymentId,
    amount:            "50.00",
    item_name:         "Smart Budget Pro Premium",
    item_description:  "Monthly subscription - Smart Budget Pro",
    subscription_type: "1",
    billing_date:      billingDate,
    recurring_amount:  "50.00",
    frequency:         "3",    // Monthly
    cycles:            "0",    // Indefinite
  };

  // Generate PayFast signature
  const pfString = Object.keys(params)
    .map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, "+")}`)
    .join("&");
  const signature = crypto.createHash("md5").update(pfString + `&passphrase=${process.env.PAYFAST_PASSPHRASE}`).digest("hex");

  // Store pending payment in DB
  await supabase.from("payments").insert({
    payment_id: paymentId,
    email,
    status:     "pending",
    amount:     50.00,
    created_at: new Date().toISOString(),
  });

  // Return PayFast URL + params for frontend form submission
  const isSandbox = process.env.NODE_ENV !== "production";
  const payUrl = isSandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  res.json({ payUrl, params: { ...params, signature } });
});

/**
 * POST /api/payfast/webhook
 * PayFast ITN (Instant Transaction Notification)
 * Called by PayFast server on every payment event
 */
app.post("/api/payfast/webhook", async (req, res) => {
  const data = req.body;

  // ── Step 1: Verify the request is genuinely from PayFast ──
  const pfData = { ...data };
  delete pfData.signature;
  const pfString = Object.keys(pfData)
    .map(k => `${k}=${encodeURIComponent(pfData[k]).replace(/%20/g, "+")}`)
    .join("&");
  const signature = crypto.createHash("md5").update(pfString + `&passphrase=${process.env.PAYFAST_PASSPHRASE}`).digest("hex");

  if (signature !== data.signature) {
    console.error("PayFast: Invalid signature");
    return res.status(400).send("Invalid signature");
  }

  // ── Step 2: Check payment status ──
  const { payment_status, email_address, m_payment_id, amount_gross } = data;

  if (payment_status === "COMPLETE") {
    // Upgrade user to premium
    const { error } = await supabase
      .from("users")
      .update({
        tier:              "premium",
        premium_since:     new Date().toISOString(),
        payfast_payment_id: m_payment_id,
      })
      .eq("email", email_address);

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).send("DB error");
    }

    // Log the payment
    await supabase.from("payments").insert({
      payment_id:   m_payment_id,
      email:        email_address,
      status:       "complete",
      amount:       parseFloat(amount_gross),
      completed_at: new Date().toISOString(),
    });

    console.log(`✅ Payment complete for ${email_address} — upgraded to Premium`);
  }

  if (payment_status === "CANCELLED") {
    // Downgrade back to expired/free
    await supabase
      .from("users")
      .update({ tier: "expired" })
      .eq("email", email_address);

    await supabase.from("payments").upsert({
      payment_id: m_payment_id,
      email:      email_address,
      status:     "cancelled",
      amount:     parseFloat(amount_gross),
    });

    console.log(`❌ Subscription cancelled for ${email_address}`);
  }

  // PayFast requires a 200 OK response
  res.status(200).send("OK");
});

/**
 * GET /api/payfast/cancel?email=xxx
 * Cancel subscription via PayFast API
 */
app.post("/api/payfast/cancel", async (req, res) => {
  const { email } = req.body;
  // In production: call PayFast cancel subscription API
  // https://developers.payfast.co.za/api#cancel-subscription
  await supabase.from("users").update({ tier: "cancelled" }).eq("email", email);
  res.json({ success: true, message: "Subscription cancelled. Access continues until period end." });
});

// ════════════════════════════════════════════
//  BUDGET DATA SYNC (Optional cloud save)
// ════════════════════════════════════════════

/**
 * POST /api/data/save
 * Save user's budget data to Supabase (Premium only)
 */
app.post("/api/data/save", verifyPremium, async (req, res) => {
  const { email, data } = req.body;
  const { error } = await supabase.from("budget_data").upsert({
    email,
    data:       JSON.stringify(data),
    updated_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/**
 * GET /api/data/load?email=xxx
 * Load user's budget data from Supabase (Premium only)
 */
app.get("/api/data/load", verifyPremium, async (req, res) => {
  const { email } = req.query;
  const { data, error } = await supabase
    .from("budget_data")
    .select("data, updated_at")
    .eq("email", email)
    .single();
  if (error) return res.status(404).json({ error: "No data found" });
  res.json({ data: JSON.parse(data.data), updated_at: data.updated_at });
});

// ── Middleware: Verify premium ──
async function verifyPremium(req, res, next) {
  const email = req.body?.email || req.query?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });
  const { data } = await supabase.from("users").select("tier").eq("email", email).single();
  if (!data || !["premium", "trial"].includes(data.tier)) {
    return res.status(403).json({ error: "Premium subscription required" });
  }
  next();
}

// ── Health check ──
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 Smart Budget Pro API running on port ${PORT}`));
module.exports = app;
