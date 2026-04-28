export const drawerWidth = 340;

export const menuGroups = [
  {
    key: "overview",
    label: "Control Center",
    icon: "solar:widget-5-bold-duotone",
    description: "Fast operational visibility",
    items: [
      {
        key: "overview-home",
        label: "Overview",
        path: "/admin/overview",
        description: "Signals, alerts, and activity",
      },
    ],
  },
  {
    key: "users",
    label: "User Management",
    icon: "solar:users-group-rounded-bold-duotone",
    description: "Accounts, permissions, trust",
    items: [
      {
        key: "users-directory",
        label: "User Directory",
        path: "/admin/users/directory",
        description: "Search and manage member accounts",
      },
      {
        key: "users-roles",
        label: "Roles & Access",
        path: "/admin/users/roles-access",
        description: "Permission levels and team access",
      },
      {
        key: "users-trust",
        label: "Trust Signals",
        path: "/admin/users/trust-signals",
        description: "Reports, flags, and risk overview",
      },
    ],
  },
  {
    key: "games",
    label: "Game Operations",
    icon: "solar:gamepad-bold-duotone",
    description: "Lobbies, queue health, intervention",
    items: [
      {
        key: "games-live",
        label: "Live Games",
        path: "/admin/games/live",
        description: "Monitor active and paused matches",
      },
      {
        key: "games-queues",
        label: "Queue Health",
        path: "/admin/games/queue-health",
        description: "Traffic, fill rate, and wait time",
      },
      {
        key: "games-incidents",
        label: "Incidents",
        path: "/admin/games/incidents",
        description: "Manual review and intervention log",
      },
      {
        key: "games-competitive-setups",
        label: "Competitive Setups",
        path: "/admin/games/competitive-setups",
        description: "Approve setups for competitive play",
      },
      {
        key: "games-competitive-seasons",
        label: "Competitive Seasons",
        path: "/admin/games/competitive-seasons",
        description: "Create and manage ranked seasons",
      },
      {
        key: "games-ranked-terms",
        label: "Ranked Rules",
        path: "/admin/games/ranked-terms",
        description: "Scoring, timeouts, and matchmaking",
      },
    ],
  },
  {
    key: "catalog",
    label: "Store & Assets",
    icon: "solar:shop-bold-duotone",
    description: "Price items and avatar inventory",
    items: [
      {
        key: "catalog-prices",
        label: "Price Items",
        path: "/admin/catalog/price-items",
        description: "Currencies, bundles, and pricing",
      },
      {
        key: "catalog-avatars",
        label: "Avatars",
        path: "/admin/catalog/avatars",
        description: "User profile avatars",
      },
    ],
  },
  {
    key: "settings",
    label: "Admin Settings",
    icon: "solar:tuning-square-bold-duotone",
    description: "Platform rules and automation",
    items: [
      {
        key: "settings-general",
        label: "General",
        path: "/admin/settings/general",
        description: "Brand, operations, and site defaults",
      },
      {
        key: "settings-gamecatalogs",
        label: "Game Catalogs",
        path: "/admin/settings/gamecatalogs",
        description: "Titles, slugs, and game logo assets",
      },
      {
        key: "settings-payment-methods",
        label: "Payment Methods",
        path: "/settings/payment-methods",
        description: "API keys, webhooks, and provider config",
      },
      {
        key: "settings-security",
        label: "Security",
        path: "/admin/settings/security",
        description: "Policies, reviews, and protection",
      },
      {
        key: "settings-automation",
        label: "Automation",
        path: "/admin/settings/automation",
        description: "Rules, triggers, and staff alerts",
      },
    ],
  },
];

export const allPages = menuGroups.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    groupKey: group.key,
    groupLabel: group.label,
    groupIcon: group.icon,
  }))
);

export function findPageByPath(pathname) {
  return allPages.find((page) => page.path === pathname) || allPages[0];
}

export function createDefaultOpenGroups() {
  return menuGroups.reduce((accumulator, group) => {
    accumulator[group.key] = group.key === "overview";
    return accumulator;
  }, {});
}
