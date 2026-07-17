import api from "./axios";

export const getReportGuards = (year, month, projectId) =>
  api
    .get("/reports/guards", { params: { year, month, projectId } })
    .then((r) => r.data);

export const downloadExcelReport = async (
  startDate,
  endDate,
  projectId,
  fileName,
) => {
  const response = await api.get("/reports/excel", {
    // Passes the dates seamlessly to the backend overload handler
    params: { year: startDate, month: endDate, projectId },
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);

  // This explicitly forces the browser to use our generated filename!
  link.download = fileName || "Attendance_Report.xlsx";

  document.body.appendChild(link);
  link.click();
  link.remove();
};
