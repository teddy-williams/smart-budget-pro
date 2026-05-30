# 💼 Smart Budget Pro

> South Africa's smartest personal finance app — budget tracking, goal management, career planning, and smart reminders in one place. Built for Cape Town. Powered by PayFast.

![Version](https://img.shields.io/badge/version-3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PayFast](https://img.shields.io/badge/payments-PayFast-orange)
![Supabase](https://img.shields.io/badge/database-Supabase-3ECF8E)

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

## 🔒 Security

- All PayFast webhooks verified via MD5 signature
- Supabase Row Level Security (RLS) enabled on all tables
- Environment variables never committed to Git
- HTTPS enforced on all endpoints
- No sensitive data stored in localStorage (only tier status)
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

