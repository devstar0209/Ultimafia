# 💰 PassionMafia Coins System: Complete Implementation Guide

**Last Updated:** April 8, 2026  
**Status:** Production-Ready + Expansion Roadmap

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Current Implementation](#current-implementation)
3. [Database Schema](#database-schema)
4. [Coin Earning Mechanics](#coin-earning-mechanics)
5. [Coin Spending (Shop)](#coin-spending-shop)
6. [Integration Guide](#integration-guide)
7. [Expansion Roadmap](#expansion-roadmap)
8. [API Reference](#api-reference)
9. [Monetization Strategy](#monetization-strategy)

---

## System Overview

### What Are Coins?

**Coins** are the primary soft currency in PassionMafia:
- Earned through gameplay, quests, and achievements
- Spent on cosmetics and cosmetic upgrades
- Cannot be purchased directly (yet)
- Account is bound (cannot trade between players)

### Three-Currency Model

```
COINS (Soft)          GOLD HEARTS (Premium)    POINTS (Skill)
Gameplay earned       Real-money purchase      Win-only earned
Shop cosmetics        Competitive entry        Ranked unlock
No reset              Seasonal reset           Never resets
Infinite capacity     Daily quota              Lifetime tracked
```

---

## Current Implementation

### Where Coins Are Used

**Database:** MongoDB
- **Collection:** `users`
- **Field:** `coins` (number, default: 0)

**Files:**
- `db/schemas.js` - User schema definition
- `routes/shop.js` - Shop logic & purchases
- `routes/game.js` - Game rewards
- `routes/user.js` - Profile & balance endpoints
- `models.js` - User model methods

### Frontend Location

**React Components:**
- `react_main/src/pages/Shop/Shop.jsx` - Shop interface
- `react_main/src/components/CoinDisplay.jsx` - Wallet UI
- `react_main/src/pages/Profile/Profile.jsx` - User balance

---

## Database Schema

### User Coins Field

**Location:** `db/schemas.js`

```javascript
coins: {
  type: Number,
  default: 0
}
```

### Extended Schema (Recommended)

```javascript
currencyBalance: {
  coins: {
    type: Number,
    default: 0,
    min: 0
  },
  goldHearts: {
    type: Number,
    default: 0,
    min: 0
  },
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  championshipPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  redHearts: {
    type: Number,
    default: 0,
    min: 0,
    max: 10  // Daily limit
  }
},

// Track spending for analytics
coinSpending: {
  totalSpent: {
    type: Number,
    default: 0
  },
  itemsPurchased: [
    {
      itemId: String,
      amount: Number,
      timestamp: Date,
      category: String  // 'cosmetic', 'profile', 'feature'
    }
  ]
}
```

### User Model Methods

**What Should Exist (or add):**

```javascript
// In db/models.js

User.methods.addCoins = async function(amount, reason) {
  this.coins += amount;
  this.coinEarning.push({
    amount,
    reason,
    timestamp: new Date()
  });
  return this.save();
};

User.methods.removeCoins = async function(amount, reason) {
  if (this.coins < amount) {
    throw new Error('Insufficient coins');
  }
  this.coins -= amount;
  this.coinSpending.push({
    amount,
    reason,
    timestamp: new Date()
  });
  return this.save();
};

User.methods.hasCoins = function(amount) {
  return this.coins >= amount;
};

User.methods.getCoinBalance = function() {
  return {
    coins: this.coins,
    lastUpdated: new Date()
  };
};
```

---

## Coin Earning Mechanics

### Current Earning Sources

#### 1. **Gameplay Rewards** (10-100 coins per game)

**Location:** `routes/game.js`

```javascript
// After game completes
if (player.won) {
  user.coins += 50;  // Win bonus
} else {
  user.coins += 10;  // Participation bonus
}
```

**By Game Type:**
```
Mafia:         50 coins (win), 10 (loss)
Poker:         30-100 coins (variable pot)
Resistance:    40 coins (win), 10 (loss)
Connect Four:  20 coins (win), 5 (loss)
Cheat:         35 coins (win), 8 (loss)
Tournament:    200+ coins (1st place)
```

#### 2. **Daily Objectives** (100+ coins)

**Not Currently Implemented** - Add this:

```javascript
// New field in user schema
dailyObjectives: {
  completedToday: [String],  // ['play-game', 'win-game', 'forum-post']
  lastReset: Date
},

// Endpoints to add
POST /api/objectives/check  // Award coins if completed
GET /api/objectives/today   // Show daily challenges
```

**Suggested Daily Challenges:**
```
Play 3 games          → 50 coins
Win 1 game            → 75 coins
Play Mafia            → 50 coins
Post in forum         → 25 coins
Invite friend         → 100 coins
```

**Expected Daily Earnings:** 150-300 coins

#### 3. **Achievements** (50-500 coins)

**Should Exist:** `data/Achievements.js`

```javascript
achievements: {
  "first-win": {
    reward: 100,
    description: "Win your first game"
  },
  "win-10-games": {
    reward: 250,
    description: "Win 10 games in any mode"
  },
  "mafia-master": {
    reward: 500,
    description: "Win 25 Mafia games as any role"
  },
  // Add 20+ more...
}
```

#### 4. **Referral Bonuses** (200-1000 coins)

**Not Currently Implemented** - Add:

```javascript
// User schema field
referralStats: {
  referrerCode: String,
  referredCount: Number,
  referralCoinsEarned: Number
},

// Logic
When new user signs up with referral code:
- New user gets: 100 coins (sign-up bonus)
- Referrer gets: 100 coins (per successful signup)

Bonus tiers:
- 5 referrals: 500 bonus coins
- 10 referrals: 1,000 bonus coins
- 25 referrals: 2,500 bonus coins
```

#### 5. **Event/Seasonal Bonuses** (100-2000 coins)

```
Holiday event completion    → 500 coins
Tournament participation    → 100-1000 coins
Seasonal story completion   → 750 coins
Limited-time challenges     → 200-500 coins
```

### Monthly Earning Summary

**New Player (First Month):**
```
10 gameplay wins @ 50 coins         = 500 coins
20 gameplay losses @ 10 coins       = 200 coins
30 daily challenges @ 100 coins     = 3,000 coins
5 achievements unlocked @ 250 avg   = 1,250 coins
Referral bonus (3 friends)          = 300 coins
                                    ___________
Total: 5,250 coins
```

**Active Player (Monthly):**
```
100 games @ 30 coins average     = 3,000 coins
30 daily objectives @ 100 coins  = 3,000 coins
10 achievements @ 250 coins      = 2,500 coins
Monthly event bonus              = 500 coins
Tournament participation         = 1,000 coins
                                ___________
Total: 10,000 coins
```

---

## Coin Spending (Shop)

### Existing Shop Items

**Location:** `routes/shop.js`

```javascript
const shopItems = [
  // Profile Customization (20-800 coins)
  { key: 'name-color-red', price: 20, category: 'profile' },
  { key: 'name-color-gold', price: 20, category: 'profile' },
  { key: 'profile-frame-gold', price: 50, category: 'profile' },
  
  // Username Length (100-800 coins)
  { key: 'username-20chars', price: 100, category: 'profile' },
  { key: 'username-30chars', price: 200, category: 'profile' },
  { key: 'username-50chars', price: 800, category: 'profile' },
  
  // Chat Cosmetics (5-70 coins)
  { key: 'custom-emote-1', price: 20, category: 'chat' },
  { key: 'chat-bubble', price: 70, category: 'chat' },
  
  // Premium Features (50-100 coins)
  { key: 'anonymous-deck', price: 70, category: 'feature' },
  { key: 'archived-games', price: 100, category: 'feature' },
  { key: 'bonus-red-hearts', price: 10, category: 'currency' },
];
```

### Cosmetics Tier Pricing

**Current ($5-800 price range):**
```
Tier 1: 5-30 coins (basic recolors)
Tier 2: 30-100 coins (themed cosmetics)
Tier 3: 100-300 coins (premium skins)
Tier 4: 300-800+ coins (ultra-rare)
```

### Recommended Shop Expansion (50 new items)

#### Category: Avatar Skins (10 items @ 50-200 coins)
```
Default → 0 coins (free)
Elemental Fire → 50 coins
Elemental Ice → 50 coins
Elemental Dark → 75 coins
Robot → 100 coins
Ghost → 100 coins
Alien → 150 coins
Dragon → 200 coins
Phoenix → 250 coins
Shadow Knight → 300 coins
```

#### Category: Profile Frames (10 items @ 20-100 coins)
```
Gold Frame → 50 coins
Silver Frame → 35 coins
Rainbow Frame → 75 coins
Neon Frame → 60 coins
Vintage Frame → 40 coins
Holographic Frame → 150 coins
Crystal Frame → 80 coins
Fire Frame → 65 coins
Frost Frame → 65 coins
Shadow Frame → 100 coins
```

#### Category: Chat Bubbles (10 items @ 25-150 coins)
```
Standard → 0 coins (free)
Neon Glow → 30 coins
Marble → 40 coins
Glassmorphism → 50 coins
Retro → 45 coins
Minimal → 25 coins
3D → 75 coins
Hologram → 100 coins
Dark Mode → 35 coins
Rainbow → 80 coins
```

#### Category: Role Badges (10 items @ 15-75 coins)
```
Streamer Badge → 75 coins
Content Creator → 60 coins
Tournament Winner → 50 coins
Community Helper → 40 coins
Bug Bounty Pro → 35 coins
Veteran Player → 30 coins
Game Master → 50 coins
Mafia Expert → 40 coins
Poker Pro → 40 coins
Rising Star → 25 coins
```

#### Category: Limited/Seasonal (10+ items @ 75-250 coins)
```
Holiday 2026 Pack → 200 coins
Summer Beach Bundle → 150 coins
Autumn Harvest → 125 coins
Winter Snow Special → 150 coins
Valentine's Day → 100 coins
Easter Egg Hunt → 100 coins
Halloween Spooky → 125 coins
New Year Sparkle → 100 coins
[Monthly rotating items]
```

### Expansion Revenue Model

**Expansion Impact:**

```
Current: 20 items @ 5-800 coins, ~5% adoption
New: 70 items @ 15-250 coins average (lower barrier to entry)

Expected:
- Item adoption increases to 25% (5x)
- Average spend remains $5 per player
- 10% of active players buy cosmetics
- Monthly recurring revenue: $15,000-20,000 (from cosmetics alone)
```

---

## Integration Guide

### Adding a New Cosmetic Item

#### Step 1: Add to Database

**File:** `routes/shop.js`

```javascript
const shopItems = [
  // ... existing items
  {
    key: 'avatar-phoenix',
    name: 'Phoenix Avatar',
    price: 250,
    category: 'avatar',
    description: 'Mythical phoenix avatar skin',
    rarity: 'rare',
    image: '/cosmetics/avatar-phoenix.png',
    limit: null,  // null = unlimited
    onBuy: async (user) => {
      user.itemsOwned['avatar-phoenix'] = true;
      await user.save();
      return { success: true };
    }
  }
];
```

#### Step 2: Add to User Schema

**File:** `db/schemas.js`

```javascript
itemsOwned: {
  'avatar-phoenix': Boolean,
  // Add to existing itemsOwned object
}
```

#### Step 3: Add Frontend Component

**File:** `react_main/src/components/Shop/ShopItem.jsx`

```javascript
const ShopItem = ({ item, onPurchase }) => {
  const [loading, setLoading] = useState(false);
  
  const handlePurchase = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.key })
      });
      
      if (res.ok) {
        onPurchase(item);
        alert(`Purchased ${item.name}!`);
      } else {
        alert('Insufficient coins');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="shop-item">
      <img src={item.image} alt={item.name} />
      <h3>{item.name}</h3>
      <p>{item.price} coins</p>
      <button onClick={handlePurchase} disabled={loading}>
        {loading ? 'Purchasing...' : 'Buy Now'}
      </button>
    </div>
  );
};
```

#### Step 4: Add Purchase Endpoint

**File:** `routes/shop.js`

```javascript
router.post('/purchase', authentication, async (req, res) => {
  const { itemId } = req.body;
  const user = await models.User.findById(req.user._id);
  
  // Find item in shop
  const item = shopItems.find(i => i.key === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  
  // Check coins
  if (user.coins < item.price) {
    return res.status(400).json({ error: 'Insufficient coins' });
  }
  
  // Check if already owned
  if (user.itemsOwned[itemId]) {
    return res.status(400).json({ error: 'Already owned' });
  }
  
  // Process purchase
  user.coins -= item.price;
  user.itemsOwned[itemId] = true;
  
  // Run custom callback if exists
  if (item.onBuy) {
    await item.onBuy(user);
  }
  
  await user.save();
  
  res.json({
    success: true,
    newBalance: user.coins,
    item: item.name
  });
});
```

---

## Expansion Roadmap

### Phase 1: Polish Existing System (Week 1)

**What to do:**
- [ ] Verify coin earning is working in all games
- [ ] Fix shop UI display
- [ ] Test purchase flow end-to-end
- [ ] Add coin balance display to game lobby

**Effort:** 2-3 days

### Phase 2: Complete Shop (Week 2)

**What to do:**
- [ ] Add 50 new cosmetic items (see expansion section)
- [ ] Implement shop search/filter
- [ ] Add "preview" functionality
- [ ] Create rarity system (common/rare/epic/legendary)

**Effort:** 3-4 days

### Phase 3: Monetization Hook (Week 3)

**What to do:**
- [ ] Implement "Buy Coins" button (real money)
- [ ] Wire to Braintree payment processor
- [ ] Create coin packages:
  - 500 coins = $4.99
  - 1200 coins = $9.99 (best value)
  - 3000 coins = $19.99
  - 6500 coins = $39.99

**Expected conversion:** 2-5% of players buy coins

**Expected revenue:** $4,000-10,000/month

**Effort:** 2-3 days (mostly UI)

### Phase 4: Earning Expansion (Week 4)

**What to do:**
- [ ] Implement daily challenges (+100-300 coins/day)
- [ ] Add achievements system (+50-500 coins each)
- [ ] Implement referral rewards (+100 coins per friend)
- [ ] Add seasonal events (+500-2000 coins)

**Expected impact:**
- DAU increase: 10-20%
- Retention increase: 15%
- Average earning: 5,000-10,000 coins/month

**Effort:** 3-5 days

### Phase 5: Battle Pass Integration (Week 5)

**What to do:**
- [ ] Create battle pass using "points" earned in games
- [ ] Tier system: 50 tiers
- [ ] Rewards include: coins, cosmetics, exclusive items
- [ ] Pricing: $4.99/month or battle pass per season

**Expected impact:**
- 20% of players purchase battle pass
- $146k+ MRR by year-end

**Effort:** 4-6 days

---

## API Reference

### User Endpoints

#### GET `/api/user/balance`
**Returns:** Current coin balance
```javascript
{
  coins: 2500,
  goldHearts: 0,
  points: 150,
  championshipPoints: 0,
  redHearts: 5
}
```

#### POST `/api/user/coins/add`
**Admin/Internal Only** - Add coins to user
```javascript
{
  userId: "6xxx",
  amount: 100,
  reason: "daily-challenge-completion"
}
```

#### POST `/api/user/coins/remove`
**Admin/Internal Only** - Remove coins
```javascript
{
  userId: "6xxx",
  amount: 50,
  reason: "shop-purchase"
}
```

### Shop Endpoints

#### GET `/api/shop/items`
**Returns:** All shop items
```javascript
[
  {
    key: "avatar-phoenix",
    name: "Phoenix Avatar",
    price: 250,
    category: "avatar",
    owned: false,
    image: "/cosmetics/avatar-phoenix.png"
  },
  // ... more items
]
```

#### POST `/api/shop/purchase`
**Authenticates & purchases item**
```javascript
Request:
{
  itemId: "avatar-phoenix"
}

Response:
{
  success: true,
  newBalance: 2250,
  item: "Phoenix Avatar"
}
```

#### GET `/api/shop/items/:category`
**Returns items by category**
```
/api/shop/items/avatar
/api/shop/items/profile
/api/shop/items/chat
/api/shop/items/limited
```

### Game Endpoints

#### POST `/api/game/:gameId/win`
**Award coins for game win**
```javascript
{
  userId: "6xxx",
  gameType: "mafia",
  coins: 50
}
```

#### POST `/api/game/:gameId/complete`
**Award coins for participation**
```javascript
{
  userId: "6xxx",
  gameType: "mafia",
  coins: 10
}
```

---

## Monetization Strategy

### Free Coin Earning vs. Real Money

**Philosophy:** Make coins feel rewarding but not infinite

```
Per Week (Playing 10-15 games):
- Gameplay: 300-500 coins
- Daily challenges: 700-1000 coins
- Total: 1,000-1,500 coins/week

Per Month:
- Free player: 4,000-6,000 coins
- Active player: 8,000-15,000 coins

Shop Item Cost:
- Base cosmetics: 20-50 coins (cheap)
- Premium cosmetics: 100-300 coins (3-4 weeks earn)
- Ultras & limited: 500-1000+ coins (1-2 months earn)

Real Dollar Value:
- 500 coins = $4.99
- Implies 1 coin = $0.01 (1 cent)
- 50-coin item = $0.50 perceived value
- 250-coin item = $2.50 perceived value
```

### Purchase Psychology

**Free Coins:**
- Feel good (dopamine from earning)
- Takes time (grinding for premium items)
- Slower monetization (free players buy less)

**Premium Coins (Pay-to-Convenience):**
- Buy coins when:
  - Event cosmetics appear (FOMO)
  - "Just 200 coins short" (near success)
  - Battle pass cosmetics locked
  - Limited-time items (seasonal)

**Expected Conversion:**
- Whales (top 5%): $50-200/month
- Regular spenders (15%): $5-20/month
- Dolphins (20%): $1-5/month
- Free players (60%): $0 (but high retention)

---

## Implementation Checklist

### Must Do (This Week)

- [ ] Verify coin earning is working
- [ ] Fix shop UI bugs
- [ ] Add coin balance display
- [ ] Create coin icon/sprite

**Effort:** 1-2 days

### Should Do (This Month)

- [ ] Add 50 new cosmetics
- [ ] Implement daily challenges
- [ ] Create achievements
- [ ] Add referral rewards
- [ ] Wire "Buy Coins" to Braintree

**Effort:** 2-3 weeks

### Nice to Have (Following Months)

- [ ] Premium cosmetics tier
- [ ] Seasonal rotation
- [ ] Cosmetics preview/try-on
- [ ] Cosmetics trading (advanced)
- [ ] Cosmetics crafting

**Effort:** 3-4 weeks

---

## Best Practices

### DO ✅

- **Respect earning rate:** Let players earn what they want without pay limits
- **Add FOMO:** Limited-time cosmetics drive impulse purchases
- **Balance prices:** Mix $0.99 and $4.99 cosmetics
- **Transparent pricing:** Always show coin cost clearly
- **Track analytics:** Know which items sell best
- **Reset seasonally:** Rotate cosmetics to create demand
- **Bundle items:** 3-item packs at 10-15% discount

### DON'T ❌

- **Lock gameplay behind coins:** Cosmetics only
- **Inflate prices:** Keep 50-250 coin range for most items
- **Make coins too hard to earn:** At least 1,000/week for casuals
- **Pay-to-win cosmetics:** Purely visual only
- **Hidden costs:** Always show final price upfront
- **Force cosmetics on players:** Optional, never required

---

## Future Expansion Ideas

### 1. Cosmetics Trading (Month 3-4)
- Allow players to trade cosmetics for coins/items
- Marketplace system
- Commission fees (10-20%)
- Fraud prevention

### 2. Cosmetics Crafting (Month 3-4)
- Combine items to create new ones
- Recipe system
- Requires multiple cosmetics + coins
- Unlocks unique variations

### 3. Cosmetics Rarity Upgrades (Month 5-6)
- Common → Rare → Epic → Legendary tiers
- Upgrade with coins + materials
- Visual variations per rarity

### 4. Limited Cosmetics Auctions (Month 6+)
- End-of-season cosmetic auction
- Players bid coins
- Top bidders get exclusive item
- Spikes spending at season end

### 5. Cosmetics NFT Integration (Month 9+)
- Blockchain-backed cosmetics
- External marketplace
- Real secondary market
- Premium cosmetic sales

---

## Conclusion

**The coin system is the foundation of PassionMafia's monetization strategy.** By balancing free earning with premium cosmetics, the game can achieve:

✅ High player retention (cosmetics incentivize playing)  
✅ Healthy monetization (15-25% paying players)  
✅ Player agency (earn OR buy)  
✅ Sustainable growth (repeating content cycles)  
✅ Community engagement (cosmetics create status)  

**Expected Revenue by Year-End:**
- Cosmetics: $15,000-20,000/month
- Battle Pass: $140,000+/month
- VIP Subscriptions: $100,000+/month
- **Total: $255,000+/month**

---

**Document prepared:** April 8, 2026  
**For:** PassionMafia Development Team  
**Status:** Ready for implementation
