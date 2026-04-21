import OverviewPage from "./OverviewPage";
import PriceItemsPage from "./catalog/PriceItemsPage";
import AvatarsPage from "./catalog/AvatarsPage";
import GameIncidentsPage from "./games/GameIncidentsPage";
import LiveGamesPage from "./games/LiveGamesPage";
import QueueHealthPage from "./games/QueueHealthPage";
import AutomationSettingsPage from "./settings/AutomationSettingsPage";
import GameSettingsPage from "./settings/GameSettingsPage";
import GeneralSettingsPage from "./settings/GeneralSettingsPage";
import SecuritySettingsPage from "./settings/SecuritySettingsPage";
import RolesAccessPage from "./users/RolesAccessPage";
import TrustSignalsPage from "./users/TrustSignalsPage";
import UsersDirectoryPage from "./users/UsersDirectoryPage";

const pageRegistry = {
  "overview-home": OverviewPage,
  "users-directory": UsersDirectoryPage,
  "users-roles": RolesAccessPage,
  "users-trust": TrustSignalsPage,
  "games-live": LiveGamesPage,
  "games-queues": QueueHealthPage,
  "games-incidents": GameIncidentsPage,
  "catalog-prices": PriceItemsPage,
  "catalog-avatars": AvatarsPage,
  "settings-general": GeneralSettingsPage,
  "settings-gamecatalogs": GameSettingsPage,
  "settings-security": SecuritySettingsPage,
  "settings-automation": AutomationSettingsPage,
};

export default pageRegistry;
