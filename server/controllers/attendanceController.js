const Attendance = require("../models/Attendance");
const Guard = require("../models/Guard");
const Project = require("../models/Project");
const SalaryRecord = require("../models/SalaryRecord");
const { buildMonthReport } = require("../utils/attendance");

async function markAttendance(req, res) {
  try {
    const { date, status, projectId } = req.body;
    const guardId =
      req.user.role === "admin" ? req.body.guardId : req.user.guardId;

    if (!guardId || !date)
      return res.status(400).json({ message: "guardId and date are required" });
    if (
      status !== null &&
      !["P", "A", "DD", "HD", "OFF", "H"].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const guard = await Guard.findById(guardId);
    if (!guard) return res.status(404).json({ message: "Guard not found" });

    if (req.user.role !== "admin") {
      const todayStr = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      if (date !== todayStr)
        return res.status(403).json({ message: "Past attendance is locked." });
    }

    let finalProjectId = projectId || null;
    if (!guard.isReliever && !finalProjectId) {
      const history =
        guard.projectHistory && guard.projectHistory.length
          ? guard.projectHistory
          : [
              {
                projectId: guard.projectId,
                startDate: "2000-01-01",
                endDate: null,
              },
            ];
      const stint = history.find(
        (h) => date >= h.startDate && (h.endDate === null || date <= h.endDate),
      );
      const chosen = stint || history[history.length - 1];
      finalProjectId =
        chosen && chosen.projectId ? chosen.projectId : guard.projectId;
    }

    if (req.user.role !== "admin") {
      const existingRecord = await Attendance.findOne({
        guardId,
        date,
        projectId: finalProjectId,
      });
      if (existingRecord && existingRecord.isLocked) {
        return res.status(403).json({
          message:
            "Admin has marked this day as a Holiday. You cannot overwrite it.",
        });
      }
    }

    if (status === null || status === "null") {
      await Attendance.findOneAndDelete({
        guardId,
        date,
        projectId: finalProjectId,
      });
      return res.json({ message: "Attendance cleared" });
    }

    const timeString = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const updatedRecord = await Attendance.findOneAndUpdate(
      { guardId, date, projectId: finalProjectId },
      { status, time: timeString, markedByAdmin: req.user.role === "admin" },
      { new: true, upsert: true },
    );

    res.json({
      message: "Attendance updated successfully",
      record: updatedRecord,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark attendance" });
  }
}

async function getMonthAttendance(req, res) {
  try {
    const { guardId } = req.params;
    let { year, month } = req.query;
    if (!year || !month)
      return res.status(400).json({ message: "year and month are required" });

    const guard = await Guard.findById(guardId).populate("projectId", "name");
    if (!guard) return res.status(404).json({ message: "Guard not found" });

    const guardForReport = guard.toObject();
    if (guardForReport.projectId && guardForReport.projectId._id) {
      guardForReport.projectId = guardForReport.projectId._id.toString();
    }

    let startDate, endDate;
    if (String(year).includes("-")) {
      startDate = year;
      endDate = month;
    } else {
      const prefix = `${parseInt(year, 10)}-${String(parseInt(month, 10) + 1).padStart(2, "0")}`;
      startDate = `${prefix}-01`;
      endDate = `${prefix}-31`;
    }

    const rawAttendanceDocs = await Attendance.find({
      guardId,
      date: { $gte: startDate, $lte: endDate },
    });
    const attendanceDocs = rawAttendanceDocs.map((doc) => {
      const d = doc.toObject();
      let pid = d.projectId || guardForReport.projectId;
      if (pid) d.projectId = pid._id ? pid._id.toString() : pid.toString();
      return d;
    });

    const projectIds = [
      guardForReport.projectId,
      ...(guardForReport.projectHistory || []).map((h) =>
        h.projectId?.toString(),
      ),
      ...attendanceDocs.map((a) => a.projectId),
    ].filter(Boolean);
    const uniqueIds = [...new Set(projectIds)];
    const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
    const projectsById = {};
    projectsDocs.forEach((p) => {
      projectsById[p._id.toString()] = p;
    });

    if (String(year).includes("-")) {
      const flatDays = attendanceDocs.map((a) => ({
        date: a.date,
        status: a.status,
        projectName: projectsById[a.projectId]?.name || "Unassigned",
        projectType: projectsById[a.projectId]?.type, // FIX: Properly mapped to `.type`
        time: a.time,
        markedByAdmin: a.markedByAdmin,
      }));
      return res.json({
        days: flatDays,
        stats: {},
        guard,
        project: guard.projectId,
        isPaid: false,
      });
    }

    const safeYear =
      parseInt(String(year).split("-")[0], 10) || new Date().getFullYear();
    const safeMonth = String(year).includes("-")
      ? parseInt(String(year).split("-")[1], 10) - 1
      : parseInt(month, 10);
    const fullReport = buildMonthReport(
      guardForReport,
      projectsById,
      safeYear,
      safeMonth,
      attendanceDocs,
    );

    const records = await SalaryRecord.find({
      guardId,
      year: safeYear,
      month: safeMonth,
    });
    const isPaid = records.some((r) => r.isPaid === true);

    res.json({
      days: fullReport.days,
      stats: fullReport.stats,
      guard,
      project: guard.projectId,
      isPaid,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance" });
  }
}

async function adminUpdateAttendance(req, res) {
  try {
    const { guardId, date, status, projectId } = req.body;
    if (!guardId || !date || !projectId)
      return res.status(400).json({ message: "Missing required fields" });

    if (status === null || status === "null") {
      await Attendance.findOneAndDelete({ guardId, date, projectId });
      return res.json({ message: "Attendance cleared by Admin" });
    }

    const timeString = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const isLocked = status === "H";

    const updatedRecord = await Attendance.findOneAndUpdate(
      { guardId, date, projectId },
      { status, time: timeString, markedByAdmin: true, isLocked },
      { new: true, upsert: true },
    );

    res.json({ message: "Updated by Admin", record: updatedRecord });
  } catch (error) {
    res.status(500).json({ message: "Admin update failed" });
  }
}

module.exports = { markAttendance, getMonthAttendance, adminUpdateAttendance };
