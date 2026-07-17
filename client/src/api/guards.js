import api from "./axios";

export const getGuards = () => api.get("/guards").then((r) => r.data);
export const createGuard = (data) =>
  api.post("/guards", data).then((r) => r.data);
export const updateGuard = (id, data) =>
  api.patch(`/guards/${id}`, data).then((r) => r.data);
export const deactivateGuard = (id) =>
  api.patch(`/guards/${id}/deactivate`).then((r) => r.data);
export const reactivateGuard = (id) =>
  api.patch(`/guards/${id}/reactivate`).then((r) => r.data);
