# ⚙️ Admin Settings: Currency & Game Configuration

**Last Updated:** April 24, 2026

---

## 📋 Overview

Currency and game constants can now be configured from the admin panel without modifying code. All settings are stored in the database with fallback to hardcoded defaults in `data/constants.js`.

### Access

**Endpoint:** `/admin/settings/general`  
**Method:** GET (view), PATCH (update)  
**Permission Required:** `admin` role

---

## 💾 Settings Categories

### 🎁 Coin Rewards

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `registerCoinsReward` | Number | 0 | Coins awarded when new user registers |

**Usage:**
```javascript
// Anywhere in your code
const { getSettings } = require("../lib/defaultSettings");
const settings = await getSettings(models);
console.log(settings.registerCoinsReward); // Value from DB or default
```

---

### ❤️ Red Hearts Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `initialRedHeartCapacity` | Number | 15 | Base red hearts capacity per user |
| `maxBonusRedHearts` | Number | 5 | Maximum purchasable bonus red hearts |
| `redHeartRefreshIntervalMillis` | Number | 82800000 | Time between daily refreshes (ms) |

**Formula:** `Total Capacity = initialRedHeartCapacity + (bonusRedHearts purchased)`

**Example:**
```
User purchases 3 "Bonus Red Hearts" items
Total capacity = 15 + 3 = 18 red hearts/day
```

---

### 💛 Gold Hearts Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `initialGoldHeartCapacity` | Number | 0 | Starting gold hearts for new users |
| `goldHeartRefreshIntervalMillis` | Number | 82800000 | Refresh interval (currently not used) |

**Note:** Gold hearts are premium currency, not automatically capped by day.

---

### 🏆 Ranked Access Requirements

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `minimumGamesForRanked` | Number | 5 | Games required before ranked unlock |
| `minimumPointsForCompetitive` | Number | 150 | Points required for competitive access |
| `pointsNominalAmount` | Number | 60 | Standard points per ranked game |

**Unlock Flow:**
```
1. User plays minimumGamesForRanked (default: 5) games
2. User accumulates minimumPointsForCompetitive (default: 150) points
3. User gains "Competitive Player" permission
4. User can enter competitive queues
```

---

### ⚔️ Competitive Season Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `openDaysPerCompetitiveRound` | Number | 9 | Days round is open for play |
| `reviewDaysPerCompetitiveRound` | Number | 4 | Days for results review |

**Round Duration:** `openDays + reviewDays = 13 days per round`

**Timeline Example:**
```
Round 1 (default settings):
  Days 1-9:   OPEN   (Games can be played)
  Days 10-13: REVIEW (Results locked, mod review)

Round 2:
  Days 14-22: OPEN
  Days 23-26: REVIEW
```

---

## 🔧 Admin Panel Form Fields

When updating settings via `/admin/settings/general` PATCH endpoint:

```json
{
  "registerCoinsReward": 100,
  "initialRedHeartCapacity": 15,
  "initialGoldHeartCapacity": 0,
  "maxBonusRedHearts": 5,
  "redHeartRefreshIntervalMillis": 82800000,
  "goldHeartRefreshIntervalMillis": 82800000,
  "minimumGamesForRanked": 5,
  "minimumPointsForCompetitive": 150,
  "openDaysPerCompetitiveRound": 9,
  "reviewDaysPerCompetitiveRound": 4,
  "pointsNominalAmount": 60
}
```

---

## 📚 Using Settings in Code

### Example 1: Read Settings on Startup

```javascript
const defaultSettings = require("../lib/defaultSettings");
const models = require("../db/models");

async function initializeGame() {
  const settings = await defaultSettings.getSettings(models);
  
  console.log(`Red Heart Capacity: ${settings.initialRedHeartCapacity}`);
  console.log(`Ranked Requirement: ${settings.minimumGamesForRanked} games`);
}
```

### Example 2: Get Single Setting

```javascript
const minGames = await defaultSettings.getSetting(
  models,
  "minimumGamesForRanked"
);
```

### Example 3: Cache Invalidation

```javascript
// After updating settings in admin
defaultSettings.invalidateCache();

// Next getSettings() call will fetch fresh data from DB
```

---

## 🚀 Deployment Considerations

### Database Migration

When deploying, new settings fields are automatically created with defaults:

```javascript
// In db/schemas.js - DefaultSettings schema
initialRedHeartCapacity: { type: Number, default: 15 },
maxBonusRedHearts: { type: Number, default: 5 },
// ... other fields
```

**No manual migration needed** - Mongoose will add missing fields on first save.

### Cache Strategy

- Settings are cached for **5 minutes** to reduce DB queries
- Cache is invalidated when admin updates settings
- If DB connection fails, hardcoded defaults are used

---

## 🎯 Common Admin Tasks

### Adjust Ranked Requirements

**Scenario:** You want to lower barrier to competitive entry

**Action:**
```
PATCH /admin/settings/defaults
{
  "minimumGamesForRanked": 3,        // 5 → 3
  "minimumPointsForCompetitive": 100 // 150 → 100
}
```

### Increase Red Heart Capacity

**Scenario:** Red hearts are too limited, players complaining

**Action:**
```
PATCH /admin/settings/defaults
{
  "initialRedHeartCapacity": 20     // 15 → 20
}
```

### Extend Competitive Round Duration

**Scenario:** Need more time for tournament play

**Action:**
```
PATCH /admin/settings/defaults
{
  "openDaysPerCompetitiveRound": 14  // 9 → 14
}
```

### Reward New Signups

**Scenario:** Want to give new players starting bonus

**Action:**
```
PATCH /admin/settings/defaults
{
  "registerCoinsReward": 500  // 0 → 500 coins
}
```

---

## 📊 Monitoring

### Current Settings

**Endpoint:** `GET /admin/settings/general`

**Response includes:**
```json
{
  "defaultSettings": {
    "registerCoinsReward": 0,
    "initialRedHeartCapacity": 15,
    "initialGoldHeartCapacity": 0,
    "maxBonusRedHearts": 5,
    "redHeartRefreshIntervalMillis": 82800000,
    "goldHeartRefreshIntervalMillis": 82800000,
    "minimumGamesForRanked": 5,
    "minimumPointsForCompetitive": 150,
    "openDaysPerCompetitiveRound": 9,
    "reviewDaysPerCompetitiveRound": 4,
    "pointsNominalAmount": 60
  },
  "modules": [ /* system status */ ]
}
```

### Database Document

**Location:** Collection `defaultsettings`

```javascript
db.defaultsettings.findOne({ key: "default" })

// Returns:
{
  _id: ObjectId("..."),
  key: "default",
  registerCoinsReward: 100,
  initialRedHeartCapacity: 15,
  maxBonusRedHearts: 5,
  minimumGamesForRanked: 5,
  minimumPointsForCompetitive: 150,
  // ... other fields
  updatedAt: 1713974400000,
  updatedBy: "admin-user-id"
}
```

---

## ⚠️ Important Notes

1. **No code restart required** - Settings take effect immediately (after cache expiry)
2. **Fallback to constants** - If DB unavailable, game uses `data/constants.js` values
3. **Audit trail** - Each update records `updatedBy` (admin user ID) and `updatedAt` timestamp
4. **Number validation** - All values must be valid numbers, negative values are allowed for testing

---

## 🔗 Related Files

- **Database Schema:** [db/schemas.js](db/schemas.js#L235) - DefaultSettings
- **Settings Library:** [lib/defaultSettings.js](lib/defaultSettings.js) - Utility functions
- **Admin Routes:** [routes/admin.js](routes/admin.js#L1180) - GET/PATCH endpoints
- **Constants:** [data/constants.js](data/constants.js) - Fallback hardcoded values
- **Currency Guide:** [CURRENCY.md](CURRENCY.md) - User-facing currency documentation

---

## 🐛 Troubleshooting

### Settings Not Updating

**Issue:** Changed settings but game still using old values

**Solution:**
1. Check admin PATCH response for errors
2. Wait 5 minutes for cache expiry OR restart backend to clear cache
3. Verify settings saved to database: `db.defaultsettings.findOne()`

### Fallback to Defaults

**Issue:** Getting "hardcoded" values instead of DB values

**Cause:** Database query failed or `DefaultSettings` document doesn't exist

**Solution:**
1. Check MongoDB connection
2. Manually create document:
   ```javascript
   db.defaultsettings.insertOne({ key: "default" })
   ```
3. Check logs for connection errors

### Cache Not Invalidating

**Issue:** New settings not taking effect

**Cause:** Cache TTL (5 minutes) hasn't expired

**Solution:**
1. Wait 5 minutes, or
2. Restart backend service to clear all caches
