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

export async function getShopInfo() {
  const response = await axios.get("/api/shop/info");
  return response.data;
}
