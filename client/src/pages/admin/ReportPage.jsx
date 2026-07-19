import { useEffect, useState } from "react";
import { getProjects } from "../../api/projects";
import { getGuardMonth } from "../../api/attendance";
import { getReportGuards, downloadExcelReport } from "../../api/reports";

import { Download, Building2, ShieldAlert, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const getLocalYYYYMMDD = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function fmtDays(n) {
  return typeof n === "number" ? n.toFixed(2) : "0.00";
}

const getDayStyle = (status) => {
  if (!status) return "bg-white text-slate-400";
  if (status.includes("P")) return "bg-emerald-100 text-emerald-800 font-bold";
  if (status.includes("A")) return "bg-red-100 text-red-800 font-bold";
  if (status.includes("DD")) return "bg-purple-100 text-purple-800 font-bold";
  if (status.includes("HD")) return "bg-amber-100 text-amber-800 font-bold";
  if (status.includes("OFF")) return "bg-slate-200 text-slate-700 font-medium";
  if (status.includes("H")) return "bg-blue-100 text-blue-800 font-bold";
  return "bg-slate-100 text-slate-700 font-medium";
};

export default function ReportPage() {
  const now = new Date();

  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const defaultStart = getLocalYYYYMMDD(firstDay);
  const defaultEnd = getLocalYYYYMMDD(lastDay);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [projectId, setProjectId] = useState("all");
  const [projects, setProjects] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getProjects()
      .then((res) => setProjects(Array.isArray(res) ? res : []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, projectId]);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProjects = safeProjects.filter((p) => p.active !== false);

  const contextProjectName =
    projectId === "all" || projectId === "relievers"
      ? null
      : safeProjects.find((p) => String(p._id) === String(projectId))?.name;

  const getDatesInRange = (start, end) => {
    const d = new Date(start);
    const endD = new Date(end);
    const dates = [];
    while (d <= endD) {
      dates.push(getLocalYYYYMMDD(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };
  const dateRange = getDatesInRange(startDate, endDate);

  async function loadReport() {
    setLoading(true);
    setRows([]);
    try {
      const scoped = await getReportGuards(startDate, endDate, projectId);
      if (!Array.isArray(scoped))
        throw new Error("Invalid guards data received.");

      const results = await Promise.all(
        scoped.map(async (guard) => {
          try {
            const data = await getGuardMonth(guard._id, startDate, endDate);
            return { guard, data: data || { days: [], stats: {} } };
          } catch (e) {
            return { guard, data: { days: [], stats: {} } };
          }
        }),
      );

      const flatRows = [];
      const todayStr = getLocalYYYYMMDD(new Date());

      for (const { guard, data } of results) {
        const safeDays = Array.isArray(data?.days) ? data.days : [];
        let pNames = [
          ...new Set(safeDays.map((d) => d?.projectName).filter(Boolean)),
        ];

        const assignedProjName = guard?.isReliever
          ? "Reliever"
          : guard?.projectId?.name || "Unassigned";

        if (contextProjectName) {
          const isAssignedToContext =
            !guard?.isReliever &&
            (guard?.projectId?.name === contextProjectName ||
              (guard?.projectHistory || []).some(
                (h) =>
                  h.endDate === null &&
                  h.projectId?.name === contextProjectName,
              ));
          if (isAssignedToContext && !pNames.includes(contextProjectName)) {
            pNames.push(contextProjectName);
          }
          if (pNames.length === 0 && assignedProjName === contextProjectName) {
            pNames.push(contextProjectName);
          }
        } else if (projectId === "all") {
          if (pNames.length === 0) {
            pNames.push(assignedProjName);
          }
        } else if (projectId === "relievers") {
          if (guard.isReliever && pNames.length === 0) {
            pNames.push("Reliever");
          }
        }

        if (pNames.length === 0) {
          const splitDays = dateRange.map((dateStr) => {
            const d = safeDays.find((x) => x.date === dateStr);
            if (d) return d;
            const isPast = dateStr <= todayStr;
            return {
              date: dateStr,
              status: !guard?.isReliever && isPast ? "A" : null,
              projectName: null,
              projectType: null,
              time: null,
              markedByAdmin: false,
            };
          });

          const localStats = {
            P: 0,
            A: 0,
            DD: 0,
            HD: 0,
            OFF: 0,
            H: 0,
            pending: 0,
            calendarOffs: 0,
          };
          splitDays.forEach((d) => {
            if (d?.status) {
              if (d.status === "OFF") localStats.calendarOffs++;
              else localStats[d.status] = (localStats[d.status] || 0) + 1;
            }
          });

          const p = Number(localStats.P || 0);
          const dd = Number(localStats.DD || 0);
          const hd = Number(localStats.HD || 0);
          const h = Number(localStats.H || 0);
          const off = Number(localStats.calendarOffs || 0);

          const pureDays = p + dd * 2 + hd * 0.5 + h;
          const workingDays = p + dd + hd + h;

          let earnedWeekOff = 0;
          if (!guard?.isReliever)
            earnedWeekOff = Math.min(Math.floor(workingDays / 6), 4);
          const payableWeekOff = Math.max(0, earnedWeekOff - off);
          const totalDays = pureDays + payableWeekOff;

          flatRows.push({
            guard,
            days: splitDays,
            stats: {
              ...localStats,
              weekOffs: Number(payableWeekOff.toFixed(2)),
              totalWorkingDays: Number(totalDays.toFixed(2)),
            },
            currentProjectName: assignedProjName,
            projectType: guard?.isReliever ? "" : "WEEKLY OFF",
          });
        } else {
          for (const pName of pNames) {
            if (contextProjectName && contextProjectName !== pName) continue;

            const splitDays = dateRange.map((dateStr) => {
              const d = safeDays.find(
                (x) => x.date === dateStr && x.projectName === pName,
              );
              if (d) return d;
              const isPast = dateStr <= todayStr;
              return {
                date: dateStr,
                status: !guard?.isReliever && isPast ? "A" : null,
                projectName: pName,
                projectType: null,
                time: null,
                markedByAdmin: false,
              };
            });

            const pType =
              safeDays.find((d) => d.projectName === pName)?.projectType ||
              "WEEKLY OFF";

            const localStats = {
              P: 0,
              A: 0,
              DD: 0,
              HD: 0,
              OFF: 0,
              H: 0,
              pending: 0,
              calendarOffs: 0,
            };
            splitDays.forEach((d) => {
              if (d?.status) {
                if (d.status === "OFF") localStats.calendarOffs++;
                else localStats[d.status] = (localStats[d.status] || 0) + 1;
              }
            });

            const p = Number(localStats.P || 0);
            const dd = Number(localStats.DD || 0);
            const hd = Number(localStats.HD || 0);
            const h = Number(localStats.H || 0);
            const off = Number(localStats.calendarOffs || 0);

            const isAllDay = String(pType).toUpperCase() === "ALL DAY";
            const pureDays = p + dd * 2 + hd * 0.5 + h;
            const workingDays = p + dd + hd + h;

            let earnedWeekOff = 0;
            if (!isAllDay && !guard?.isReliever)
              earnedWeekOff = Math.min(Math.floor(workingDays / 6), 4);
            const payableWeekOff = Math.max(0, earnedWeekOff - off);
            const totalDays = pureDays + payableWeekOff;

            flatRows.push({
              guard,
              days: splitDays,
              stats: {
                ...localStats,
                weekOffs: Number(payableWeekOff.toFixed(2)),
                totalWorkingDays: Number(totalDays.toFixed(2)),
              },
              currentProjectName: pName,
              projectType: pType,
            });
          }
        }
      }

      flatRows.sort((a, b) => {
        const isRelieverA = a.guard?.isReliever ? 1 : 0;
        const isRelieverB = b.guard?.isReliever ? 1 : 0;
        if (isRelieverA !== isRelieverB) return isRelieverA - isRelieverB;
        const pA = a.currentProjectName || "Unassigned";
        const pB = b.currentProjectName || "Unassigned";
        const projCompare = pA.toLowerCase().localeCompare(pB.toLowerCase());
        if (projCompare !== 0) return projCompare;
        const gA = a.guard?.name || "";
        const gB = b.guard?.name || "";
        return gA.toLowerCase().localeCompare(gB.toLowerCase());
      });

      setRows(flatRows);
    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      let safeProjectName = "All_Projects";
      if (projectId === "relievers") safeProjectName = "Relievers";
      else if (contextProjectName)
        safeProjectName = contextProjectName.replace(/\s+/g, "_");

      const fileName = `AttendanceReport_${startDate}_${endDate}_${safeProjectName}.xlsx`;

      await downloadExcelReport(startDate, endDate, projectId, fileName);
    } catch (err) {
      alert("Download failed: " + (err.response?.data?.message || err.message));
    }
    setDownloading(false);
  }

  return (
    <div className="h-[calc(100vh-120px)] w-full flex flex-col space-y-4 sm:space-y-6">
      <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Attendance Report
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Generate and export custom date-range guard attendance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto bg-white p-3 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 h-11">
            <CalendarRange className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm font-semibold outline-none text-slate-700"
            />
            <span className="text-slate-400 font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm font-semibold outline-none text-slate-700"
            />
          </div>

          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-full sm:w-[350px] h-11 bg-slate-50 border-slate-200 font-bold text-slate-700">
              <Building2 className="w-4 h-4 mr-2 text-slate-500 shrink-0" />
              <div className="truncate text-left flex-1">
                {projectId === "all"
                  ? "ALL PROJECTS"
                  : projectId === "relievers"
                    ? "RELIEVERS"
                    : activeProjects.find(
                        (p) => String(p._id) === String(projectId),
                      )?.name || "Project"}
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">
                ALL PROJECTS
              </SelectItem>
              <SelectItem
                value="relievers"
                className="font-bold text-indigo-700"
              >
                RELIEVER GUARDS
              </SelectItem>
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t mt-1">
                Project Sites
              </div>
              {activeProjects.map((p) => (
                <SelectItem key={p._id} value={String(p._id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full sm:w-auto h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ml-auto"
          >
            {downloading ? (
              "Preparing..."
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Download Excel
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="shrink-0 bg-white p-4 rounded-xl border shadow-sm flex flex-wrap gap-x-4 gap-y-2 items-center text-sm">
        <span className="font-bold text-slate-500 uppercase text-xs mr-2">
          Legend:
        </span>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-emerald-100 text-emerald-800">P</Badge> Present
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-red-100 text-red-800">A</Badge> Absent
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-purple-100 text-purple-800">DD</Badge> Double
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-amber-100 text-amber-800">HD</Badge> Half
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-slate-200 text-slate-700">OFF</Badge> Weekly Off
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-blue-100 text-blue-800">H</Badge> Holiday
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-500 font-medium animate-pulse">
              Generating Matrix...
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
            <ShieldAlert className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-600 font-semibold text-lg">
              No guards in scope
            </p>
          </div>
        ) : (
          /* FIX: Removed 'hidden md:block' to allow mobile scrolling */
          <div className="flex-1 overflow-auto relative w-full">
            <table className="w-full text-sm min-w-max border-collapse">
              <TableHeader className="sticky top-0 z-30 bg-slate-50 shadow-sm">
                <TableRow>
                  <TableHead className="sticky left-0 top-0 z-40 bg-slate-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-slate-700 min-w-[200px]">
                    GUARD
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 border-r min-w-[180px] bg-slate-50 whitespace-nowrap">
                    PROJECT
                  </TableHead>
                  {dateRange.map((dateStr, i) => {
                    const dObj = new Date(dateStr);
                    const dayNum = dObj.getDate();
                    const dayName = dObj.toLocaleDateString("en-US", {
                      weekday: "narrow",
                    });
                    return (
                      <TableHead
                        key={i}
                        className="text-center p-0.5 w-[32px] min-w-[32px] border-r text-[10px] font-bold text-slate-500 leading-tight bg-slate-50"
                      >
                        <div>{dayNum}</div>
                        <div className="text-[9px] text-slate-400 font-normal">
                          {dayName}
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-center font-bold border-l border-r bg-emerald-100 text-emerald-800 whitespace-nowrap px-3">
                    P
                  </TableHead>
                  <TableHead className="text-center font-bold border-r bg-red-100 text-red-800 whitespace-nowrap px-3">
                    A
                  </TableHead>
                  <TableHead className="text-center font-bold border-r bg-purple-100 text-purple-800 whitespace-nowrap px-3">
                    DD
                  </TableHead>
                  <TableHead className="text-center font-bold border-r bg-amber-100 text-amber-800 whitespace-nowrap px-3">
                    HD
                  </TableHead>
                  <TableHead className="text-center font-bold border-r bg-slate-200 text-slate-700 text-xs px-2 whitespace-nowrap">
                    WEEKLY OFF (TAKEN)
                  </TableHead>
                  <TableHead className="text-center font-bold border-r bg-blue-100 text-blue-800 whitespace-nowrap px-3">
                    HOL
                  </TableHead>
                  <TableHead className="text-center font-bold border-r bg-indigo-100 text-indigo-900 text-xs px-2 whitespace-nowrap">
                    WEEKLY OFF (NEED TO BE PAID)
                  </TableHead>
                  <TableHead className="text-center font-bold text-slate-900 border-r bg-slate-200 whitespace-nowrap px-3">
                    TOTAL DAYS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(
                  (
                    { guard, days, stats, currentProjectName, projectType },
                    rowIndex,
                  ) => {
                    const displayProjectName =
                      currentProjectName || "Unassigned";
                    const safeStats = stats || {};

                    return (
                      <TableRow
                        key={`${guard?._id || rowIndex}-${displayProjectName}-${rowIndex}`}
                        className="hover:bg-slate-50/50"
                      >
                        <TableCell className="sticky left-0 z-20 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] font-medium text-slate-900 group-hover:bg-slate-50 px-4">
                          {guard?.name || "Unknown"}
                        </TableCell>
                        <TableCell
                          className="border-r px-4"
                          title={displayProjectName}
                        >
                          <div className="text-xs font-bold text-slate-800 truncate max-w-[160px]">
                            {displayProjectName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5 tracking-tight">
                            {projectType === "ALL DAY"
                              ? "All Day Project"
                              : projectType === "WEEKLY OFF"
                                ? "Weekly Off Project"
                                : ""}
                          </div>
                        </TableCell>

                        {(days || []).map((d, index) => (
                          <TableCell
                            key={index}
                            className={`p-0 w-[32px] border-r text-center align-middle h-full ${getDayStyle(d?.status)}`}
                          >
                            <div className="flex flex-col items-center justify-center py-0.5 min-h-[36px] relative group">
                              {d?.time && (
                                <span className="text-[8px] opacity-75 font-semibold leading-none mb-0.5 tracking-tight">
                                  {d.time}
                                </span>
                              )}
                              <span className="text-[11px] font-bold leading-none flex items-center justify-center relative">
                                {d?.status || "-"}
                                {d?.markedByAdmin && (
                                  <span className="text-red-500 font-black ml-[1px] absolute -right-2 top-[-4px] text-[10px]">
                                    *
                                  </span>
                                )}
                              </span>
                            </div>
                          </TableCell>
                        ))}

                        <TableCell className="text-center font-bold border-l border-r bg-emerald-100 text-emerald-800">
                          {fmtDays(safeStats.P || 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold border-r bg-red-100 text-red-800">
                          {fmtDays(safeStats.A || 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold border-r bg-purple-100 text-purple-800">
                          {fmtDays(safeStats.DD || 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold border-r bg-amber-100 text-amber-800">
                          {fmtDays(safeStats.HD || 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold border-r bg-slate-200 text-slate-700">
                          {fmtDays(
                            safeStats.calendarOffs || safeStats.OFF || 0,
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold border-r bg-blue-100 text-blue-800">
                          {fmtDays(safeStats.H || 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold border-r bg-indigo-100 text-indigo-900">
                          {fmtDays(safeStats.weekOffs || 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold border-r bg-slate-200 text-slate-900">
                          {fmtDays(safeStats.totalWorkingDays || 0)}
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
