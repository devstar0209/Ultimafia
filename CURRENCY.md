# 💖 Currency Guide: Red Hearts & Gold Hearts

**Last Updated:** April 24, 2026

---

## 📋 Quick Overview

### Currency Types

| Currency | Type | Max/Day | Source | Use |
|----------|------|---------|--------|-----|
| **Red Hearts** ❤️ | Soft/Limited | 10 | Gameplay, Shop | Game mechanics |
| **Gold Hearts** 💛 | Premium | Unlimited | Real-money | Competitive entry, Premium features |
| **Coins** 🪙 | Soft/Unlimited | Unlimited | Gameplay, Achievements | Shop cosmetics, Bonuses |

---

## 🎯 Red Hearts

### How to Get Red Hearts

#### 1. **Gameplay Rewards** (Automatic)
- Earn red hearts by participating in games
- Amount varies by game type and performance
- Limited to **10 per day** by default
- Resets daily at UTC midnight

#### 2. **Expand Capacity via Shop**
- Purchase **"Bonus Red Hearts"** cosmetic for **10 coins**
- Each purchase increases capacity by 1
- Maximum expandable capacity: **5 additional hearts** (15 total)
- **Purchase Location:** `routes/shop.js`

```javascript
{
  name: "Bonus Red Hearts",
  desc: "Increases the amount of red hearts that you can hold.",
  key: "bonusRedHearts",
  price: 10 coins,
  limit: 5,  // Buy max 5 times
  onBuy: increment redHearts by 1
}
```

### How to Use Red Hearts

- **Primary Use:** Unknown game-specific mechanic (appears to be tracked but not fully documented)
- **Status:** Limited daily quota suggests time-gate on some feature
- **Capacity Management:** Manage daily limit to avoid waste

### How to Waste/Spend Red Hearts

- Red hearts are consumed by the game mechanic they enable
- Daily limit means unused hearts beyond capacity are lost
- No explicit "spend" endpoint (automatic consumption)

### Database Schema

```javascript
// User schema
redHearts: {
  type: Number,
  default: 0,
  max: 10  // Daily limit before bonuses
},
bonusRedHearts: {
  type: Number,
  default: 0
}

// Max total capacity = 10 + bonusRedHearts (up to 5)
```

---

## 💛 Gold Hearts

### How to Get Gold Hearts

#### 1. **Real-Money Purchase** (Planned Implementation)
- Purchase via in-app shop with real money
- Payment processor: Braintree (or configured provider)
- Pricing structure (suggested):
  ```
  Not yet implemented - awaiting monetization setup
  ```

#### 2. **Promotional/Seasonal Bonuses**
- Special events may award gold hearts
- Seasonal promotions
- Beta tester rewards

### How to Use Gold Hearts

#### Current Uses:
- **Competitive Game Entry:** Pay gold hearts to enter ranked/competitive queues
- **Premium Features:** Unlock exclusive game modes or cosmetics
- **Battle Pass:** Seasonal battle pass access

#### Planned Uses:
- Premium cosmetics purchase
- Competitive tournament entry
- Exclusive event access
- Pass seasons/battle passes

### How to Waste/Spend Gold Hearts

#### Spending Methods:
1. **Competitive Entry Fees**
   ```
   Per competitive game: Variable cost (TBD)
   Tournament entry: 50-200 gold hearts
   ```

2. **Feature Unlocks**
   - Unlock premium cosmetics
   - One-time purchases or recurring subscriptions

#### No Refunds Policy:
- Gold heart purchases are final
- Competitive entry fees are non-refundable
- Always confirm before spending premium currency

### Database Schema

```javascript
// User schema
goldHearts: {
  type: Number,
  default: 0,
  min: 0
  // No max - unlimited capacity
}
```

---

## 💸 Withdrawal & Conversion

### Coin Withdrawal

**Status:** Not Implemented

#### Proposed System (Future):
- **No direct cash-out:** Coins cannot be converted to real money
- **Why:** Soft currency designed for gameplay, not income
- **Alternative:** Use Coins only for cosmetics in shop

### Gold Heart Conversion

**Status:** One-way only

#### Rules:
- **Cannot buy coins with gold hearts** (premium → soft not allowed)
- **Can buy coins with real money** → get gold hearts
- **Gold hearts expire seasonally** (if battle pass system implemented)

### Coin to Premium Conversion

**Status:** Not allowed

#### Why:
- Prevents economy inflation
- Maintains monetization model
- Keeps premium currency exclusive

---

## 📊 Balance & Spending Limits

### Daily Red Hearts

```
Base capacity:     10 hearts/day
+ Bonuses:         Up to 5 additional
Maximum:           15 hearts/day

Reset:             UTC midnight daily
Carryover:         No (unused = lost)
```

### Gold Hearts

```
Capacity:          Unlimited
Reset:             Seasonal (if applicable)
Expiration:        Set per promotion/season
Carryover:         Policy TBD
```

---

## 🔄 API Endpoints

### Red Hearts

**GET `/api/user/redhearts`**
```json
{
  "redHearts": 8,
  "bonusRedHearts": 2,
  "maxCapacity": 12,
  "dailyReset": "2026-04-25T00:00:00Z"
}
```

**POST `/api/user/redhearts/spend`** (Internal)
```json
{
  "amount": 1,
  "reason": "game-use"
}
```

### Gold Hearts

**GET `/api/user/goldhearts`**
```json
{
  "goldHearts": 50,
  "pendingRefund": 0,
  "lastUpdated": "2026-04-24T12:00:00Z"
}
```

**POST `/api/user/goldhearts/spend`** (For competitive entry)
```json
{
  "amount": 25,
  "reason": "competitive-entry",
  "gameId": "xyz123"
}
```

---

## ⚠️ Important Notes

### Red Hearts
- ❌ Cannot be purchased directly with coins
- ✅ Only expandable via "Bonus Red Hearts" shop item (10 coins each)
- ⏰ Daily limit resets at midnight UTC
- 🔄 No rollover - unused hearts are lost

### Gold Hearts
- 💰 Premium currency (real-money purchase)
- ❌ Cannot be sold/traded to other players
- ❌ Cannot be converted back to cash
- 📅 May expire per season (TBD)

### Coins
- ✅ Can buy cosmetics and bonuses
- ❌ Cannot withdraw as real money
- ✅ Earn from gameplay indefinitely
- ♻️ No spending limit

---

## 🚀 Future Roadmap

### Phase 1: Red Hearts Clarification
- [ ] Document exact game mechanic
- [ ] Confirm daily reset timing
- [ ] Test capacity expansion

### Phase 2: Gold Hearts Launch
- [ ] Implement real-money purchase system
- [ ] Set pricing tiers
- [ ] Configure Braintree integration

### Phase 3: Premium Features
- [ ] Create gold heart spending endpoints
- [ ] Implement battle pass system
- [ ] Add seasonal expiration logic

---

## 📞 Support

For currency issues:
- **Red hearts not resetting?** Check user profile refresh time
- **Gold hearts missing?** Verify payment receipt in database
- **Can't spend?** Ensure sufficient balance before transaction
