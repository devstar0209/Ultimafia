# ⚔️ Admin Guide: Competitive Seasons & Ranked Game Terms

**Last Updated:** April 24, 2026

---

## 📋 Overview

This guide covers admin functionality for:
1. **Creating competitive seasons** - Structure ranked competitions with rounds and setups
2. **Managing ranked game terms** - Configure rules, scoring, and requirements

---

## 🏆 Competitive Seasons

### What is a Season?

A competitive season is:
- A numbered tournament structure (Season 1, 2, 3...)
- Contains multiple **rounds** (default: 12 rounds)
- Each round has a specific **setup** (game configuration)
- Has defined **open** and **review** phases
- Players earn competitive points toward seasonal leaderboard

### Create a Season

**Admin Panel:** `/admin/competitive/seasons/create`

**Required Fields:**

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `startDate` | String (YYYY-MM-DD) | 2026-05-01 | First day of season (must be ≥ 1 day in future) |
| `numRounds` | Number | 12 | Total competitive rounds |
| `setupsPerRound` | Number | 2 | Game setups per round |

**Example Request:**
```bash
POST /admin/competitive/seasons/create
{
  "startDate": "2026-05-01",
  "numRounds": 12,
  "setupsPerRound": 2
}
```

**Validations:**
- ✅ Only one season can be in progress at a time
- ✅ Setups must be pre-approved as "competitive" in mod commands
- ✅ Start date must be at least 1 day in the future
- ✅ Date format must be YYYY-MM-DD

### Season Lifecycle

```
Season Created
    ↓
Day 1: Round 1 Opens (9 days open, 4 days review by default)
    ↓
Day 10: Round 1 Review Phase
    ↓
Day 14: Round 2 Opens
    ↓
... (repeats for 12 rounds = ~13 weeks)
    ↓
Season Completed (admin marks complete)
```

### Pause a Season

**Endpoint:** `POST /admin/competitive/seasons/{seasonNumber}/pause`

**Use Cases:**
- Emergency maintenance
- Critical bug discovered
- Unexpected balance issues

**Response:**
```json
{
  "success": true,
  "paused": true,  // or false if resuming
  "seasonNumber": 1
}
```

### View Season Status

**Endpoint:** `GET /admin/competitive/seasons`

**Response:**
```json
{
  "seasons": [
    {
      "number": 1,
      "startDate": "2026-05-01",
      "currentRound": 3,
      "numRounds": 12,
      "completed": false,
      "paused": false,
      "status": "Active"
    }
  ]
}
```

---

## 📋 Ranked Game Terms

### What Are Ranked Terms?

Rules that govern competitive ranked gameplay:
- **Disqualification rules** - When players lose ranked privileges
- **Timeout settings** - Game join/AFK penalties
- **Scoring rules** - Points for wins/losses/draws
- **Season requirements** - Minimum games to qualify
- **Matchmaking** - Rating difference limits

### Configure Ranked Terms

**Admin Panel:** `/admin/competitive/ranked-terms`

### Disqualification Rules

**Max Leave Count** (default: 3)
- If player leaves competitive games ≥ 3 times per season
- Player is disqualified from competitive play for the season

**Max Report Count** (default: 2)
- Reports upheld against player in competitive games
- Disqualifies after 2 confirmed violations

**Max Ban Count** (default: 1)
- Temporary bans accumulated in competitive
- Player disqualified after 1 temporary ban

### Timeout Settings

**Join Game Timeout** (default: 5 minutes)
- Player has 5 minutes to join game after accepting
- Failure = counted as a leave

**AFK Timeout** (default: 10 minutes)
- Player marked AFK if inactive for 10 minutes
- Game continues, player loses points

### Scoring Rules

| Term | Default | Description |
|------|---------|-------------|
| `winPoints` | 100 | Points awarded for winning a ranked game |
| `lossPoints` | 10 | Points for losing (participation credit) |
| `drawPoints` | 50 | Points if game ends in draw |
| `afkPenaltyPoints` | -25 | Penalty for being AFK during game |
| `leavePenaltyPoints` | -50 | Penalty for leaving a game |

**Calculation Example:**
```
Player wins game:        +100 points
Player loses game:       +10 points
Player wins but goes AFK: +100 - 25 = +75 points
Player leaves game:      -50 points
```

### Season Requirements

**Min Games Required** (default: 5)
- Player must complete ≥5 ranked games per season
- To qualify for seasonal leaderboard/prizes

**Min Wins Required** (default: 1)
- Must win at least 1 game to maintain ranking
- Prevents "stat padding" with only losses

**Season Reset Frequency** (default: 90 days)
- Rankings reset every 90 days (per season)
- Players start fresh at season start

### Matchmaking

**Rating Range Difference** (default: 300 Elo points)
- Don't match players with >300 point rating gap
- Prevents skill-stomping scenarios
- Adjustable based on player pool

---

## 🔧 API Reference

### Get Current Ranked Terms

```javascript
GET /admin/competitive/ranked-terms

Response:
{
  "terms": {
    "key": "default",
    "maxLeaveCount": 3,
    "maxReportCount": 2,
    "maxBanCount": 1,
    "joinGameTimeoutMinutes": 5,
    "afkTimeoutMinutes": 10,
    "winPoints": 100,
    "lossPoints": 10,
    "drawPoints": 50,
    "afkPenaltyPoints": -25,
    "leavePenaltyPoints": -50,
    "minGamesRequiredPerSeason": 5,
    "minWinsRequiredPerSeason": 1,
    "seasonResetFrequencyDays": 90,
    "ratingRangeDifference": 300
  }
}
```

### Update Ranked Terms

```javascript
PATCH /admin/competitive/ranked-terms

Body (send only fields to update):
{
  "winPoints": 120,
  "lossPoints": 15,
  "ratingRangeDifference": 250
}

Response:
{
  "success": true,
  "terms": { /* updated terms */ }
}
```

---

## 📊 Common Admin Tasks

### Start Season 1

```bash
POST /admin/competitive/seasons/create
{
  "startDate": "2026-05-15",
  "numRounds": 12,
  "setupsPerRound": 2
}
```

### Increase Win Points (more exciting)

```bash
PATCH /admin/competitive/ranked-terms
{
  "winPoints": 150,
  "lossPoints": 20
}
```

### Tighten Disqualification (stricter)

```bash
PATCH /admin/competitive/ranked-terms
{
  "maxLeaveCount": 2,
  "maxReportCount": 1
}
```

### Extend Season Length

```bash
POST /admin/competitive/seasons/create
{
  "startDate": "2026-06-01",
  "numRounds": 24,        // 2x longer
  "setupsPerRound": 2
}
```

### Adjust Matchmaking (more lenient)

```bash
PATCH /admin/competitive/ranked-terms
{
  "ratingRangeDifference": 500  // Allow bigger rating gaps
}
```

---

## 🚨 Important Considerations

### Before Creating a Season

- [ ] Verify ≥1 competitive setup is approved (via mod commands)
- [ ] Choose start date 1+ day in advance
- [ ] Ensure no season is currently in progress
- [ ] Confirm round count and setup count

### Modifying Live Season

⚠️ **Cannot edit active season** - Must:
1. Pause the season
2. Make critical changes via database (with care)
3. Resume the season

### Rating Ranges

**Recommended by Player Population:**

```
10-50 players:    ±500 rating range (very loose)
51-200 players:   ±400 rating range
201-1000 players: ±300 rating range (default)
1000+ players:    ±200 rating range (tight)
```

### Points Balance

**Typical monthly earnings (per player):**
```
Casual player (10 games/month):
  6W, 4L = (6 × 100) + (4 × 10) = 640 points

Active player (50 games/month):
  30W, 20L = (30 × 100) + (20 × 10) = 3,200 points

Competitive (200 games/month):
  120W, 80L = (120 × 100) + (80 × 10) = 12,800 points
```

---

## 🔗 Related Files

- **Schema:** [db/schemas.js](db/schemas.js#L892) - CompetitiveSeason, RankedGameTerms
- **Routes:** [routes/adminCompetitive.js](routes/adminCompetitive.js) - Admin endpoints
- **Competitive Routes:** [routes/competitive.js](routes/competitive.js) - Season creation (legacy)
- **Currency Guide:** [CURRENCY.md](CURRENCY.md) - Points system overview
- **Admin Settings:** [docs/ADMIN_SETTINGS.md](docs/ADMIN_SETTINGS.md) - General admin guide

---

## 🐛 Troubleshooting

### Can't Create Season

**Error:** "A competitive season is already in progress"

**Solution:** Pause or complete the existing season first

### Setups Not Found

**Error:** "No competitive setups approved"

**Solution:** Use mod commands to approve setups as "competitive"

### Invalid Date

**Error:** "Start date must be at least one day in the future"

**Solution:** Ensure date is formatted as YYYY-MM-DD and is tomorrow or later

### Changes Not Taking Effect

**Issue:** Updated ranked terms not used in new games

**Solution:** Settings are applied to new games immediately, existing games use old rules

---

## 📞 Support

- Check season status: `GET /admin/competitive/seasons`
- Review current rules: `GET /admin/competitive/ranked-terms`
- All admin actions logged in mod action history
