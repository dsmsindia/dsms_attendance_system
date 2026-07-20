import { useEffect, useState } from "react";
import { getProjects } from "../../api/projects";
import {
  getSalarySheet,
  updateSalaryRecord,
  downloadSlip,
  downloadSalaryExcel,
} from "../../api/salary";
import {
  Download,
  Calendar,
  Building2,
  FileText,
  ShieldAlert,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function SalarySheetPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [projectId, setProjectId] = useState("all");
  const [projects, setProjects] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [excelDownloading, setExcelDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    loadSheet();
  }, [year, month, projectId]);

  async function loadSheet() {
    setLoading(true);
    try {
      const data = await getSalarySheet(year, month, projectId);
      setRows(data.map((r) => ({ ...r, saving: false, downloading: false })));
    } catch (err) {
      setRows([]);
    }
    setLoading(false);
  }

  const handleEditChange = (index, field, value) => {
    const val = value === "" ? "" : Number(value);
    const newRows = [...rows];
    const m = newRows[index].math;

    if (["bonus", "edAmount", "advance", "othersDeduction"].includes(field)) {
      m[field] = val;
    } else {
      m.overrides = m.overrides || {};
      m.overrides[field] = val;
      m[field] = val;
    }

    const safeVal = (v) => Number(v) || 0;
    const safeO = (key, fallback) =>
      m.overrides && m.overrides[key] !== undefined
        ? Number(m.overrides[key])
        : fallback;

    const daysInMonth = safeO("daysInMonth", m.daysInMonth);
    const presentDays = safeO("presentDays", m.presentDays);
    const leaveAdjustments = safeO("leaveAdjustments", m.leaveAdjustments);
    const extraDuty = safeO("extraDuty", m.extraDuty);

    m.totalDuty = safeO("totalDuty", presentDays + leaveAdjustments);

    const minWages = safeO("minWages", m.minWages);

    const preciseDailyRate = minWages / daysInMonth;
    m.grossWages = safeO(
      "grossWages",
      m.totalDuty === daysInMonth
        ? minWages
        : Math.round(preciseDailyRate * m.totalDuty),
    );

    m.perDayAmount = safeO("perDayAmount", Math.round(preciseDailyRate));
    m.extraDutyPay = safeO(
      "extraDutyPay",
      Math.round(preciseDailyRate * extraDuty),
    );

    m.basicPay = safeO("basicPay", Math.round(m.grossWages * 0.5));
    m.hra = safeO("hra", Math.round(m.grossWages * 0.2));
    m.conveyance = safeO("conveyance", Math.round(m.grossWages * 0.1));
    m.washing = safeO("washing", Math.round(m.grossWages * 0.1));
    m.additional = safeO(
      "additional",
      Math.round(
        m.grossWages - (m.basicPay + m.hra + m.conveyance + m.washing),
      ),
    );

    m.epfEmp = m.skipPfEsic
      ? 0
      : safeO("epfEmp", Math.round(m.basicPay * 0.12));
    m.esicEmp = m.skipPfEsic
      ? 0
      : safeO("esicEmp", Math.round(m.grossWages * 0.0075));

    let calcPTax = 0;
    if (m.grossWages > 40000) calcPTax = 200;
    else if (m.grossWages > 25000) calcPTax = 150;
    else if (m.grossWages > 15000) calcPTax = 130;
    else if (m.grossWages > 10000) calcPTax = 110;
    m.pTax = safeO("pTax", calcPTax);

    m.epfEmployer = m.skipPfEsic
      ? 0
      : safeO("epfEmployer", Math.round(m.basicPay * 0.12));
    m.adminCharges = m.skipPfEsic
      ? 0
      : safeO("adminCharges", Math.round(m.basicPay * 0.01));
    m.esicEmployer = m.skipPfEsic
      ? 0
      : safeO("esicEmployer", Math.round(m.grossWages * 0.0325));

    m.ctc = Math.round(
      m.grossWages +
        m.extraDutyPay +
        m.epfEmployer +
        m.adminCharges +
        m.esicEmployer,
    );
    m.netSalary = Math.round(
      m.grossWages +
        m.extraDutyPay +
        safeVal(m.bonus) +
        safeVal(m.edAmount) -
        (m.epfEmp +
          m.esicEmp +
          m.pTax +
          safeVal(m.advance) +
          safeVal(m.othersDeduction)),
    );

    setRows(newRows);
  };

  const handleWaivePfEsicChange = (index, checked) => {
    const newRows = [...rows];
    const m = newRows[index].math;
    m.skipPfEsic = checked;

    if (checked) {
      m.epfEmp = 0;
      m.esicEmp = 0;
      m.epfEmployer = 0;
      m.adminCharges = 0;
      m.esicEmployer = 0;
    } else {
      m.epfEmp = Math.round(m.basicPay * 0.12);
      m.esicEmp = Math.round(m.grossWages * 0.0075);
      m.epfEmployer = Math.round(m.basicPay * 0.12);
      m.adminCharges = Math.round(m.basicPay * 0.01);
      m.esicEmployer = Math.round(m.grossWages * 0.0325);
    }
    const safeVal = (v) => Number(v) || 0;
    m.netSalary = Math.round(
      m.grossWages +
        m.extraDutyPay +
        safeVal(m.bonus) +
        safeVal(m.edAmount) -
        (m.epfEmp +
          m.esicEmp +
          m.pTax +
          safeVal(m.advance) +
          safeVal(m.othersDeduction)),
    );
    m.ctc = Math.round(
      m.grossWages +
        m.extraDutyPay +
        m.epfEmployer +
        m.adminCharges +
        m.esicEmployer,
    );

    setRows(newRows);
    handleBlurSave(index, { skipPfEsic: checked });
  };

  const handleBlurSave = async (index, overrides = {}) => {
    const row = rows[index];
    try {
      await updateSalaryRecord({
        guardId: row.guard._id,
        year,
        month,
        projectId: row.projectId,
        bonus: Number(row.math.bonus) || 0,
        edAmount: Number(row.math.edAmount) || 0,
        advance: Number(row.math.advance) || 0,
        othersDeduction: Number(row.math.othersDeduction) || 0,
        isPaid: overrides.isPaid !== undefined ? overrides.isPaid : row.isPaid,
        skipPfEsic:
          overrides.skipPfEsic !== undefined
            ? overrides.skipPfEsic
            : row.math.skipPfEsic,
        overrides: row.math.overrides || {},
      });
    } catch (e) {
      alert("Failed to save changes.");
    }
  };

  const handleCheckboxChange = (index, checked) => {
    const newRows = [...rows];
    newRows[index].isPaid = checked;
    setRows(newRows);
    handleBlurSave(index, { isPaid: checked });
  };

  const handleDownloadSlip = async (index) => {
    const row = rows[index];
    const newRows = [...rows];
    newRows[index].downloading = true;
    setRows(newRows);
    try {
      await downloadSlip(row.guard._id, year, month);
    } catch (e) {
      alert("Failed to download PDF.");
    }
    const updatedRows = [...rows];
    updatedRows[index].downloading = false;
    setRows(updatedRows);
  };

  const handleExcelDownload = async () => {
    setExcelDownloading(true);
    try {
      let safeProjectName = "All_Projects";
      if (projectId === "office") safeProjectName = "Office";
      else if (projectId !== "all") {
        const p = projects.find((p) => String(p._id) === String(projectId));
        if (p) safeProjectName = p.name.replace(/\s+/g, "_");
      }
      await downloadSalaryExcel(
        year,
        month,
        projectId,
        `SalarySheet_${MONTH_NAMES[month]}_${year}_${safeProjectName}.xlsx`,
      );
    } catch (e) {
      alert("Excel download failed.");
    }
    setExcelDownloading(false);
  };

  const activeProjects = projects.filter((p) => p.active);

  const Th = ({ children, className }) => (
    <th
      className={`p-2 text-center text-[10px] font-bold text-slate-700 bg-slate-200 border-r border-b whitespace-nowrap ${className || ""}`}
    >
      {children}
    </th>
  );

  const Td = ({ children, className }) => (
    <td
      className={`p-2 text-center text-xs border-r border-b text-slate-800 whitespace-nowrap ${className || ""}`}
    >
      {children}
    </td>
  );

  const fmt = (val, decimals = 0) => (Number(val) || 0).toFixed(decimals);

  const EditCell = ({
    val,
    field,
    index,
    m,
    isDec = false,
    minWidth = "w-12",
  }) => {
    if (isEditing) {
      return (
        <input
          type="number"
          value={m.overrides?.[field] ?? m[field] ?? ""}
          onChange={(e) => handleEditChange(index, field, e.target.value)}
          onBlur={() => handleBlurSave(index)}
          className={`${minWidth} h-6 text-center text-[10px] font-bold border border-indigo-300 rounded outline-none focus:border-indigo-600 bg-indigo-50`}
          placeholder="-"
        />
      );
    }
    return <span>{fmt(val, isDec ? 2 : 0)}</span>;
  };

  return (
    <div className="flex-1 w-full flex flex-col space-y-4 sm:space-y-6 min-h-0">
      <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Salary Sheet
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Automated salary calculation & slip generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto bg-white p-3 rounded-xl border shadow-sm">
          <Select
            value={MONTH_NAMES[month]}
            onValueChange={(val) => setMonth(MONTH_NAMES.indexOf(val))}
          >
            <SelectTrigger className="w-full sm:w-[130px] bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={year.toString()}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-full sm:w-[90px] bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(
                (y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>

          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-full sm:w-[350px] h-11 bg-slate-50 font-bold text-slate-700 text-left truncate">
              <div className="flex items-center truncate">
                <span className="truncate">
                  {projectId === "all"
                    ? "ALL PROJECTS"
                    : projectId === "office"
                      ? "OFFICE"
                      : projects.find(
                          (p) => String(p._id) === String(projectId),
                        )?.name || "Project"}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="max-w-[95vw] sm:max-w-md max-h-[60vh]">
              <SelectItem value="all" className="font-bold">
                ALL PROJECTS
              </SelectItem>
              <SelectItem value="office" className="font-bold text-blue-700">
                OFFICE PERSONNEL
              </SelectItem>
              {activeProjects.map((p) => (
                <SelectItem
                  key={p._id}
                  value={String(p._id)}
                  className="font-medium"
                >
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
            className={`font-bold border-slate-300 shadow-sm ${isEditing ? "bg-amber-100 text-amber-900 border-amber-300" : "hover:bg-slate-50"}`}
          >
            {isEditing ? (
              <>
                <Check className="w-4 h-4 mr-2" /> Done
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4 mr-2" /> Edit All
              </>
            )}
          </Button>

          <Button
            onClick={handleExcelDownload}
            disabled={excelDownloading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold ml-auto shadow-md"
          >
            {excelDownloading ? (
              "Processing..."
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" /> Download Excel
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
            <ShieldAlert className="h-12 w-12 text-slate-300 mb-2" />
            <p className="text-slate-500 font-semibold text-lg">
              No guard data in scope
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto w-full relative max-h-[75vh]">
            <table className="w-full text-sm min-w-max border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-[50] shadow-sm bg-white">
                <tr>
                  <th className="bg-slate-300 border-r border-slate-400 border-b p-1 text-xs font-black text-slate-800 sticky left-0 z-[80] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] md:w-[220px] md:min-w-[220px]">
                    EMPLOYEE
                  </th>
                  <th
                    colSpan="2"
                    className="bg-slate-300 border-r-2 border-slate-400 border-b p-1 text-xs font-black text-slate-800 md:sticky md:left-[220px] z-[70] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                  >
                    ROLE & PROJECT
                  </th>
                  <th
                    colSpan="2"
                    className="bg-slate-200 border-r border-b p-1 text-[10px] font-bold text-slate-600"
                  >
                    IDENTIFICATION
                  </th>
                  <th
                    colSpan="8"
                    className="bg-indigo-100 border-r border-b p-1 text-[10px] font-bold text-indigo-800"
                  >
                    ATTENDANCE
                  </th>
                  <th
                    colSpan="9"
                    className="bg-emerald-100 border-r border-b p-1 text-[10px] font-bold text-emerald-800"
                  >
                    EARNINGS & ALLOWANCES
                  </th>
                  <th
                    colSpan="6"
                    className="bg-rose-100 border-r border-b p-1 text-[10px] font-bold text-rose-800"
                  >
                    DEDUCTIONS & CONTRIBUTIONS
                  </th>
                  <th
                    colSpan="5"
                    className="bg-amber-100 border-r border-b p-1 text-[10px] font-bold text-amber-800"
                  >
                    ADJUSTMENTS (EDITABLE)
                  </th>
                  <th
                    colSpan="2"
                    className="bg-purple-100 border-r border-b p-1 text-[10px] font-bold text-purple-800"
                  >
                    NET PAYABLES
                  </th>
                  <th
                    colSpan="3"
                    className="bg-slate-200 border-r border-b p-1 text-[10px] font-bold text-slate-600"
                  >
                    BANK DETAILS
                  </th>
                  <th
                    colSpan="2"
                    className="bg-indigo-50 border-r border-b p-1 text-[10px] font-bold text-indigo-800"
                  >
                    ACTIONS
                  </th>
                </tr>
                <tr>
                  <th className="sticky left-0 top-[26px] z-[80] bg-slate-200 border-r border-b p-2 text-xs font-bold w-[160px] min-w-[160px] md:w-[220px] md:min-w-[220px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                    NAME
                  </th>
                  <th className="md:sticky md:left-[220px] top-[26px] z-[70] bg-slate-200 border-r border-b p-2 text-xs font-bold w-[130px] min-w-[130px] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                    DEPT.
                  </th>
                  <th className="md:sticky md:left-[350px] top-[26px] z-[70] bg-slate-200 border-r-2 border-slate-400 border-b p-2 text-xs font-bold w-[180px] min-w-[180px] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                    PROJECT
                  </th>

                  <Th>UAN / PF</Th>
                  <Th>ESIC NO.</Th>

                  <Th className="bg-indigo-50">MONTH DAYS</Th>
                  <Th className="bg-indigo-50">WORK DAYS</Th>
                  <Th className="bg-indigo-50">WO (TAKEN)</Th>
                  <Th className="bg-indigo-50">WO (PAID)</Th>
                  <Th className="bg-indigo-50 font-bold text-indigo-900">
                    PRESENT DAYS
                  </Th>
                  <Th className="bg-indigo-50 font-bold text-indigo-900">
                    LEAVE ADJUSTMENT
                  </Th>
                  <Th className="bg-indigo-100 font-extrabold text-indigo-900">
                    TOTAL DUTY
                  </Th>
                  <Th className="bg-indigo-100 font-extrabold text-indigo-900">
                    EXTRA DUTY
                  </Th>

                  <Th className="bg-emerald-50">MIN WAGES</Th>
                  <Th className="bg-emerald-50">PER DAY</Th>
                  <Th className="bg-emerald-100 font-extrabold text-emerald-900">
                    GROSS WAGES
                  </Th>
                  <Th className="bg-emerald-100 font-extrabold text-emerald-900">
                    EXTRA DUTY
                  </Th>
                  <Th className="bg-emerald-50">BASIC(50%)</Th>
                  <Th className="bg-emerald-50">HRA(20%)</Th>
                  <Th className="bg-emerald-50">CONV(10%)</Th>
                  <Th className="bg-emerald-50">WASH(10%)</Th>
                  <Th className="bg-emerald-50">
                    ADDL WAGES FOR 12 HOURS DUTY
                  </Th>

                  <Th className="bg-rose-50">EPF EMP(12%)</Th>
                  <Th className="bg-rose-50">ESIC EMP(0.75%)</Th>
                  <Th className="bg-rose-50">P TAX</Th>
                  <Th className="bg-rose-50">EPF EMPL(12%)</Th>
                  <Th className="bg-rose-50">ADMIN(1%)</Th>
                  <Th className="bg-rose-50">ESIC EMPL(3.25%)</Th>

                  <Th className="bg-amber-50">WAIVE PF/ESI</Th>
                  <Th className="bg-amber-50">BONUS</Th>
                  <Th className="bg-amber-50 font-bold">INCREMENT AMOUNT</Th>
                  <Th className="bg-amber-50 text-red-600">ADVANCE</Th>
                  <Th className="bg-amber-50 text-red-600">OTHERS</Th>

                  <Th className="bg-purple-100 font-black text-purple-900">
                    CTC
                  </Th>
                  <Th className="bg-emerald-200 font-extrabold text-emerald-900 text-[13px]">
                    NET SALARY
                  </Th>

                  <Th>BANK NAME</Th>
                  <Th>ACC NUMBER</Th>
                  <Th>IFSC CODE</Th>
                  <Th className="bg-white">SLIP SENT</Th>
                  <Th className="bg-white">DOWNLOAD</Th>
                </tr>
              </thead>
              <tbody className="bg-white relative z-0">
                {rows.map((row, index) => {
                  const m = row.math || {};
                  const st = row.attendanceStats || {};
                  const g = row.guard || {};
                  return (
                    <tr
                      key={`${g._id}-${row.projectId}`}
                      className="group transition-colors"
                    >
                      <td className="sticky left-0 z-[60] bg-white group-hover:bg-slate-50 border-r border-b p-2 font-bold text-slate-900 truncate shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {g.name}
                      </td>
                      <td className="md:sticky md:left-[220px] z-[50] bg-white group-hover:bg-slate-50 border-r border-b p-2 text-xs font-medium text-slate-600 truncate md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {g.department}
                      </td>
                      <td className="md:sticky md:left-[350px] z-[50] bg-white group-hover:bg-slate-50 border-r-2 border-slate-300 border-b p-2 text-[10px] font-bold text-slate-800 truncate md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {row.projectName}
                      </td>

                      <Td className="text-[10px] group-hover:bg-slate-50">
                        {g.pfNumber || "-"}
                      </Td>
                      <Td className="text-[10px] group-hover:bg-slate-50">
                        {g.esicNumber || "-"}
                      </Td>

                      <Td className="bg-indigo-50/30 group-hover:bg-indigo-50">
                        <EditCell
                          val={m.daysInMonth}
                          field="daysInMonth"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-indigo-50/30 group-hover:bg-indigo-50 font-semibold">
                        {fmt(m.workDays, 2)}
                      </Td>
                      <Td className="bg-indigo-50/30 group-hover:bg-indigo-50">
                        {st.calendarOffs || 0}
                      </Td>
                      <Td className="bg-indigo-50/30 group-hover:bg-indigo-50 font-semibold text-indigo-700">
                        {fmt(st.weekOffs, 2)}
                      </Td>
                      <Td className="bg-indigo-50/30 group-hover:bg-indigo-50 font-bold text-indigo-900">
                        <EditCell
                          val={m.presentDays}
                          field="presentDays"
                          index={index}
                          m={m}
                          isDec={true}
                        />
                      </Td>
                      <Td className="bg-indigo-50/30 group-hover:bg-indigo-50 font-bold text-indigo-900">
                        <EditCell
                          val={m.leaveAdjustments}
                          field="leaveAdjustments"
                          index={index}
                          m={m}
                          isDec={true}
                        />
                      </Td>

                      <Td className="bg-indigo-100/50 group-hover:bg-indigo-100 font-black text-indigo-900 text-sm">
                        <EditCell
                          val={m.totalDuty}
                          field="totalDuty"
                          index={index}
                          m={m}
                          isDec={true}
                        />
                      </Td>
                      <Td className="bg-indigo-100/50 group-hover:bg-indigo-100 font-black text-indigo-900 text-sm">
                        <EditCell
                          val={m.extraDuty}
                          field="extraDuty"
                          index={index}
                          m={m}
                          isDec={true}
                        />
                      </Td>

                      <Td className="bg-emerald-50/30 group-hover:bg-emerald-50">
                        <EditCell
                          val={m.minWages}
                          field="minWages"
                          index={index}
                          m={m}
                          minWidth="w-16"
                        />
                      </Td>

                      <Td className="bg-emerald-50/30 group-hover:bg-emerald-50">
                        <EditCell
                          val={m.perDayAmount}
                          field="perDayAmount"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-emerald-100/50 group-hover:bg-emerald-100 font-black text-emerald-900">
                        <EditCell
                          val={m.grossWages}
                          field="grossWages"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-emerald-100/50 group-hover:bg-emerald-100 font-black text-emerald-900">
                        <EditCell
                          val={m.extraDutyPay}
                          field="extraDutyPay"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-emerald-50/30 group-hover:bg-emerald-50">
                        <EditCell
                          val={m.basicPay}
                          field="basicPay"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-emerald-50/30 group-hover:bg-emerald-50">
                        <EditCell val={m.hra} field="hra" index={index} m={m} />
                      </Td>
                      <Td className="bg-emerald-50/30 group-hover:bg-emerald-50">
                        <EditCell
                          val={m.conveyance}
                          field="conveyance"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-emerald-50/30 group-hover:bg-emerald-50">
                        <EditCell
                          val={m.washing}
                          field="washing"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-emerald-50/30 group-hover:bg-emerald-50">
                        <EditCell
                          val={m.additional}
                          field="additional"
                          index={index}
                          m={m}
                        />
                      </Td>

                      <Td className="bg-rose-50/30 group-hover:bg-rose-50 text-rose-800 font-medium">
                        <EditCell
                          val={m.epfEmp}
                          field="epfEmp"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-rose-50/30 group-hover:bg-rose-50 text-rose-800 font-medium">
                        <EditCell
                          val={m.esicEmp}
                          field="esicEmp"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-rose-50/30 group-hover:bg-rose-50 text-rose-800 font-medium">
                        <EditCell
                          val={m.pTax}
                          field="pTax"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-rose-50/30 group-hover:bg-rose-50 text-slate-500">
                        <EditCell
                          val={m.epfEmployer}
                          field="epfEmployer"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-rose-50/30 group-hover:bg-rose-50 text-slate-500">
                        <EditCell
                          val={m.adminCharges}
                          field="adminCharges"
                          index={index}
                          m={m}
                        />
                      </Td>
                      <Td className="bg-rose-50/30 group-hover:bg-rose-50 text-slate-500">
                        <EditCell
                          val={m.esicEmployer}
                          field="esicEmployer"
                          index={index}
                          m={m}
                        />
                      </Td>

                      <td className="bg-amber-50/30 group-hover:bg-amber-50 border-r border-b p-1 text-center align-middle">
                        <div className="flex justify-center items-center h-full">
                          <Checkbox
                            checked={m.skipPfEsic || false}
                            onCheckedChange={(checked) =>
                              handleWaivePfEsicChange(index, checked)
                            }
                            className="data-[state=checked]:bg-amber-600 border-amber-300 w-4 h-4 shadow-sm"
                          />
                        </div>
                      </td>

                      <td className="bg-amber-50/30 group-hover:bg-amber-50 border-r border-b p-1">
                        <input
                          type="number"
                          value={m.bonus || ""}
                          onChange={(e) =>
                            handleEditChange(index, "bonus", e.target.value)
                          }
                          onBlur={() => handleBlurSave(index)}
                          className="w-12 h-6 text-center text-xs border border-amber-200 rounded outline-none focus:border-amber-500 font-semibold bg-white"
                          placeholder="-"
                        />
                      </td>
                      <td className="bg-amber-50/30 group-hover:bg-amber-50 border-r border-b p-1">
                        <input
                          type="number"
                          value={m.edAmount || ""}
                          onChange={(e) =>
                            handleEditChange(index, "edAmount", e.target.value)
                          }
                          onBlur={() => handleBlurSave(index)}
                          className="w-12 h-6 text-center text-xs border border-amber-200 rounded outline-none focus:border-amber-500 font-semibold bg-white"
                          placeholder="-"
                        />
                      </td>
                      <td className="bg-amber-50/30 group-hover:bg-amber-50 border-r border-b p-1">
                        <input
                          type="number"
                          value={m.advance || ""}
                          onChange={(e) =>
                            handleEditChange(index, "advance", e.target.value)
                          }
                          onBlur={() => handleBlurSave(index)}
                          className="w-12 h-6 text-center text-xs border border-red-200 rounded outline-none focus:border-red-500 font-semibold text-red-700 bg-white"
                          placeholder="-"
                        />
                      </td>
                      <td className="bg-amber-50/30 group-hover:bg-amber-50 border-r border-b p-1">
                        <input
                          type="number"
                          value={m.othersDeduction || ""}
                          onChange={(e) =>
                            handleEditChange(
                              index,
                              "othersDeduction",
                              e.target.value,
                            )
                          }
                          onBlur={() => handleBlurSave(index)}
                          className="w-12 h-6 text-center text-xs border border-red-200 rounded outline-none focus:border-red-500 font-semibold text-red-700 bg-white"
                          placeholder="-"
                        />
                      </td>

                      <Td className="bg-purple-50 group-hover:bg-purple-100 font-bold text-purple-900">
                        {fmt(m.ctc)}
                      </Td>
                      <Td className="bg-emerald-100/70 group-hover:bg-emerald-200 font-extrabold text-emerald-900 text-[13px]">
                        {fmt(m.netSalary)}
                      </Td>

                      <Td className="text-[10px] group-hover:bg-slate-50">
                        {g.bankName || "-"}
                      </Td>
                      <Td className="text-[10px] font-mono group-hover:bg-slate-50">
                        {g.accountNumber || "-"}
                      </Td>
                      <Td className="text-[10px] font-mono group-hover:bg-slate-50">
                        {g.ifscCode || "-"}
                      </Td>

                      <td className="border-r border-b p-1.5 text-center bg-slate-50 group-hover:bg-slate-100 align-middle">
                        <div className="flex justify-center items-center h-full">
                          <Checkbox
                            checked={row.isPaid || false}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange(index, checked)
                            }
                            className="data-[state=checked]:bg-emerald-600 border-slate-300 w-5 h-5 shadow-sm"
                          />
                        </div>
                      </td>
                      <td className="border-r border-b p-1.5 text-center bg-slate-50 group-hover:bg-slate-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadSlip(index)}
                          disabled={row.downloading}
                          className="h-8 w-8 p-0 border-slate-300 bg-white shadow-sm hover:bg-slate-50 text-indigo-700"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
