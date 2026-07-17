const ExcelJS = require("exceljs");
const Guard = require("../models/Guard");
const Project = require("../models/Project");
const Attendance = require("../models/Attendance");
const { buildMonthReport, splitReportByProject } = require("../utils/attendance");
const { monthBounds } = require("../utils/projectMembership");

function getColLetter(col) {
  let temp, letter = '';
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

async function getRelevantGuards(year, month, projectIdFilter) {
  let start, end;
  
  if (String(year).includes("-")) {
    start = year;
    end = month;
  } else {
    const bounds = monthBounds(parseInt(year, 10), parseInt(month, 10));
    start = bounds.start;
    end = bounds.end;
  }

  const activeGuards = await Guard.find({ active: true }).populate("projectId", "name");
  const inactiveGuards = await Guard.find({ active: false }).populate("projectId", "name");

  const allGuards = [...activeGuards, ...inactiveGuards].filter(g => g.department !== "OFFICE");
  const scopedGuards = [];

  for (const g of allGuards) {
    let include = false;

    const history = g.projectHistory && g.projectHistory.length
        ? g.projectHistory
        : [{ projectId: g.projectId, startDate: "2000-01-01", endDate: null }];

    const hasAttendance = await Attendance.exists({ guardId: g._id, date: { $gte: start, $lte: end } });

    if (g.active) {
      if (!projectIdFilter || projectIdFilter === "all") {
        include = true;
      } else if (projectIdFilter === "relievers") {
        if (g.isReliever) include = true;
      } else {
        const assignedToThis = history.some(h => h.projectId?.toString() === projectIdFilter && h.startDate <= end && (h.endDate || "9999-12-31") >= start);
        const currentMatch = g.projectId?._id?.toString() === projectIdFilter || g.projectId?.toString() === projectIdFilter;
        if (assignedToThis || currentMatch) include = true;
      }
    } else {
      // Inactive guard: ONLY include if they have attendance in that month/project
      if (!projectIdFilter || projectIdFilter === "all") {
        if (hasAttendance) include = true;
      } else if (projectIdFilter === "relievers") {
        if (g.isReliever && hasAttendance) include = true;
      } else {
        const workedAtThis = await Attendance.exists({ guardId: g._id, projectId: projectIdFilter, date: { $gte: start, $lte: end } });
        if (workedAtThis) include = true;
      }
    }
    
    if (include) scopedGuards.push(g);
  }
  return scopedGuards.sort((a, b) => a.name.localeCompare(b.name));
}

async function getGuardsForReport(req, res) {
  const { year, month, projectId } = req.query;
  const scoped = await getRelevantGuards(year, month, projectId);
  res.json(scoped);
}

async function downloadExcelReport(req, res) {
  const { year, month, projectId } = req.query;

  let startStr, endStr;
  if (String(year).includes("-")) {
    startStr = year; endStr = month;
  } else {
    const y = parseInt(year, 10); const m = parseInt(month, 10);
    const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
    startStr = `${prefix}-01`; endStr = `${prefix}-31`;
  }

  const guards = await getRelevantGuards(year, month, projectId);

  const dates = [];
  let currD = new Date(startStr);
  const finalD = new Date(endStr);
  while (currD <= finalD) {
    dates.push(new Date(currD).toISOString().split('T')[0]);
    currD.setDate(currD.getDate() + 1);
  }
  const daysInRange = dates.length;

  let contextProjectName = null;
  if (projectId && projectId !== "all" && projectId !== "relievers") {
    const p = await Project.findById(projectId);
    contextProjectName = p ? p.name : null;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Attendance_Report`);

  const DAY_COL_START = 5;
  const TOTAL_WORKING_DAYS_COL = DAY_COL_START + daysInRange + 7;

  const titleRow = sheet.addRow(["DYNAMIC SECURITY AND MANPOWER SERVICE PVT. LTD."]);
  sheet.mergeCells(1, 1, 1, TOTAL_WORKING_DAYS_COL);
  titleRow.font = { size: 16, bold: true, color: { argb: "FF0F172A" } };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 30;

  const subtitleRow = sheet.addRow([`ATTENDANCE REPORT (${startStr} to ${endStr})`]);
  sheet.mergeCells(2, 1, 2, TOTAL_WORKING_DAYS_COL);
  subtitleRow.font = { size: 14, bold: true, color: { argb: "FF1E2B3E" } };
  subtitleRow.alignment = { horizontal: "center", vertical: "middle" };
  subtitleRow.height = 25;

  const currentDateTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" });
  const timestampRow = sheet.addRow([`Generated on: ${currentDateTime}`]);
  sheet.mergeCells(3, 1, 3, TOTAL_WORKING_DAYS_COL);
  timestampRow.font = { size: 11, italic: true, color: { argb: "FF475569" } };
  timestampRow.alignment = { horizontal: "right", vertical: "middle" };
  timestampRow.height = 20;

  const headerRow1 = ["GUARD", "PROJECT", "DEPARTMENT", "SALARY"];
  const headerRow2 = ["", "", "", ""];
  
  dates.forEach(dStr => {
    const dObj = new Date(dStr);
    headerRow1.push(dObj.getDate());
    headerRow2.push(dObj.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase());
  });

  const tailHeaders = [
    "PRESENT", "ABSENT", "DOUBLE DUTY", "HALF DUTY", "WEEKLY OFF (TAKEN)",
    "HOLIDAY", "WEEKLY OFF (NEED TO BE PAID)", "TOTAL WORKING DAYS",
  ];
  headerRow1.push(...tailHeaders);
  tailHeaders.forEach(() => headerRow2.push(""));

  const thinBorder = {
    top: { style: "thin", color: { argb: "FFBFBFBF" } },
    left: { style: "thin", color: { argb: "FFBFBFBF" } },
    bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
    right: { style: "thin", color: { argb: "FFBFBFBF" } },
  };

  sheet.addRow(headerRow1);
  sheet.addRow(headerRow2);

  const headerColors = [
    "FF1E2B3E", "FF1E2B3E", "FF1E2B3E", "FF1E2B3E",
    ...Array(daysInRange).fill("FF1E2B3E"),
    "FF10B981", "FFEF4444", "FFA855F7", "FFF59E0B", "FF94A3B8", "FF3B82F6", "FF6366F1", "FF1E2B3E",
  ];

  [4, 5].forEach((rowNum) => {
    sheet.getRow(rowNum).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(rowNum).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColors[colNumber - 1] || "FF1E2B3E" }};
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thinBorder;
    });
  });

  const fillFor = { P: "FFD1FAE5", A: "FFFEE2E2", DD: "FFF3E8FF", HD: "FFFEF3C7", OFF: "FFE2E8F0", H: "FFDBEAFE" };
  const fontFor = { P: "FF065F46", A: "FF991B1B", DD: "FF6B21A8", HD: "FF92400E", OFF: "FF334155", H: "FF1E40AF" };
  const SALARY_COL = 4;
  const WEEK_OFF_COL = DAY_COL_START + daysInRange + 6; 

  const allRowsToExport = [];
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

  for (const guard of guards) {
    let rawAttendanceDocs = await Attendance.find({
      guardId: guard._id,
      date: { $gte: startStr, $lte: endStr },
    });

    const guardForReport = guard.toObject ? guard.toObject() : { ...guard };
    if (guardForReport.projectId && guardForReport.projectId._id) {
        guardForReport.projectId = guardForReport.projectId._id.toString();
    }

    const attendanceDocs = rawAttendanceDocs.map((doc) => {
      const docObj = doc.toObject ? doc.toObject() : doc;
      let pid = docObj.projectId || guardForReport.projectId;
      if (pid) docObj.projectId = pid._id ? pid._id.toString() : pid.toString();
      return docObj;
    });

    let historyIds = [];
    if (guardForReport.projectHistory && guardForReport.projectHistory.length) {
      historyIds = guardForReport.projectHistory.map((h) => h.projectId?.toString()).filter(Boolean);
    } else if (guardForReport.projectId) {
      historyIds = [guardForReport.projectId.toString()];
    }
    attendanceDocs.forEach((a) => { if (a.projectId) historyIds.push(a.projectId.toString()); });

    const uniqueIds = [...new Set(historyIds)];
    const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
    const projectsById = {};
    projectsDocs.forEach((p) => { projectsById[p._id.toString()] = p; });

    const safeDays = attendanceDocs.map(a => ({
        date: a.date,
        status: a.status,
        projectName: projectsById[a.projectId]?.name || "Unassigned",
        projectType: projectsById[a.projectId]?.projectType,
        time: a.time,
        markedByAdmin: a.markedByAdmin
    }));

    let pNames = [...new Set(safeDays.map((d) => d.projectName).filter(Boolean))];
    const assignedProjName = guard.isReliever ? "Reliever" : (guard.projectId?.name || "Unassigned");

    if (contextProjectName) {
      const isAssignedToContext = !guard.isReliever && (
        guard.projectId?.name === contextProjectName || 
        (guard.projectHistory || []).some(h => h.endDate === null && h.projectId?.name === contextProjectName)
      );
      if (isAssignedToContext && !pNames.includes(contextProjectName)) {
        pNames.push(contextProjectName);
      }
      if (pNames.length === 0 && assignedProjName === contextProjectName) {
        pNames.push(contextProjectName);
      }
    } else if (projectId === "all") {
      if (pNames.length === 0) pNames.push(assignedProjName);
    } else if (projectId === "relievers") {
      if (guard.isReliever && pNames.length === 0) pNames.push("Reliever");
    }

    const localSplits = [];

    if (pNames.length === 0) {
      const splitDays = dates.map(dateStr => {
        const d = safeDays.find((x) => x.date === dateStr);
        if (d) return d;
        const isPast = dateStr <= todayStr;
        return {
          date: dateStr, status: !guard.isReliever && isPast ? "A" : null,
          projectName: null, projectType: null, time: null, markedByAdmin: false,
        };
      });

      const localStats = { P: 0, A: 0, DD: 0, HD: 0, OFF: 0, H: 0, calendarOffs: 0 };
      splitDays.forEach((d) => {
        if (d?.status) {
          if (d.status === "OFF") localStats.calendarOffs++;
          else localStats[d.status] = (localStats[d.status] || 0) + 1;
        }
      });

      const p = Number(localStats.P || 0); const dd = Number(localStats.DD || 0);
      const hd = Number(localStats.HD || 0); const h = Number(localStats.H || 0);
      const off = Number(localStats.calendarOffs || 0);
      const pureDays = p + dd * 2 + hd * 0.5 + h;
      const workingDays = p + dd + hd + h;

      let earnedWeekOff = 0;
      if (!guard.isReliever) earnedWeekOff = Math.min(Math.floor(workingDays / 6), 4);
      const payableWeekOff = Math.max(0, earnedWeekOff - off);
      
      localSplits.push({
          projectName: assignedProjName,
          projectType: guard.isReliever ? "" : "WEEKLY OFF",
          days: splitDays,
          stats: { ...localStats, weekOffs: payableWeekOff, totalWorkingDays: pureDays + payableWeekOff }
      });
    } else {
      for (const pName of pNames) {
        if (contextProjectName && contextProjectName !== pName) continue;

        const splitDays = dates.map(dateStr => {
          const d = safeDays.find((x) => x.date === dateStr && x.projectName === pName);
          if (d) return d;
          const isPast = dateStr <= todayStr;
          return {
            date: dateStr, status: !guard.isReliever && isPast ? "A" : null,
            projectName: pName, projectType: null, time: null, markedByAdmin: false,
          };
        });

        const pType = safeDays.find((d) => d.projectName === pName)?.projectType || "WEEKLY OFF";
        const localStats = { P: 0, A: 0, DD: 0, HD: 0, OFF: 0, H: 0, calendarOffs: 0 };
        splitDays.forEach((d) => {
          if (d?.status) {
            if (d.status === "OFF") localStats.calendarOffs++;
            else localStats[d.status] = (localStats[d.status] || 0) + 1;
          }
        });

        const p = Number(localStats.P || 0); const dd = Number(localStats.DD || 0);
        const hd = Number(localStats.HD || 0); const h = Number(localStats.H || 0);
        const off = Number(localStats.calendarOffs || 0);
        const isAllDay = String(pType).toUpperCase() === "ALL DAY";
        const pureDays = p + dd * 2 + hd * 0.5 + h;
        const workingDays = p + dd + hd + h;

        let earnedWeekOff = 0;
        if (!isAllDay && !guard.isReliever) earnedWeekOff = Math.min(Math.floor(workingDays / 6), 4);
        const payableWeekOff = Math.max(0, earnedWeekOff - off);

        localSplits.push({
            projectName: pName,
            projectType: pType,
            days: splitDays,
            stats: { ...localStats, weekOffs: payableWeekOff, totalWorkingDays: pureDays + payableWeekOff }
        });
      }
    }

    for (const split of localSplits) {
       allRowsToExport.push({ guard, split });
    }
  }

  allRowsToExport.sort((a, b) => {
    const isRelieverA = a.guard.isReliever ? 1 : 0;
    const isRelieverB = b.guard.isReliever ? 1 : 0;
    if (isRelieverA !== isRelieverB) return isRelieverA - isRelieverB;

    const pA = a.split.projectName || "Unassigned";
    const pB = b.split.projectName || "Unassigned";
    const projectCompare = pA.toLowerCase().localeCompare(pB.toLowerCase());
    if (projectCompare !== 0) return projectCompare;

    return (a.guard.name || "").localeCompare(b.guard.name || "");
  });

  for (const data of allRowsToExport) {
    const { guard, split } = data;
    const pType = split.projectType || split.days.find((d) => d.projectName === split.projectName)?.projectType || "";
    const typeStr = String(pType).toUpperCase() === "ALL DAY" ? "All Day" : String(pType).toUpperCase() === "WEEKLY OFF" ? "Weekly Off" : "";
    const projNameWithDesc = split.projectName ? `${split.projectName}${typeStr ? ` (${typeStr})` : ""}` : "Unassigned";

    const row = [guard.name, projNameWithDesc, guard.department, Number(guard.salary) || 0];
    split.days.forEach(() => row.push(""));

    const p = Number(split.stats.P || 0);
    const dd = Number(split.stats.DD || 0);
    const hd = Number(split.stats.HD || 0);
    const wOffs = Number(split.stats.weekOffs || 0);

    row.push(
      p, Number(split.stats.A || 0), dd, hd,
      Number(split.stats.calendarOffs || split.stats.OFF || 0), 
      Number(split.stats.H || 0),
      wOffs, 0 
    );

    const excelRow = sheet.addRow(row);
    excelRow.height = 30;

    excelRow.getCell(SALARY_COL).numFmt = "#,##0";
    excelRow.getCell(WEEK_OFF_COL).numFmt = "0.00";
    excelRow.getCell(TOTAL_WORKING_DAYS_COL).numFmt = "0.00";

    const statCols = [
      { col: DAY_COL_START + daysInRange, key: "P" }, { col: DAY_COL_START + daysInRange + 1, key: "A" },
      { col: DAY_COL_START + daysInRange + 2, key: "DD" }, { col: DAY_COL_START + daysInRange + 3, key: "HD" },
      { col: DAY_COL_START + daysInRange + 4, key: "OFF" }, { col: DAY_COL_START + daysInRange + 5, key: "H" },
    ];

    statCols.forEach((sc) => {
      const cell = excelRow.getCell(sc.col);
      cell.numFmt = "0.00";
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillFor[sc.key] } };
      cell.font = { color: { argb: fontFor[sc.key] }, bold: true };
    });

    const woCell = excelRow.getCell(WEEK_OFF_COL);
    woCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" }};
    woCell.font = { color: { argb: "FF312E81" }, bold: true };

    const tdCell = excelRow.getCell(TOTAL_WORKING_DAYS_COL);
    tdCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" }};
    tdCell.font = { color: { argb: "FF0F172A" }, bold: true };

    const R = excelRow.number;
    const S = DAY_COL_START + daysInRange;
    const formulaStr = `${getColLetter(S)}${R} + (${getColLetter(S+2)}${R}*2) + (${getColLetter(S+3)}${R}*0.5) + ${getColLetter(S+5)}${R} + ${getColLetter(S+6)}${R}`;
    tdCell.value = { formula: formulaStr, result: Number(split.stats.totalWorkingDays || 0) };

    split.days.forEach((d, i) => {
      const cell = excelRow.getCell(DAY_COL_START + i);

      if (d.status) {
        if (d.markedByAdmin) {
          const richTextParts = [
            { text: d.status, font: { color: { argb: fontFor[d.status] || "FF000000" }, bold: true } },
            { text: "*", font: { color: { argb: "FFFF0000" }, bold: true } },
          ];
          if (d.time) richTextParts.push({ text: `\n${d.time}`, font: { color: { argb: fontFor[d.status] || "FF000000" }, bold: true } });
          cell.value = { richText: richTextParts };
        } else {
          cell.value = `${d.status}${d.time ? `\n${d.time}` : ""}`;
        }
        if (fillFor[d.status]) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillFor[d.status] } };
          if (!d.markedByAdmin) cell.font = { color: { argb: fontFor[d.status] }, bold: true };
        }
      } else {
        cell.value = "";
      }
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (!cell.alignment) cell.alignment = { vertical: "middle" };
    });
  }

  sheet.getColumn(1).width = 22; sheet.getColumn(2).width = 25; sheet.getColumn(3).width = 16; sheet.getColumn(4).width = 12;
  for (let i = 0; i < daysInRange; i++) sheet.getColumn(DAY_COL_START + i).width = 9;
  sheet.getColumn(DAY_COL_START + daysInRange + 4).width = 20; 
  sheet.getColumn(WEEK_OFF_COL).width = 30; 
  sheet.getColumn(TOTAL_WORKING_DAYS_COL).width = 15;

  let safeProjectName = "All_Projects";
  if (projectId === "relievers") {
    safeProjectName = "Relievers";
  } else if (contextProjectName) {
    safeProjectName = contextProjectName.replace(/\s+/g, '_');
  }

  const fileName = `AttendanceReport_${startStr}_${endStr}_${safeProjectName}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.end(await workbook.xlsx.writeBuffer());
}

module.exports = { downloadExcelReport, getGuardsForReport };