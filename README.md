# 💼 Smart Budget Pro

> South Africa's smartest personal finance app — budget tracking, goal management, career planning, and smart reminders in one place. Built for Cape Town. Powered by PayFast.

![Version](https://img.shields.io/badge/version-3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PayFast](https://img.shields.io/badge/payments-PayFast-orange)
![Supabase](https://img.shields.io/badge/database-Supabase-3ECF8E)

---

## 🚀 Live

| Resource | URL |
|----------|-----|
| Landing Page | `https://yourdomain.co.za` |
| App | `https://yourdomain.co.za/app.html` |
| API | `https://api.yourdomain.co.za` |

---

## 💰 Pricing Model

| Tier | Cost | Duration | Access |
|------|------|----------|--------|
| Free | R0 | Forever | Basic goals + budget |
| Trial | R0 | 14 days | Full Premium |
| Premium | R50/month | Recurring | Full Premium |

**Payment Methods via PayFast:**
- 💳 Visa / Mastercard
- 🏦 EFT / Instant EFT
- 📱 SnapScan
- 💰 Ozow
- 📲 Mobicred

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Landing Page  │────▶│   Budget App     │────▶│   Node.js API   │
│   index.html    │     │   app.html       │     │   server.js     │
│   GitHub Pages  │     │   GitHub Pages   │     │   Railway.app   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                              ┌────────────────────────────┤
                              │                            │
                    ┌─────────▼──────┐         ┌──────────▼──────┐
                    │   Supabase     │         │    PayFast      │
                    │   Auth + DB    │         │  Subscriptions  │
                    │   (Free tier)  │         │   Webhooks      │
                    └────────────────┘         └─────────────────┘
```

### Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | HTML5, CSS3, Vanilla JS | Free |
| Charts | Chart.js | Free |
| Hosting | GitHub Pages | Free |
| Backend | Node.js + Express | Free (Railway) |
| Database | Supabase (Postgres) | Free tier |
| Auth | Supabase Auth | Free tier |
| Payments | PayFast | 3.5% per transaction |

**Total infrastructure cost: ~R0/month** until you scale.

---

## 📁 Project Structure

```
smart-budget-pro/
├── index.html          # Landing page + pricing
├── app.html            # Full budget app (with premium gating)
├── server.js           # Node.js API (PayFast + Supabase)
├── package.json        # Backend dependencies
├── supabase-schema.sql # Database tables + RLS policies
├── .env.example        # Environment variable template
├── .gitignore          # Never commit .env!
└── README.md
```

---

## 🚀 Deployment Guide

### Step 1 — Set up Supabase (Database + Auth)

1. Go to [supabase.com](https://supabase.com) → Create a free project
2. Go to **SQL Editor** → paste and run `supabase-schema.sql`
3. Go to **Project Settings → API** → copy your `URL` and `service_role` key
4. Save these for your `.env` file

### Step 2 — Set up PayFast

1. Register at [payfast.co.za](https://www.payfast.co.za/registration)
2. Complete merchant verification (takes 1–2 business days)
3. Get your **Merchant ID**, **Merchant Key**, and set a **Passphrase**
4. Use **Sandbox** credentials for testing first: [sandbox.payfast.co.za](https://sandbox.payfast.co.za)

### Step 3 — Deploy the Backend (Railway.app — Free)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Deploy
railway up
```

Set environment variables in Railway dashboard (copy from `.env.example`).

Your API will be live at: `https://your-app.railway.app`

### Step 4 — Deploy Frontend (GitHub Pages)

1. Push all files to your GitHub repo
2. Go to **Settings → Pages → Branch: main → Save**
3. Your landing page: `https://yourusername.github.io/smart-budget-pro`

### Step 5 — Configure PayFast Webhook

In your PayFast merchant dashboard, set:
- **Notify URL**: `https://your-api.railway.app/api/payfast/webhook`
- **Return URL**: `https://yourdomain.co.za/app.html?status=success`
- **Cancel URL**: `https://yourdomain.co.za/app.html?status=cancelled`

---

## 🔒 Security

- All PayFast webhooks verified via MD5 signature
- Supabase Row Level Security (RLS) enabled on all tables
- Environment variables never committed to Git
- HTTPS enforced on all endpoints
- No sensitive data stored in localStorage (only tier status)

---

## 🧪 Testing Payments

Use PayFast sandbox credentials:
```
Merchant ID:  10000100
Merchant Key: 46f0cd694581a
Passphrase:   jt7NOE43FZPn
Test card:    4000000000000002
```

---

## 📊 Premium Features Gating

| Feature | Free | Trial | Premium |
|---------|------|-------|---------|
| Goal Tracker | ✅ | ✅ | ✅ |
| Budget Categories | ✅ | ✅ | ✅ |
| Monthly Mission Planner | ❌ | ✅ | ✅ |
| Smart Reminders | ❌ | ✅ | ✅ |
| 6-Month Roadmap | ❌ | ✅ | ✅ |
| What-If Simulator | ❌ | ✅ | ✅ |
| Career Tracker | ❌ | ✅ | ✅ |
| Cloud Sync | ❌ | ✅ | ✅ |
| Export CSV/JSON | ❌ | ✅ | ✅ |

---

## 🗺️ Roadmap

- [ ] PWA — installable on mobile home screen
- [ ] Dark mode
- [ ] Multi-device cloud sync (Supabase)
- [ ] Bank statement CSV import
- [ ] WhatsApp reminder integration
- [ ] Annual plan (R450/year — save R150)
- [ ] Referral system — 1 free month per referral

---

## 📄 License

MIT — free to use and modify.

---

## 🇿🇦 Built in Cape Town

Made with 💚 for South Africans building their future one rand at a time.
