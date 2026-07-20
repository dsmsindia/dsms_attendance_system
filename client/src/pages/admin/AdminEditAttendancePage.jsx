import { useState, useEffect } from "react";
import api from "../../api/axios";
import { getProjects } from "../../api/projects";
import { getGuards } from "../../api/guards";
import {
  Calendar,
  UserCheck,
  Building2,
  Save,
  CalendarOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  {
    value: "P",
    label: "Present",
    colorClass: "bg-emerald-100 text-emerald-800",
  },
  { value: "A", label: "Absent", colorClass: "bg-red-100 text-red-800" },
  {
    value: "DD",
    label: "Double Duty",
    colorClass: "bg-purple-100 text-purple-800",
  },
  {
    value: "HD",
    label: "Half Duty",
    colorClass: "bg-amber-100 text-amber-800",
  },
  {
    value: "OFF",
    label: "Weekly Off",
    colorClass: "bg-slate-200 text-slate-700",
  },
  { value: "H", label: "Holiday", colorClass: "bg-blue-100 text-blue-800" },
  {
    value: "null",
    label: "Clear / Remove",
    colorClass: "bg-slate-100 text-slate-500",
  },
];

export default function AdminEditAttendancePage() {
  const [projects, setProjects] = useState([]);
  const [guards, setGuards] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGuard, setSelectedGuard] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedStatus, setSelectedStatus] = useState("");
  const [assignedProject, setAssignedProject] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [holidayProject, setHolidayProject] = useState("");
  const [holidayDate, setHolidayDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [holidayAction, setHolidayAction] = useState("add");
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState(null);

  useEffect(() => {
    getProjects().then(setProjects).catch(console.error);
    getGuards().then(setGuards).catch(console.error);
  }, []);

  const activeProjects = projects.filter((p) => p.active !== false);
  const filteredGuards = guards.filter((g) => {
    if (!selectedCategory) return false;
    if (selectedCategory === "RELIEVER") return g.isReliever && g.active;
    return g.projectId?._id === selectedCategory && !g.isReliever && g.active;
  });

  function handleCategoryChange(val) {
    setSelectedCategory(val);
    setSelectedGuard("");
    setAssignedProject("");
    setMessage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!selectedGuard || !date || !selectedStatus) {
      setMessage({
        type: "error",
        text: "Please select a Guard, Date, and Status.",
      });
      return;
    }

    if (
      selectedCategory === "RELIEVER" &&
      ["P", "DD", "HD"].includes(selectedStatus) &&
      !assignedProject
    ) {
      setMessage({
        type: "error",
        text: "Please select an Assigned Project site for this Reliever's duty.",
      });
      return;
    }

    setLoading(true);
    try {
      const payloadStatus = selectedStatus === "null" ? null : selectedStatus;

      // FIX: Ensure projectId is always sent when an Admin is specifically assigning an "H"
      // (or let it fallback to the default project if they leave it empty)
      let payloadProjectId =
        selectedCategory === "RELIEVER" ? assignedProject : selectedCategory;
      if (payloadStatus === "A" || payloadStatus === "OFF") {
        // Optionally you can still clear project ID for generic absences/offs if you want,
        // but backend requires projectId. It's safer to always send it.
        payloadProjectId =
          selectedCategory === "RELIEVER" ? assignedProject : selectedCategory;
      }

      await api.put("/attendance/admin/update", {
        guardId: selectedGuard,
        date,
        status: payloadStatus,
        projectId: payloadProjectId,
      });

      setMessage({ type: "success", text: "Attendance updated successfully!" });
      setSelectedStatus("");
      setAssignedProject("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to update attendance.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleHolidaySubmit(e) {
    e.preventDefault();
    setHolidayMessage(null);
    if (!holidayProject || !holidayDate) {
      setHolidayMessage({
        type: "error",
        text: "Please select Project and Date",
      });
      return;
    }

    setHolidayLoading(true);
    try {
      await api.put(`/projects/${holidayProject}/holiday`, {
        date: holidayDate,
        action: holidayAction,
      });
      setHolidayMessage({
        type: "success",
        text: `Holiday ${holidayAction}ed successfully!`,
      });
    } catch (error) {
      setHolidayMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to update holiday",
      });
    } finally {
      setHolidayLoading(false);
    }
  }

  return (
    <div className="w-full h-full flex flex-col space-y-6 pb-6 min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Edit Attendance & Holidays
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manually override guard attendance records or manage global project
          holidays.
        </p>
      </div>

      <div className="flex-1 overflow-auto w-full">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start pb-6">
          <Card className="border shadow-sm bg-white overflow-hidden rounded-xl h-full flex flex-col">
            <div className="bg-slate-50 border-b p-4 flex items-center gap-3 shrink-0">
              <div className="bg-indigo-100 p-2 rounded-md shrink-0">
                <UserCheck className="h-5 w-5 text-indigo-700" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">
                  Guard Attendance Details
                </h2>
                <p className="text-xs text-slate-500">
                  Select parameters below to apply individual guard corrections.
                </p>
              </div>
            </div>

            <CardContent className="p-5 sm:p-6 flex-1">
              <form onSubmit={handleSubmit} className="space-y-5">
                {message && (
                  <div
                    className={`p-3 rounded-md text-sm font-medium border-l-4 ${message.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-500" : "bg-red-50 text-red-800 border-red-500"}`}
                  >
                    {message.text}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    1. Select Project Site
                  </Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger className="w-full h-11 bg-slate-50/50 border-slate-200 shadow-sm focus:ring-indigo-500">
                      <SelectValue placeholder="-- Choose Project or Reliever --">
                        {selectedCategory === "RELIEVER"
                          ? "RELIEVER GUARDS"
                          : selectedCategory
                            ? activeProjects.find(
                                (p) =>
                                  String(p._id) === String(selectedCategory),
                              )?.name || "Select Project"
                            : "-- Choose Project or Reliever --"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      className="w-[var(--radix-select-trigger-width)] max-h-[300px]"
                    >
                      <SelectItem
                        value="RELIEVER"
                        className="font-bold text-indigo-700 bg-indigo-50/50"
                      >
                        RELIEVER GUARDS
                      </SelectItem>
                      {activeProjects.map((p) => (
                        <SelectItem key={p._id} value={String(p._id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    2. Select Guard
                  </Label>
                  <Select
                    value={selectedGuard}
                    onValueChange={setSelectedGuard}
                    disabled={!selectedCategory}
                  >
                    <SelectTrigger className="w-full h-11 bg-slate-50/50 border-slate-200 shadow-sm focus:ring-indigo-500 disabled:opacity-50">
                      <SelectValue
                        placeholder={
                          selectedCategory
                            ? "-- Choose Guard --"
                            : "Select a project first"
                        }
                      >
                        {selectedGuard
                          ? guards.find(
                              (g) => String(g._id) === String(selectedGuard),
                            )?.name || "Select Guard"
                          : "-- Choose Guard --"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      className="w-[var(--radix-select-trigger-width)] max-h-[300px]"
                    >
                      {filteredGuards.length === 0 ? (
                        <div className="p-2 text-sm text-slate-500 text-center">
                          No active guards found.
                        </div>
                      ) : (
                        filteredGuards.map((g) => (
                          <SelectItem key={g._id} value={String(g._id)}>
                            {g.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      3. Select Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setMessage(null);
                        }}
                        className="pl-9 h-11 bg-slate-50/50 border-slate-200 shadow-sm text-slate-700 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      4. Select Status
                    </Label>
                    <Select
                      value={selectedStatus}
                      onValueChange={(val) => {
                        setSelectedStatus(val);
                        setMessage(null);
                      }}
                    >
                      <SelectTrigger className="w-full h-11 bg-slate-50/50 border-slate-200 shadow-sm focus:ring-indigo-500">
                        <SelectValue placeholder="-- Status --">
                          {selectedStatus ? (
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-extrabold ${STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.colorClass}`}
                            >
                              {
                                STATUS_OPTIONS.find(
                                  (o) => o.value === selectedStatus,
                                )?.label
                              }
                            </span>
                          ) : (
                            "-- Status --"
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        className="w-[var(--radix-select-trigger-width)]"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className={
                              opt.value === "null"
                                ? "border-t mt-1 pt-2"
                                : "py-2"
                            }
                          >
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-extrabold ${opt.colorClass}`}
                            >
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedCategory === "RELIEVER" &&
                  ["P", "DD", "HD"].includes(selectedStatus) && (
                    <div className="space-y-1.5 pt-2 border-t border-dashed border-slate-200">
                      <Label className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Assigned Project
                        Site
                      </Label>
                      <p className="text-[11px] text-slate-500 mb-2">
                        Since this is a reliever, where did they work on this
                        day?
                      </p>
                      <Select
                        value={assignedProject}
                        onValueChange={setAssignedProject}
                      >
                        <SelectTrigger className="w-full h-11 bg-indigo-50/30 border-indigo-200 shadow-sm focus:ring-indigo-500">
                          <SelectValue placeholder="-- Select Actual Work Site --">
                            {assignedProject
                              ? activeProjects.find(
                                  (p) =>
                                    String(p._id) === String(assignedProject),
                                )?.name || "Select Actual Work Site"
                              : "-- Select Actual Work Site --"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          side="bottom"
                          className="w-[var(--radix-select-trigger-width)] max-h-[300px]"
                        >
                          {activeProjects.map((p) => (
                            <SelectItem key={p._id} value={String(p._id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                <div className="pt-4 border-t mt-6">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />{" "}
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Save className="mr-2 h-4 w-4" /> Save Attendance
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white overflow-hidden rounded-xl h-full flex flex-col">
            <div className="bg-slate-50 border-b p-4 flex items-center gap-3 shrink-0">
              <div className="bg-emerald-100 p-2 rounded-md shrink-0">
                <CalendarOff className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">
                  Manage Project Holidays
                </h2>
                <p className="text-xs text-slate-500">
                  Set a global holiday for an entire project site.
                </p>
              </div>
            </div>

            <CardContent className="p-5 sm:p-6 flex-1">
              <form onSubmit={handleHolidaySubmit} className="space-y-5">
                {holidayMessage && (
                  <div
                    className={`p-3 rounded-md text-sm font-medium border-l-4 ${holidayMessage.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-500" : "bg-red-50 text-red-800 border-red-500"}`}
                  >
                    {holidayMessage.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Select Project Site
                    </Label>
                    <Select
                      value={holidayProject}
                      onValueChange={setHolidayProject}
                    >
                      <SelectTrigger className="w-full h-11 bg-slate-50/50 border-slate-200 shadow-sm focus:ring-emerald-500">
                        <SelectValue placeholder="-- Choose Project --">
                          {holidayProject
                            ? activeProjects.find(
                                (p) => String(p._id) === String(holidayProject),
                              )?.name || "Select Project"
                            : "-- Choose Project --"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        className="w-[var(--radix-select-trigger-width)] max-h-[300px]"
                      >
                        {activeProjects.map((p) => (
                          <SelectItem key={p._id} value={String(p._id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Select Holiday Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="date"
                        value={holidayDate}
                        onChange={(e) => {
                          setHolidayDate(e.target.value);
                          setHolidayMessage(null);
                        }}
                        className="pl-9 h-11 bg-slate-50/50 border-slate-200 shadow-sm text-slate-700 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Action
                  </Label>
                  <Select
                    value={holidayAction}
                    onValueChange={setHolidayAction}
                  >
                    <SelectTrigger className="w-full h-11 bg-slate-50/50 border-slate-200 shadow-sm focus:ring-emerald-500">
                      <SelectValue placeholder="-- Choose Action --">
                        {holidayAction === "add" ? (
                          <span className="text-emerald-700 font-bold">
                            Add Holiday
                          </span>
                        ) : (
                          <span className="text-red-700 font-bold">
                            Remove Holiday
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      className="w-[var(--radix-select-trigger-width)]"
                    >
                      <SelectItem
                        value="add"
                        className="text-emerald-700 font-bold"
                      >
                        Add Holiday
                      </SelectItem>
                      <SelectItem
                        value="remove"
                        className="text-red-700 font-bold"
                      >
                        Remove Holiday
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t mt-6">
                  <Button
                    type="submit"
                    disabled={holidayLoading}
                    className="w-full h-11 font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all"
                  >
                    {holidayLoading ? (
                      <span className="flex items-center">
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />{" "}
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Save className="mr-2 h-4 w-4" /> Save Holiday Update
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
