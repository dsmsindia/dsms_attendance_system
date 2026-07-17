import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getGuardMonth, markDay } from "../../api/attendance";
import { getProjects } from "../../api/projects";
import { Calendar, Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function fmtDate(d) {
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, "0"),
    day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDays(n) {
  return typeof n === "number" ? n.toFixed(2) : "0.00";
}

const STATUS_LABELS = {
  P: "Present",
  DD: "Double duty",
  HD: "Half duty",
  OFF: "Weekly Off",
  H: "Holiday",
};

export default function MarkAttendancePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProj, setSelectedProj] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const today = new Date();
  const todayStr = fmtDate(today);
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();

  async function load() {
    setLoading(true);
    try {
      const [resData, resProj] = await Promise.all([
        getGuardMonth(user.guardId, today.getFullYear(), today.getMonth()),
        getProjects(),
      ]);
      setData(resData);
      setProjects(resProj.filter((p) => p.active !== false));

      const todayEntries = resData.days.filter(
        (d) => d.date === todayStr && d.projectId,
      );
      if (todayEntries.length > 0) {
        setSelectedProj(todayEntries[todayEntries.length - 1].projectId);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const todayEntries = data?.days?.filter((d) => d.date === todayStr) || [];
  const activeEntryForProject =
    data?.guard?.isReliever && selectedProj
      ? todayEntries.find((d) => d.projectId === selectedProj)
      : todayEntries[0];

  async function handleMark(status) {
    setErrorMsg("");
    const targetStatus = status;

    if (
      data?.guard?.isReliever &&
      ["P", "DD", "HD"].includes(targetStatus) &&
      !selectedProj
    ) {
      setErrorMsg("Please select the project site you are covering today.");
      return;
    }

    if (targetStatus === "OFF") {
      const currentProjId = data.guard?.isReliever
        ? selectedProj
        : data.guard?.projectId?._id;
      const projInfo = projects.find(
        (p) => String(p._id) === String(currentProjId),
      );

      if (projInfo && projInfo.type !== "ALL DAY") {
        const offCount = data.days.filter(
          (d) => d.status === "OFF" && d.date !== todayStr,
        ).length;
        if (offCount >= 4) {
          setErrorMsg(
            "You can only take a maximum of 4 Weekly Offs per month.",
          );
          return;
        }
      }
    }

    try {
      const finalStatus =
        activeEntryForProject?.status === targetStatus ? null : targetStatus;
      await markDay(todayStr, finalStatus, selectedProj || null);
      load();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to update status.");
    }
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-10 px-4 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
          Mark Attendance
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Record or update your daily status for today.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md text-red-800 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-emerald-900 font-extrabold text-lg">
            Total Paid Days
          </h2>
          <p className="text-emerald-700 text-xs font-medium mt-0.5">
            Calculated based on project rules
          </p>
        </div>
        <div className="text-4xl font-black text-emerald-600">
          {fmtDays(
            data?.guard?.department === "OFFICE"
              ? daysInMonth
              : data.stats?.totalWorkingDays || 0,
          )}
        </div>
      </div>

      {data?.guard?.department === "OFFICE" ? (
        <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-sm mt-6">
          <Building2 className="w-12 h-12 text-indigo-300 mb-3" />
          <h3 className="font-bold text-indigo-900 text-lg">
            Office Staff Attendance
          </h3>
          <p className="text-sm text-indigo-700 font-medium max-w-sm mt-1">
            Your attendance is calculated automatically on a fixed monthly
            basis. You do not need to manually mark your daily attendance here.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden shadow-sm border-slate-200 rounded-xl bg-white">
          <div className="p-4 sm:p-5 border-b bg-slate-50 flex items-start gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-md shrink-0 mt-0.5">
              <Building2 className="h-5 w-5 text-indigo-700" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Assignment
              </span>
              <h3 className="font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md text-base sm:text-lg leading-tight inline-block tracking-tight">
                {data.guard?.isReliever
                  ? "Reliever Personnel"
                  : data.guard?.projectId?.name || "Assigned Site"}
              </h3>
            </div>
          </div>

          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xl sm:text-2xl">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
              {today.toDateString()}
            </div>

            {data.guard?.isReliever && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Select Project Site Today:
                </label>
                <Select value={selectedProj} onValueChange={setSelectedProj}>
                  <SelectTrigger className="w-full h-11 bg-white">
                    <div className="truncate text-left flex-1">
                      {projects.find((p) => p._id === selectedProj)?.name ||
                        "-- Choose Project Site --"}
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 max-w-[95vw] shadow-lg">
                    {projects.map((p) => (
                      <SelectItem
                        key={p._id}
                        value={p._id}
                        className="cursor-pointer whitespace-normal break-words py-2 leading-snug"
                      >
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Select Status:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {["P", "DD", "HD", "OFF", "H"].map((code) => (
                  <Button
                    key={code}
                    variant={
                      activeEntryForProject?.status === code
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleMark(code)}
                    className={`h-14 font-bold text-xs sm:text-sm rounded-lg ${activeEntryForProject?.status === code ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" : "bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-700"}`}
                  >
                    {STATUS_LABELS[code]}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t flex items-start gap-2 text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
            <p>
              Note: clicking any other status updates your attendance type for
              today immediately. Clicking the same status clears it.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
