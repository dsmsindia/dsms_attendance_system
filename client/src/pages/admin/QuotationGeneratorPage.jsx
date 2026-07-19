import { useEffect, useState } from "react";
import {
  getQuotations,
  saveQuotation,
  downloadQuotation,
} from "../../api/quotations";
import {
  Calculator,
  Plus,
  Download,
  Edit,
  Trash2,
  Save,
  Users,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export default function QuotationGeneratorPage() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("list");

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const fiscalYear = `${currentYear.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;

  const emptyForm = {
    refNo: `DSMS/${fiscalYear}/001`,
    date: new Date()
      .toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "."),
    to: "THE MANAGEMENT",
    companyName: "",
    address: "",
    isGstApplied: true,
    manpower: [
      {
        category: "SECURITY GUARD",
        rate: 14000,
        persons: 1,
        dutyDays: "26 Days",
        dutyHours: "08 Hrs.",
        gstPercent: 18,
      },
    ],
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getQuotations();
      setQuotations(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const handleManpowerChange = (index, field, value) => {
    const newManpower = [...formData.manpower];
    newManpower[index][field] = value;
    setFormData({ ...formData, manpower: newManpower });
  };

  const addManpowerRow = () => {
    setFormData({
      ...formData,
      manpower: [
        ...formData.manpower,
        {
          category: "",
          rate: 0,
          persons: 1,
          dutyDays: "26 Days",
          dutyHours: "08 Hrs.",
          gstPercent: 18,
        },
      ],
    });
  };

  const removeManpowerRow = (index) => {
    const newManpower = formData.manpower.filter((_, i) => i !== index);
    setFormData({ ...formData, manpower: newManpower });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveQuotation(formData);
      setView("list");
      loadData();
    } catch (e) {
      alert("Failed to save quotation");
    }
    setLoading(false);
  };

  const handleEdit = (quote) => {
    setFormData(quote);
    setView("form");
  };

  const handleCreateNew = () => {
    setFormData(emptyForm);
    setView("form");
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6 pb-6 min-h-0">
      {/* HEADER SECTION - Responsive stacking on mobile */}
      <div className="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-emerald-600" /> Quotation
            Generator
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create, manage, and download professional PDF quotations.
          </p>
        </div>
        {view === "list" ? (
          <Button
            onClick={handleCreateNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-sm w-full sm:w-auto px-6"
          >
            <Plus className="w-5 h-5 mr-2" /> New Quotation
          </Button>
        ) : (
          <Button
            onClick={() => setView("list")}
            variant="outline"
            className="font-bold h-11 border-slate-300 w-full sm:w-auto px-6"
          >
            Cancel
          </Button>
        )}
      </div>

      {view === "list" && (
        <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[300px]">
          {loading ? (
            <div className="p-10 text-center text-slate-500 font-medium">
              Loading quotations...
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-medium">
              No quotations found. Create your first one above.
            </div>
          ) : (
            <div className="flex-1 overflow-auto w-full relative">
              <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
                <thead className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-700">
                      Client / Company
                    </th>
                    <th className="px-6 py-4 font-bold text-slate-700">
                      Reference Details
                    </th>
                    <th className="px-6 py-4 font-bold text-slate-700 text-center">
                      Personnel
                    </th>
                    <th className="px-6 py-4 text-right font-bold text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr
                      key={q._id}
                      className="border-b last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-base">
                          {q.companyName}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5 max-w-[250px] truncate">
                          {q.address}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700">
                          {q.refNo}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium text-slate-500">
                            {q.date}
                          </span>
                          {q.isGstApplied === false ? (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-600 border-slate-200 shadow-none h-5 text-[10px]"
                            >
                              Non-GST
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-indigo-50 text-indigo-700 border-indigo-200 shadow-none h-5 text-[10px]"
                            >
                              GST Configured
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-700 text-center">
                        {q.manpower.reduce(
                          (acc, curr) => acc + curr.persons,
                          0,
                        )}{" "}
                        Guards
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(q)}
                          className="font-bold text-slate-700 border-slate-300"
                        >
                          <Edit className="w-4 h-4 mr-1.5" /> Edit
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            downloadQuotation(q._id, q.companyName)
                          }
                          className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-sm"
                        >
                          <Download className="w-4 h-4 mr-1.5" /> Download PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "form" && (
        <div className="flex-1 overflow-auto bg-white rounded-xl border shadow-sm">
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 space-y-8 flex flex-col"
          >
            <div className="space-y-4 border-b pb-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-600" /> Client
                  Information
                </h3>
                <div
                  className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 shadow-sm transition-all hover:bg-indigo-100 cursor-pointer w-full sm:w-auto"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      isGstApplied: !formData.isGstApplied,
                    })
                  }
                >
                  <Checkbox
                    id="gst-toggle"
                    checked={formData.isGstApplied !== false}
                    onCheckedChange={(c) =>
                      setFormData({ ...formData, isGstApplied: c })
                    }
                    className="data-[state=checked]:bg-indigo-600 border-indigo-300 pointer-events-none"
                  />
                  <Label
                    htmlFor="gst-toggle"
                    className="font-bold text-indigo-900 cursor-pointer pointer-events-none text-sm"
                  >
                    Apply GST to this Quote
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                    Ref No.
                  </Label>
                  <Input
                    required
                    value={formData.refNo}
                    onChange={(e) =>
                      setFormData({ ...formData, refNo: e.target.value })
                    }
                    className="font-mono bg-slate-50 font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                    Date
                  </Label>
                  <Input
                    required
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="font-mono bg-slate-50 font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                    Addressed To
                  </Label>
                  <Input
                    required
                    value={formData.to}
                    onChange={(e) =>
                      setFormData({ ...formData, to: e.target.value })
                    }
                    placeholder="e.g. THE MANAGEMENT"
                    className="font-bold bg-slate-50"
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-3">
                  <Label className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                    Company Name
                  </Label>
                  <Input
                    required
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    className="font-black text-indigo-900 text-lg h-12"
                    placeholder="Enter full company name..."
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                    Full Address
                  </Label>
                  <Input
                    required
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="font-medium bg-slate-50"
                    placeholder="Enter physical location address..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" /> Manpower
                  Schedule
                </h3>
                <Button
                  type="button"
                  onClick={addManpowerRow}
                  variant="outline"
                  size="sm"
                  className="font-bold text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 shadow-sm w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Category
                </Button>
              </div>

              <div className="space-y-4 pb-2">
                {formData.manpower.map((mp, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all hover:border-slate-300 w-full relative"
                  >
                    <div className="w-full sm:flex-1 sm:min-w-[180px] space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Category Name
                      </Label>
                      <Input
                        required
                        value={mp.category}
                        onChange={(e) =>
                          handleManpowerChange(
                            index,
                            "category",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. SECURITY GUARD"
                        className="font-bold bg-white h-10 w-full"
                      />
                    </div>
                    <div className="w-[48%] sm:w-[120px] space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Rate (Rs)
                      </Label>
                      <Input
                        type="number"
                        required
                        value={mp.rate}
                        onChange={(e) =>
                          handleManpowerChange(
                            index,
                            "rate",
                            Number(e.target.value),
                          )
                        }
                        className="font-mono font-black bg-white text-emerald-700 h-10 w-full"
                      />
                    </div>
                    <div className="w-[48%] sm:w-[90px] space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Persons
                      </Label>
                      <Input
                        type="number"
                        required
                        value={mp.persons}
                        onChange={(e) =>
                          handleManpowerChange(
                            index,
                            "persons",
                            Number(e.target.value),
                          )
                        }
                        className="font-mono bg-white font-bold h-10 w-full"
                      />
                    </div>
                    <div className="w-[48%] sm:w-[110px] space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Days
                      </Label>
                      <Input
                        required
                        value={mp.dutyDays}
                        onChange={(e) =>
                          handleManpowerChange(
                            index,
                            "dutyDays",
                            e.target.value,
                          )
                        }
                        className="bg-white text-sm font-medium h-10 w-full"
                      />
                    </div>
                    <div className="w-[48%] sm:w-[110px] space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Hours
                      </Label>
                      <Input
                        required
                        value={mp.dutyHours}
                        onChange={(e) =>
                          handleManpowerChange(
                            index,
                            "dutyHours",
                            e.target.value,
                          )
                        }
                        className="bg-white text-sm font-medium h-10 w-full"
                      />
                    </div>

                    {formData.isGstApplied !== false && (
                      <div className="w-[48%] sm:w-[90px] space-y-1.5">
                        <Label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                          GST %
                        </Label>
                        <Input
                          type="number"
                          required
                          value={mp.gstPercent}
                          onChange={(e) =>
                            handleManpowerChange(
                              index,
                              "gstPercent",
                              Number(e.target.value),
                            )
                          }
                          className="bg-white text-sm font-bold text-indigo-700 h-10 w-full"
                        />
                      </div>
                    )}

                    {formData.manpower.length > 1 && (
                      <div className="w-full sm:w-auto flex justify-end mt-2 sm:mt-0">
                        <Button
                          type="button"
                          onClick={() => removeManpowerRow(index)}
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-red-500 border-red-200 bg-red-50 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t flex justify-end shrink-0">
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 w-full sm:w-auto px-8 text-lg shadow-md transition-all active:scale-95"
              >
                {loading ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" /> Save & Return
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
