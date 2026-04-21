import axios from "axios";

export async function getAdminSession() {
  const response = await axios.get("/api/admin/session");
  return response.data;
}

export async function getAdminOverview() {
  const response = await axios.get("/api/admin/overview");
  return response.data;
}

export async function getAdminUsers() {
  const response = await axios.get("/api/admin/users");
  return response.data;
}

export async function updateUserAdminAccess(userId, admin) {
  const response = await axios.patch(`/api/admin/users/${userId}/admin`, {
    admin,
  });
  return response.data;
}

export async function getAdminGames() {
  const response = await axios.get("/api/admin/games");
  return response.data;
}

export async function getAdminQueues() {
  const response = await axios.get("/api/admin/games/queues");
  return response.data;
}

export async function getAdminIncidents() {
  const response = await axios.get("/api/admin/games/incidents");
  return response.data;
}

export async function getAdminAvatars() {
  const response = await axios.get("/api/admin/avatars");
  return response.data;
}

export async function getAdminSettingsSummary() {
  const response = await axios.get("/api/admin/settings/summary");
  return response.data;
}

export async function getAdminGeneralSettings() {
  const response = await axios.get("/api/admin/settings/general");
  return response.data;
}

export async function getAdminManagedGameCatalogs() {
  const response = await axios.get("/api/admin/settings/gamecatalogs");
  return response.data;
}

export async function createAdminManagedGameCatalog(payload) {
  const response = await axios.post("/api/admin/settings/gamecatalogs", payload);
  return response.data;
}

export async function updateAdminManagedGameCatalog(key, payload) {
  const response = await axios.patch(
    `/api/admin/settings/gamecatalogs/${encodeURIComponent(key)}`,
    payload
  );
  return response.data;
}

export async function toggleAdminManagedGameCatalogHidden(key, hidden) {
  const response = await axios.patch(
    `/api/admin/settings/gamecatalogs/${encodeURIComponent(key)}/hidden`,
    { hidden }
  );
  return response.data;
}

export async function uploadAdminManagedGameCatalogLogo(key, file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await axios.post(
    `/api/admin/settings/gamecatalogs/${encodeURIComponent(key)}/logo`,
    formData
  );
  return response.data;
}

export async function removeAdminManagedGameCatalogLogo(key) {
  const response = await axios.delete(
    `/api/admin/settings/gamecatalogs/${encodeURIComponent(key)}/logo`
  );
  return response.data;
}

export async function deleteAdminManagedGameCatalog(key) {
  const response = await axios.delete(
    `/api/admin/settings/gamecatalogs/${encodeURIComponent(key)}`
  );
  return response.data;
}

export async function uploadAdminPlatformLogo(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await axios.post(
    "/api/admin/settings/branding/platform-logo",
    formData
  );
  return response.data;
}

export async function removeAdminPlatformLogo() {
  const response = await axios.delete("/api/admin/settings/branding/platform-logo");
  return response.data;
}

export async function uploadAdminBannerImage(key, file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await axios.post(
    `/api/admin/settings/branding/banners/${encodeURIComponent(key)}`,
    formData
  );
  return response.data;
}

export async function removeAdminBannerImage(key) {
  const response = await axios.delete(
    `/api/admin/settings/branding/banners/${encodeURIComponent(key)}`
  );
  return response.data;
}

export async function uploadAdminGameLogo(gameType, file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await axios.post(
    `/api/admin/settings/branding/game-logos/${encodeURIComponent(gameType)}`,
    formData
  );
  return response.data;
}

export async function removeAdminGameLogo(gameType) {
  const response = await axios.delete(
    `/api/admin/settings/branding/game-logos/${encodeURIComponent(gameType)}`
  );
  return response.data;
}

export async function getShopInfo() {
  const response = await axios.get("/api/shop/info");
  return response.data;
}
