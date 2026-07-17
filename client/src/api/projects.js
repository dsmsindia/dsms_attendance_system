import api from "./axios";

export const getProjects = () => api.get("/projects").then((r) => r.data);
export const createProject = (data) =>
  api.post("/projects", data).then((r) => r.data);
export const updateWeeklyOff = (id, weeklyOff) =>
  api.patch(`/projects/${id}/weekly-off`, { weeklyOff }).then((r) => r.data);
export const addHoliday = (id, holiday) =>
  api.post(`/projects/${id}/holidays`, holiday).then((r) => r.data);
export const deleteHoliday = (id, date) =>
  api.delete(`/projects/${id}/holidays/${date}`).then((r) => r.data);
export const getProjectUsage = (id) =>
  api.get(`/projects/${id}/usage`).then((r) => r.data);
export const deleteProject = (id) =>
  api.delete(`/projects/${id}`).then((r) => r.data);
export const updateProject = async (id, name) => {
  const response = await api.put(`/projects/${id}`, { name });
  return response.data;
};
