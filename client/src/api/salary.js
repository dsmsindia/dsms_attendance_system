import api from "./axios";

export const getSalarySheet = (year, month, projectId) =>
  api
    .get("/salary/sheet", { params: { year, month, projectId } })
    .then((r) => r.data);

export const updateSalaryRecord = (data) =>
  api.post("/salary/update", data).then((r) => r.data);

const formatName = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("_");
};

export const downloadSlip = async (
  guardId,
  year,
  month,
  projectId,
  guardName = "",
) => {
  const response = await api.get("/salary/download-slip", {
    params: { guardId, year, month, projectId },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;

  const monthNameStr = new Date(year, month).toLocaleString("en-US", {
    month: "long",
  });
  const formattedName = guardName ? `_${formatName(guardName)}` : "";

  link.setAttribute(
    "download",
    `Salary_Slip_${monthNameStr}_${year}${formattedName}.pdf`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const downloadSalaryExcel = async (year, month, projectId, fileName) => {
  const response = await api.get("/salary/download-excel", {
    params: { year, month, projectId },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;

  // Browser Override
  link.setAttribute(
    "download",
    fileName || `SalarySheet_${year}_${month}.xlsx`,
  );

  document.body.appendChild(link);
  link.click();
  link.remove();
};
