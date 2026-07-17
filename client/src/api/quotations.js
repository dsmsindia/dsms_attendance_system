import api from "./axios";

export const getQuotations = () => api.get("/quotations").then(r => r.data);

export const saveQuotation = (data) => api.post("/quotations", data).then(r => r.data);

export const downloadQuotation = async (id, companyName) => {
  const response = await api.get(`/quotations/${id}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  
  const safeName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.setAttribute("download", `Quotation_${safeName}.pdf`);
  
  document.body.appendChild(link);
  link.click();
  link.remove();
};