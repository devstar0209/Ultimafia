import OverviewPage from "./OverviewPage";
import PriceItemsPage from "./catalog/PriceItemsPage";
import AvatarsPage from "./catalog/AvatarsPage";
import EmotesPage from "./catalog/EmotesPage";
import GameIncidentsPage from "./games/GameIncidentsPage";
import DailyChangesPage from "./games/DailyChangesPage";
import LiveGamesPage from "./games/LiveGamesPage";
import QueueHealthPage from "./games/QueueHealthPage";
import CompetitiveSetupsPage from "./games/CompetitiveSetupsPage";
import AutomationSettingsPage from "./settings/AutomationSettingsPage";
import CompetitiveSeasonsPage from "./settings/CompetitiveSeasonsPage";
import GameSettingsPage from "./settings/GameSettingsPage";
import GeneralSettingsPage from "./settings/GeneralSettingsPage";
import PaymentMethodsSettingsPage from "./settings/PaymentMethodsSettingsPage";
import RankedTermsPage from "./settings/RankedTermsPage";
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
  "games-competitive-setups": CompetitiveSetupsPage,
  "games-daily-changes": DailyChangesPage,
  "games-competitive-seasons": CompetitiveSeasonsPage,
  "games-ranked-terms": RankedTermsPage,
  "catalog-prices": PriceItemsPage,
  "catalog-avatars": AvatarsPage,
  "catalog-emotes": EmotesPage,
  "settings-general": GeneralSettingsPage,
  "settings-gamecatalogs": GameSettingsPage,
  "settings-payment-methods": PaymentMethodsSettingsPage,
  "settings-security": SecuritySettingsPage,
  "settings-automation": AutomationSettingsPage,
};

export default pageRegistry;
