export const adminStats = [
  {
    label: "Active Users",
    value: "12,480",
    delta: "+8.2%",
    tone: "success",
    detail: "Compared with last 7 days",
  },
  {
    label: "Open Tasks",
    value: "27",
    delta: "-9%",
    tone: "warning",
    detail: "Across moderation, store, and ops",
  },
  {
    label: "Live Games",
    value: "214",
    delta: "+16",
    tone: "info",
    detail: "Peak concurrency in the last hour",
  },
  {
    label: "Pending Assets",
    value: "18",
    delta: "+4",
    tone: "error",
    detail: "Avatars and storefront assets in review",
  },
];

export const users = [
  {
    id: "USR-1042",
    name: "SkyHarbor",
    email: "skyharbor@ultimafia.gg",
    role: "Moderator",
    status: "Active",
    reports: 1,
    trust: 94,
    lastSeen: "2 minutes ago",
    region: "NA East",
    scope: "User actions, reports, appeals",
    riskBand: "Low",
    lastAction: "Reviewed appeal",
  },
  {
    id: "USR-2108",
    name: "NovaTrace",
    email: "novatrace@ultimafia.gg",
    role: "Player",
    status: "Flagged",
    reports: 5,
    trust: 61,
    lastSeen: "11 minutes ago",
    region: "EU West",
    scope: "Standard player access",
    riskBand: "High",
    lastAction: "Muted in lobby",
  },
  {
    id: "USR-3877",
    name: "MossCipher",
    email: "mosscipher@ultimafia.gg",
    role: "Creative Admin",
    status: "Review",
    reports: 0,
    trust: 88,
    lastSeen: "1 hour ago",
    region: "APAC",
    scope: "Avatar publishing, art approvals",
    riskBand: "Low",
    lastAction: "Submitted collection",
  },
  {
    id: "USR-4441",
    name: "IronLark",
    email: "ironlark@ultimafia.gg",
    role: "Player",
    status: "Suspended",
    reports: 8,
    trust: 24,
    lastSeen: "Yesterday",
    region: "NA West",
    scope: "Suspended account",
    riskBand: "Critical",
    lastAction: "72h suspension",
  },
  {
    id: "USR-5010",
    name: "AshVale",
    email: "ashvale@ultimafia.gg",
    role: "Commerce Admin",
    status: "Active",
    reports: 0,
    trust: 91,
    lastSeen: "6 minutes ago",
    region: "EU West",
    scope: "Price items, bundles, release windows",
    riskBand: "Low",
    lastAction: "Priced bundle",
  },
];

export const games = [
  {
    id: "GAME-9921",
    title: "Ranked Mafia - High Stakes",
    host: "SkyHarbor",
    players: 13,
    state: "Running",
    health: "Healthy",
    region: "NA East",
    incident: "No active incident. Queue health stable.",
  },
  {
    id: "GAME-9927",
    title: "Turbo Werewolf",
    host: "FoxSignal",
    players: 8,
    state: "Waiting",
    health: "Needs Review",
    region: "EU West",
    incident: "Repeated host restarts triggered soft moderation notice.",
  },
  {
    id: "GAME-9934",
    title: "Icons Playtest Lobby",
    host: "MossCipher",
    players: 5,
    state: "Running",
    health: "Healthy",
    region: "APAC",
    incident: "No issue, monitored because of new feature flags.",
  },
  {
    id: "GAME-9939",
    title: "Late Night Chaos",
    host: "NovaTrace",
    players: 16,
    state: "Paused",
    health: "Investigating",
    region: "NA West",
    incident: "Manual pause after collusion claims and report cluster.",
  },
];

export const gameQueues = [
  {
    name: "Ranked Mafia",
    mode: "Competitive",
    players: 142,
    wait: "1m 12s",
    state: "Running",
    region: "NA East",
  },
  {
    name: "Turbo Queue",
    mode: "Casual",
    players: 48,
    wait: "2m 41s",
    state: "Review",
    region: "EU West",
  },
  {
    name: "Custom Lobbies",
    mode: "Community",
    players: 86,
    wait: "0m 49s",
    state: "Healthy",
    region: "Global",
  },
  {
    name: "Late Night Ranked",
    mode: "Competitive",
    players: 21,
    wait: "4m 08s",
    state: "Needs Review",
    region: "APAC",
  },
];

export const priceItems = [
  {
    name: "Starter Coin Pack",
    sku: "COIN-START-01",
    type: "Currency",
    price: "$4.99",
    currency: "USD",
    status: "Approved",
  },
  {
    name: "Nightshift Bundle",
    sku: "BNDL-NIGHT-04",
    type: "Bundle",
    price: "$12.99",
    currency: "USD",
    status: "Pending",
  },
  {
    name: "Season Pass",
    sku: "PASS-S24-01",
    type: "Pass",
    price: "$19.99",
    currency: "USD",
    status: "Review",
  },
  {
    name: "Moderator Support Pack",
    sku: "SUPPORT-03",
    type: "Supporter",
    price: "$8.99",
    currency: "USD",
    status: "Hidden",
  },
];

export const avatars = [
  {
    id: "AV-101",
    name: "Solar Judge",
    collection: "Celestial Court",
    artist: "MossCipher",
    rarity: "Epic",
    status: "Pending",
    updated: "Today",
  },
  {
    id: "AV-102",
    name: "Wiretap Crow",
    collection: "Midnight Signals",
    artist: "AshVale",
    rarity: "Rare",
    status: "Approved",
    updated: "Today",
  },
  {
    id: "AV-103",
    name: "Velvet Oracle",
    collection: "Celestial Court",
    artist: "PixelRain",
    rarity: "Legendary",
    status: "Changes Requested",
    updated: "Yesterday",
  },
  {
    id: "AV-104",
    name: "Dawn Executioner",
    collection: "Crimson Archive",
    artist: "StoneMint",
    rarity: "Epic",
    status: "Pending",
    updated: "Yesterday",
  },
];

export const avatarCollections = [
  {
    name: "Celestial Court",
    count: "12 avatars",
    theme: "Mythic courtroom designs with gold and dusk tones",
    releaseWindow: "Release window: April 26",
  },
  {
    name: "Midnight Signals",
    count: "8 avatars",
    theme: "Noir intelligence and urban surveillance visuals",
    releaseWindow: "Release window: May 02",
  },
  {
    name: "Crimson Archive",
    count: "10 avatars",
    theme: "Dark ceremonial roster for prestige cosmetics",
    releaseWindow: "Release window: May 10",
  },
];

export const settingsModules = [
  {
    title: "Site Branding",
    description: "Primary labels, announcement defaults, and admin-facing copy.",
    status: "Approved",
  },
  {
    title: "Queue Messages",
    description: "Default text for delay notices, maintenance, and promotions.",
    status: "Review",
  },
  {
    title: "Store Windows",
    description: "Release timing for price items, bundles, and avatar collections.",
    status: "Pending",
  },
  {
    title: "Regional Defaults",
    description: "Per-region moderation visibility and queue configuration.",
    status: "Approved",
  },
];

export const moderationPolicies = [
  {
    name: "Dual Approval For Suspensions",
    scope: "Users",
    severity: "High",
    owner: "Trust & Safety",
    status: "Approved",
  },
  {
    name: "Forced Queue Pause Threshold",
    scope: "Games",
    severity: "Medium",
    owner: "Live Ops",
    status: "Review",
  },
  {
    name: "Price Change Confirmation",
    scope: "Store",
    severity: "High",
    owner: "Commerce Ops",
    status: "Approved",
  },
  {
    name: "Asset Deletion Lock",
    scope: "Avatars",
    severity: "Critical",
    owner: "Creative Admin",
    status: "Pending",
  },
];

export const automationRules = [
  {
    name: "Flag Repeat Abuse Cluster",
    trigger: "3 reports in 20 minutes",
    owner: "Trust & Safety",
    impact: "Creates a high-priority review case",
    status: "Approved",
  },
  {
    name: "Queue Wait Alert",
    trigger: "Wait time above 3 minutes",
    owner: "Live Ops",
    impact: "Pages operators and suggests queue merge",
    status: "Active",
  },
  {
    name: "Price Release Scheduler",
    trigger: "Scheduled publish window",
    owner: "Commerce Ops",
    impact: "Publishes approved items automatically",
    status: "Review",
  },
  {
    name: "Avatar SLA Reminder",
    trigger: "Pending longer than 24 hours",
    owner: "Creative Admin",
    impact: "Notifies asset reviewers in staff channel",
    status: "Active",
  },
];

export const alerts = [
  "Queue waits in APAC ranked are rising above target.",
  "Two price item updates are waiting for final approval.",
  "Avatar review queue has crossed the daily SLA threshold.",
];

export const activityFeed = [
  {
    title: "Suspension applied",
    description: "IronLark received a 72-hour suspension after repeat chat abuse.",
    when: "8 minutes ago",
  },
  {
    title: "Bundle staged",
    description: "Nightshift Bundle pricing was updated and scheduled for review.",
    when: "15 minutes ago",
  },
  {
    title: "Game manually paused",
    description: "Late Night Chaos was paused while moderators review collusion claims.",
    when: "16 minutes ago",
  },
  {
    title: "Avatar approved",
    description: "Wiretap Crow cleared content review and is ready for storefront publishing.",
    when: "34 minutes ago",
  },
];
