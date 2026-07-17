import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getGuardMonth } from "../../api/attendance";
import { downloadSlip } from "../../api/salary";
import { X, Info, AlertCircle, CheckCircle2, FileDown, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function fmtDays(n) {
  return typeof n === "number" ? n.toFixed(2) : "0.00";
}

const getStatusStyles = (status) => {
  if (!status || typeof status !== "string")
    return "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100";

  if (status === "P") return "bg-emerald-500 text-white font-bold shadow-sm";
  if (status === "DD") return "bg-purple-500 text-white font-bold shadow-sm";
  if (status === "HD") return "bg-amber-500 text-white font-bold shadow-sm";
  if (status === "A") return "bg-red-500 text-white font-bold shadow-sm";
  if (status === "OFF") return "bg-slate-400 text-white font-bold shadow-sm";
  if (status === "H") return "bg-blue-400 text-white font-bold shadow-sm";

  return "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100";
};

const LEGEND = [
  { code: "P", label: "Present", color: "bg-emerald-500" },
  { code: "A", label: "Absent", color: "bg-red-500" },
  { code: "DD", label: "Double", color: "bg-purple-500" },
  { code: "HD", label: "Half", color: "bg-amber-500" },
  { code: "OFF", label: "Week Off", color: "bg-slate-400" },
  { code: "H", label: "Holiday", color: "bg-blue-400" },
];

const STATUS_LABELS = {
  P: "Present",
  A: "Absent",
  DD: "Double duty",
  HD: "Half duty",
  OFF: "Weekly Off",
  H: "Holiday",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function MyRecordPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDayInfo, setSelectedDayInfo] = useState([]); 

  const [downloading, setDownloading] = useState(false);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  async function loadRecords() {
    setLoading(true);
    setSelectedDayInfo([]);
    try {
      const result = await getGuardMonth(user.guardId, selectedYear, selectedMonth - 1, "all");
      setData(result);
    } catch (error) {
      console.error("Failed to load records", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, [selectedMonth, selectedYear]);

  const handleDownloadSlip = async () => {
    setDownloading(true);
    try {
      const guardName = data?.guard?.name || user?.name || "";
      await downloadSlip(user.guardId, selectedYear, selectedMonth - 1, "null", guardName); 
    } catch (err) {
      alert("Failed to download slip.");
    }
    setDownloading(false);
  };

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const blanks = Array(firstDayOfMonth).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getFormattedDateString = (day) => {
    const y = selectedYear;
    const m = String(selectedMonth).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return (
    <div className="p-4 md:p-8 max-w-md mx-auto w-full space-y-6 pb-20 sm:pb-10 font-sans">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            My Records
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data?.guard?.department === "OFFICE"
              ? "Office Staff records."
              : data?.guard?.isReliever
                ? "Reliever attendance logs (Tap a day to view assigned site)"
                : data?.project?.name
                  ? `Assigned to: ${data.project.name}`
                  : "Review your attendance"}
          </p>
        </div>

        <div className="flex gap-2 w-full relative z-20">
          <Select
            value={MONTH_NAMES[selectedMonth - 1]}
            onValueChange={(val) => {
              setSelectedMonth(MONTH_NAMES.indexOf(val) + 1);
              setSelectedDayInfo([]);
            }}
          >
            <SelectTrigger className="w-full h-11 bg-white border-slate-200 font-medium">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 shadow-lg">
              {MONTH_NAMES.map((monthName) => (
                <SelectItem key={monthName} value={monthName} className="cursor-pointer">
                  {monthName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => {
              setSelectedYear(parseInt(v, 10));
              setSelectedDayInfo([]);
            }}
          >
            <SelectTrigger className="w-[120px] h-11 bg-white border-slate-200 font-medium">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 shadow-lg">
              {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map((year) => (
                <SelectItem key={year} value={year.toString()} className="cursor-pointer">
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="text-slate-500 font-medium">Fetching records...</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* NEW: Simple Slip Release Widget */}
          {data?.isPaid ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-full"><FileDown className="h-5 w-5 text-white" /></div>
                <div>
                  <h3 className="font-bold text-indigo-950 text-sm">Salary Processed</h3>
                  <p className="text-[11px] text-indigo-700 font-medium">Your payslip is available.</p>
                </div>
              </div>
              <Button onClick={handleDownloadSlip} disabled={downloading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm shrink-0 h-9 px-3 text-xs">
                {downloading ? "Downloading..." : "Download"}
              </Button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm opacity-75">
              <div className="bg-slate-200 p-2 rounded-full"><Lock className="h-5 w-5 text-slate-500" /></div>
              <div>
                <h3 className="font-bold text-slate-700 text-sm">Slip Unavailable</h3>
                <p className="text-[11px] text-slate-500 font-medium">Admin has not released your slip yet.</p>
              </div>
            </div>
          )}

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <h2 className="text-emerald-900 font-extrabold text-lg">Total Paid Days</h2>
              <p className="text-emerald-700 text-xs font-medium mt-0.5">Calculated based on project rules</p>
            </div>
            <div className="text-4xl font-black text-emerald-600">
              {fmtDays(data?.guard?.department === "OFFICE" ? daysInMonth : (data?.stats?.totalWorkingDays || 0))}
            </div>
          </div>

          {Array.isArray(selectedDayInfo) && selectedDayInfo.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl shadow-sm flex items-start justify-between gap-3 animate-fadeIn">
              <div className="flex items-start gap-2.5 w-full">
                <Info className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                <div className="space-y-2.5 w-full">
                  <p className="text-xs font-bold text-indigo-900 uppercase tracking-tight border-b border-indigo-200 pb-1">
                    Date: {selectedDayInfo[0]?.date || "Unknown Date"}
                  </p>

                  <div className="space-y-2 w-full pr-4">
                    {selectedDayInfo.map((info, idx) => (
                      <div key={idx} className="bg-white/80 p-2.5 rounded-lg border border-indigo-100 flex justify-between items-center">
                        <div className="truncate pr-2">
                          <p className="text-sm font-extrabold text-indigo-950 truncate">
                            {info?.projectName || (data?.guard?.isReliever ? "Reliever Duty" : "No Project Assigned")}
                          </p>
                          {info?.time && <p className="text-[10px] text-slate-500 font-medium mt-0.5">{info.time}</p>}
                        </div>
                        {info?.status && (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${getStatusStyles(info.status)}`}>
                            {STATUS_LABELS[info.status] || info.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedDayInfo([])} className="text-indigo-400 hover:text-indigo-700 p-1 shrink-0 rounded-full hover:bg-indigo-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {data?.guard?.department !== "OFFICE" && (
            <Card className="border-2 shadow-sm rounded-xl overflow-hidden bg-white">
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map((day) => (
                    <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-tighter">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {blanks.map((_, i) => (
                    <div key={`blank-${i}`} className="aspect-square"></div>
                  ))}

                  {days.map((day) => {
                    const dateStr = getFormattedDateString(day);
                    const dayRecords = data?.days?.filter((d) => d.date === dateStr) || [];
                    const validRecords = dayRecords.filter((d) => d.status);

                    const primaryRecord = validRecords.length > 0 ? validRecords[0] : dayRecords[0];
                    const status = primaryRecord?.status;
                    const hasMultiple = validRecords.length > 1;

                    const isSelected = Array.isArray(selectedDayInfo) && selectedDayInfo.length > 0 && selectedDayInfo[0]?.date === dateStr;

                    return (
                      <div
                        key={day}
                        onClick={() => {
                          const recordsToSet = validRecords.length > 0 ? validRecords : dayRecords;
                          setSelectedDayInfo(recordsToSet || []);
                        }}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm sm:text-base transition-all cursor-pointer select-none active:scale-95 ${getStatusStyles(status)} ${isSelected ? "ring-2 ring-indigo-900 ring-offset-2" : ""}`}
                      >
                        <span>{day}</span>
                        {status && (
                          <span className="text-[9px] leading-tight mt-0.5 opacity-90 font-bold tracking-tighter truncate max-w-full px-0.5">
                            {status}
                          </span>
                        )}
                        {hasMultiple && (
                          <div className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-1 bg-slate-900 text-white text-[8px] font-black rounded-full border border-white shadow-sm">
                            +{validRecords.length - 1}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {data?.guard?.department !== "OFFICE" && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-900 leading-relaxed">
                <strong>Notice:</strong> If you believe there is an error in your attendance record, contact the office administration immediately for corrections.
              </p>
            </div>
          )}
        </div>
      )}

      {!loading && data?.guard?.department !== "OFFICE" && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Legend</h4>
          <div className="flex flex-wrap gap-3">
            {LEGEND.map((item) => (
              <div key={item.code} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm shadow-sm ${item.color}`}></div>
                <span className="text-xs font-medium text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}