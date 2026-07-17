import api from "./axios";

export const getGuardMonth = (guardId, year, month, projectId = "all") =>
  api
    .get(`/attendance/${guardId}`, {
      params: {
        year,
        month,
        projectId,
        _t: new Date().getTime(), // Cache-buster
      },
    })
    .then((r) => r.data);

export const markDay = (date, status, projectId) =>
  api.post("/attendance/mark", { date, status, projectId }).then((r) => r.data);

// NEW: Admin API Call
export const updateGuardAttendanceByAdmin = (data) =>
  api.put("/attendance/admin/update", data).then((r) => r.data);
