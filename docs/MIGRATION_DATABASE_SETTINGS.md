# 🔄 Migration Guide: Using Database Settings Instead of Constants

**Purpose:** Replace hardcoded constants with configurable database settings

---

## 📖 Overview

Before this change, currency values were hardcoded in `data/constants.js`:
```javascript
minimumGamesForRanked: 5,
minimumPointsForCompetitive: 150,
initialRedHeartCapacity: 15,
// ... etc
```

Now these can be configured via admin panel and stored in the database.

---

## 🔧 Refactoring Code

### Before: Using Constants

```javascript
const constants = require("../data/constants");

function checkRankedEligibility(user) {
  if (user.gamesPlayed < constants.minimumGamesForRanked) {
    return false;
  }
  return true;
}
```

### After: Using Database Settings

```javascript
const defaultSettings = require("../lib/defaultSettings");

async function checkRankedEligibility(user, models) {
  const settings = await defaultSettings.getSettings(models);
  
  if (user.gamesPlayed < settings.minimumGamesForRanked) {
    return false;
  }
  return true;
}
```

---

## 📍 Common Refactoring Locations

### 1. Game Initialization (routes/game.js)

**Before:**
```javascript
const { minimumPointsForCompetitive } = constants;
```

**After:**
```javascript
const settings = await defaultSettings.getSettings(models);
const minimumPointsForCompetitive = settings.minimumPointsForCompetitive;
```

---

### 2. User Profile (routes/user.js)

**Before:**
```javascript
user.redHeartCapacity = constants.initialRedHeartCapacity;
```

**After:**
```javascript
const settings = await defaultSettings.getSettings(models);
user.redHeartCapacity = settings.initialRedHeartCapacity;
```

---

### 3. Competitive Round Setup (modules/periodic.js)

**Before:**
```javascript
const openDays = constants.openDaysPerCompetitiveRound;
const reviewDays = constants.reviewDaysPerCompetitiveRound;
```

**After:**
```javascript
const settings = await defaultSettings.getSettings(models);
const openDays = settings.openDaysPerCompetitiveRound;
const reviewDays = settings.reviewDaysPerCompetitiveRound;
```

---

### 4. Shop Pricing (routes/shop.js)

**Before:**
```javascript
const maxBonus = constants.maxBonusRedHearts;
```

**After:**
```javascript
const settings = await defaultSettings.getSettings(models);
const maxBonus = settings.maxBonusRedHearts;
```

---

## 🚀 Step-by-Step Migration

### Step 1: Import the Library

Add to the top of any file using configurable constants:

```javascript
const defaultSettings = require("../lib/defaultSettings");
```

### Step 2: Get Settings

In async function:
```javascript
const settings = await defaultSettings.getSettings(models);
```

In synchronous function (not recommended, use callback if possible):
```javascript
// Use constants as fallback if you can't async
const settings = defaultSettings.getDefaultSettings();
```

### Step 3: Replace Constants References

```javascript
// Before
const value = constants.minimumGamesForRanked;

// After
const value = settings.minimumGamesForRanked;
```

### Step 4: Test

1. Change a setting via admin panel
2. Verify game behavior reflects new setting
3. Check cache expiry (5 min) or restart backend

---

## 📋 Settings Reference Table

| Constant | DB Field | Location | Usage |
|----------|----------|----------|-------|
| `registerCoinsReward` | `registerCoinsReward` | routes/auth.js | New user signup bonus |
| `initialRedHeartCapacity` | `initialRedHeartCapacity` | routes/user.js | Red heart init |
| `maxBonusRedHearts` | `maxBonusRedHearts` | routes/shop.js | Max purchasable bonus |
| `minimumGamesForRanked` | `minimumGamesForRanked` | routes/game.js | Ranked unlock requirement |
| `minimumPointsForCompetitive` | `minimumPointsForCompetitive` | routes/competitive.js | Competitive unlock |
| `pointsNominalAmount` | `pointsNominalAmount` | routes/game.js | Points per game |
| `openDaysPerCompetitiveRound` | `openDaysPerCompetitiveRound` | modules/periodic.js | Competitive round duration |
| `reviewDaysPerCompetitiveRound` | `reviewDaysPerCompetitiveRound` | modules/periodic.js | Review phase duration |

---

## ⚡ Performance Considerations

### Caching

Settings are cached for 5 minutes to minimize database queries:

```javascript
// First call - queries database
const settings1 = await defaultSettings.getSettings(models);

// Second call within 5 min - returns cached copy (no DB query)
const settings2 = await defaultSettings.getSettings(models);

// After 5 min - queries database again
const settings3 = await defaultSettings.getSettings(models);
```

### Best Practices

1. **Call once per request** - Cache the settings object in your route handler
2. **Not in loops** - Don't call `getSettings()` inside loops, call once before
3. **Error handling** - Always await, function has built-in try/catch

---

## 🔍 Code Examples

### Example 1: Route Handler

```javascript
router.get("/api/user/ranked/eligibility", async (req, res) => {
  const settings = await defaultSettings.getSettings(models);
  const user = await models.User.findById(req.user._id);
  
  const isEligible = user.gamesPlayed >= settings.minimumGamesForRanked;
  
  res.json({ eligible: isEligible });
});
```

### Example 2: Database Query

```javascript
async function initializeNewUser(userId) {
  const settings = await defaultSettings.getSettings(models);
  
  await models.User.updateOne(
    { _id: userId },
    {
      redHearts: settings.initialRedHeartCapacity,
      goldHearts: settings.initialGoldHeartCapacity,
      coins: settings.registerCoinsReward,
    }
  );
}
```

### Example 3: Validation

```javascript
async function validateCompetitiveEntry(user) {
  const settings = await defaultSettings.getSettings(models);
  
  const meetsGames = user.gamesPlayed >= settings.minimumGamesForRanked;
  const meetsPoints = user.points >= settings.minimumPointsForCompetitive;
  
  return meetsGames && meetsPoints;
}
```

---

## 🔗 API Reference

### getSettings(models)

**Description:** Get all configurable settings with caching

**Returns:** Promise<Object>

```javascript
const settings = await defaultSettings.getSettings(models);
// {
//   registerCoinsReward: 0,
//   initialRedHeartCapacity: 15,
//   initialGoldHeartCapacity: 0,
//   maxBonusRedHearts: 5,
//   // ... etc
// }
```

---

### getSetting(models, key)

**Description:** Get single setting value

**Returns:** Promise<any>

```javascript
const minGames = await defaultSettings.getSetting(
  models,
  "minimumGamesForRanked"
); // 5
```

---

### getDefaultSettings()

**Description:** Get hardcoded defaults (no DB query, sync)

**Returns:** Object

```javascript
const defaults = defaultSettings.getDefaultSettings();
// Use when database unavailable or in initialization
```

---

### invalidateCache()

**Description:** Clear the 5-minute cache

**Returns:** void

```javascript
defaultSettings.invalidateCache();
// Call after updating settings in admin panel
```

---

## ✅ Checklist for Migration

- [ ] Add `const defaultSettings = require("../lib/defaultSettings");`
- [ ] Identify all constants being used
- [ ] Add `const settings = await defaultSettings.getSettings(models);`
- [ ] Replace `constants.FIELD` with `settings.FIELD`
- [ ] Test with different settings values
- [ ] Verify cache invalidation works
- [ ] Update documentation if needed

---

## ❓ FAQ

### Q: What if database is down?
**A:** The application falls back to hardcoded defaults from `data/constants.js`. Game works but with fixed settings.

### Q: Do I need to restart the server after changing settings?
**A:** No, but changes take effect after 5-minute cache expiry. Restart backend to apply immediately.

### Q: Can I use this in synchronous code?
**A:** Use `getDefaultSettings()` which is sync, but it won't reflect database changes until code is restarted.

### Q: Is there a performance penalty?
**A:** Minimal - first call queries DB, then 5-minute cache means only 288 DB queries/day for settings.

### Q: How do I know if a setting was changed?
**A:** Check database document for `updatedAt` timestamp:
```javascript
db.defaultsettings.findOne().updatedAt
```
