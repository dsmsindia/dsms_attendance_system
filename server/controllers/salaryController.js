const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Guard = require("../models/Guard");
const Project = require("../models/Project");
const Attendance = require("../models/Attendance");
const SalaryRecord = require("../models/SalaryRecord");
const {
  buildMonthReport,
  splitReportByProject,
} = require("../utils/attendance");
const { monthBounds } = require("../utils/projectMembership");

// FIX: Regex to validate MongoDB ObjectIds to prevent 500 CastErrors
const validObjectIdRegex = /^[0-9a-fA-F]{24}$/;

async function getRelevantGuards(year, month, projectIdFilter) {
  const { start, end } = monthBounds(year, month);

  const activeGuards = await Guard.find({ active: true }).populate(
    "projectId",
    "name",
  );
  const inactiveGuards = await Guard.find({ active: false }).populate(
    "projectId",
    "name",
  );

  const allGuards = [...activeGuards, ...inactiveGuards].filter(
    (g) => !g.isReliever,
  );
  const scopedGuards = [];

  for (const g of allGuards) {
    let include = false;
    const hasAttendance = await Attendance.exists({
      guardId: g._id,
      date: { $gte: start, $lte: end },
    });

    if (projectIdFilter === "office") {
      if (g.department === "OFFICE" && (g.active || hasAttendance))
        include = true;
    } else if (g.department === "OFFICE") {
      if (projectIdFilter === "all" && (g.active || hasAttendance))
        include = true;
      else if (
        g.projectId &&
        g.projectId._id.toString() === projectIdFilter &&
        (g.active || hasAttendance)
      )
        include = true;
    } else {
      const history =
        g.projectHistory && g.projectHistory.length
          ? g.projectHistory
          : [
              {
                projectId: g.projectId,
                startDate: "2000-01-01",
                endDate: null,
              },
            ];

      if (g.active) {
        if (!projectIdFilter || projectIdFilter === "all") {
          include = true;
        } else {
          // FIX: Safely extract the ID string whether it is populated or raw
          const assignedToThis = history.some((h) => {
            const hIdStr = h.projectId?._id
              ? h.projectId._id.toString()
              : h.projectId?.toString();

            return (
              hIdStr === projectIdFilter &&
              h.startDate <= end &&
              (h.endDate || "9999-12-31") >= start
            );
          });
          
          const workedAtThis = await Attendance.exists({
            guardId: g._id,
            projectId: projectIdFilter,
            date: { $gte: start, $lte: end },
          });
          if (assignedToThis || workedAtThis) include = true;
        }
      } else {
        if (!projectIdFilter || projectIdFilter === "all") {
          if (hasAttendance) include = true;
        } else {
          const workedAtThis = await Attendance.exists({
            guardId: g._id,
            projectId: projectIdFilter,
            date: { $gte: start, $lte: end },
          });
          if (workedAtThis) include = true;
        }
      }
    }
    if (include) scopedGuards.push(g);
  }
  return scopedGuards;
}

function calculateSalaryMath(
  guard,
  splitStats,
  year,
  month,
  editableData,
  carriedEdAmount,
  carriedSkipPfEsic = false,
  customDaysInMonth = null,
  carriedOverrides = {},
  splitSalary = null,
) {
  const O = editableData?.overrides || carriedOverrides || {};
  const safeO = (key, fallback) =>
    O[key] !== undefined && O[key] !== null ? Number(O[key]) : fallback;

  const standardDays = new Date(year, month + 1, 0).getDate();
  const daysInMonth = safeO("daysInMonth", customDaysInMonth || standardDays);

  const baseWorkDays =
    (Number(splitStats?.P) || 0) +
    (Number(splitStats?.DD) || 0) * 2 +
    (Number(splitStats?.HD) || 0) * 0.5 +
    (Number(splitStats?.H) || 0);

  let defaultTotalDuty, defaultExtraDuty, defaultLeaveAdj, defaultPresent;

  if (guard.department === "OFFICE") {
    defaultTotalDuty = daysInMonth;
    defaultExtraDuty = 0;
    defaultLeaveAdj = 4;
    defaultPresent = Math.max(0, daysInMonth - 4);
  } else {
    const rawTotalDuty = baseWorkDays + (Number(splitStats?.weekOffs) || 0);
    defaultLeaveAdj = rawTotalDuty <= 4 ? 0 : 4;
    defaultTotalDuty = Math.min(rawTotalDuty, daysInMonth);
    defaultExtraDuty = Math.max(0, rawTotalDuty - daysInMonth);
    defaultPresent = Math.max(0, defaultTotalDuty - defaultLeaveAdj);
  }

  const presentDays = safeO("presentDays", defaultPresent);
  const leaveAdjustments = safeO("leaveAdjustments", defaultLeaveAdj);
  const extraDuty = safeO("extraDuty", defaultExtraDuty);
  const totalDuty = safeO("totalDuty", presentDays + leaveAdjustments);

  const baseSalaryForSplit =
    splitSalary !== null ? splitSalary : Number(guard.salary) || 0;
  const minWages = safeO("minWages", baseSalaryForSplit);

  const preciseDailyRate = minWages / daysInMonth;

  const baseGross =
    totalDuty === daysInMonth
      ? minWages
      : Math.round(preciseDailyRate * totalDuty);
  const grossWages = safeO("grossWages", baseGross);

  const actualPerDayAmount = safeO(
    "perDayAmount",
    Math.round(preciseDailyRate),
  );
  const extraDutyPay = safeO(
    "extraDutyPay",
    Math.round(actualPerDayAmount * extraDuty),
  );

  const basicPay = safeO("basicPay", Math.round(grossWages * 0.5));
  const hra = safeO("hra", Math.round(grossWages * 0.2));
  const conveyance = safeO("conveyance", Math.round(grossWages * 0.1));
  const washing = safeO("washing", Math.round(grossWages * 0.1));
  const additional = safeO(
    "additional",
    Math.round(grossWages - (basicPay + hra + conveyance + washing)),
  );

  const skipPfEsic = editableData?.skipPfEsic ?? carriedSkipPfEsic;

  const epfEmp = skipPfEsic ? 0 : safeO("epfEmp", Math.round(basicPay * 0.12));
  const esicEmp = skipPfEsic
    ? 0
    : safeO("esicEmp", Math.round(grossWages * 0.0075));

  let calcPTax = 0;
  if (grossWages > 40000) calcPTax = 200;
  else if (grossWages > 25000) calcPTax = 150;
  else if (grossWages > 15000) calcPTax = 130;
  else if (grossWages > 10000) calcPTax = 110;
  const pTax = safeO("pTax", calcPTax);

  const epfEmployer = skipPfEsic
    ? 0
    : safeO("epfEmployer", Math.round(basicPay * 0.12));
  const adminCharges = skipPfEsic
    ? 0
    : safeO("adminCharges", Math.round(basicPay * 0.01));
  const esicEmployer = skipPfEsic
    ? 0
    : safeO("esicEmployer", Math.round(grossWages * 0.0325));

  const bonus = Math.round(Number(editableData?.bonus) || 0);
  const incrementAmount = Math.round(
    Number(editableData?.edAmount ?? carriedEdAmount) || 0,
  );
  const advance = Math.round(Number(editableData?.advance) || 0);
  const othersDeduction = Math.round(
    Number(editableData?.othersDeduction) || 0,
  );

  const ctc = Math.round(
    grossWages + extraDutyPay + epfEmployer + adminCharges + esicEmployer,
  );
  const netSalary = Math.round(
    grossWages +
      extraDutyPay +
      bonus +
      incrementAmount -
      (epfEmp + esicEmp + pTax + advance + othersDeduction),
  );

  return {
    daysInMonth,
    perDayAmount: actualPerDayAmount,
    presentDays,
    leaveAdjustments,
    totalDuty,
    extraDuty,
    extraDutyPay,
    grossWages,
    basicPay,
    hra,
    conveyance,
    washing,
    additional,
    epfEmp,
    esicEmp,
    pTax,
    epfEmployer,
    adminCharges,
    esicEmployer,
    bonus,
    edAmount: incrementAmount,
    advance,
    othersDeduction,
    ctc,
    netSalary,
    workDays: baseWorkDays,
    totalPayableDays: totalDuty,
    skipPfEsic,
    overrides: O,
    minWages,
  };
}

async function getSalarySheet(req, res) {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  const projectId = req.query.projectId;

  try {
    const guards = await getRelevantGuards(year, month, projectId);
    const result = [];

    for (const guard of guards) {
      let splits = [];
      let projectsById = {};

      const guardForReport = guard.toObject();
      if (guardForReport.projectId && guardForReport.projectId._id) {
        guardForReport.projectId = guardForReport.projectId._id.toString();
      }

      if (guard.department === "OFFICE") {
        const pName = guard.projectId?.name || "Head Office";
        splits = [{ projectName: pName, stats: {} }];
      } else {
        const wideStart = new Date(year, month - 1, 20)
          .toISOString()
          .split("T")[0];
        const wideEnd = new Date(year, month + 1, 5)
          .toISOString()
          .split("T")[0];
        let allRawAttendance = await Attendance.find({
          guardId: guard._id,
          date: { $gte: wideStart, $lte: wideEnd },
        });

        const attendanceDocs = allRawAttendance.map((doc) => {
          const d = doc.toObject();
          let pid = d.projectId || guardForReport.projectId;
          if (pid) d.projectId = pid._id ? pid._id.toString() : pid.toString();
          return d;
        });

        let historyIds = [];
        if (guard.projectHistory && guard.projectHistory.length) {
          historyIds = guard.projectHistory
            .map((h) => h.projectId?.toString())
            .filter(Boolean);
        } else if (guardForReport.projectId) {
          historyIds = [guardForReport.projectId.toString()];
        }
        attendanceDocs.forEach((a) => {
          if (a.projectId) historyIds.push(a.projectId.toString());
        });

        const uniqueIds = [...new Set(historyIds)].filter(id => id && validObjectIdRegex.test(id.toString()));
        const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
        projectsDocs.forEach((p) => {
          projectsById[p._id.toString()] = p;
        });

        const fullReport = buildMonthReport(
          guardForReport,
          projectsById,
          year,
          month,
          attendanceDocs,
        );
        splits = splitReportByProject(fullReport, year, month);

        for (const split of splits) {
          let isNarayana =
            split.projectName &&
            split.projectName.toLowerCase().startsWith("narayana school");
          if (isNarayana) {
            const prevMonthDate = new Date(year, month - 1, 26);
            const currMonthDate = new Date(year, month, 25);

            const pYear = prevMonthDate.getFullYear();
            const pMonth = String(prevMonthDate.getMonth() + 1).padStart(
              2,
              "0",
            );
            const cYear = currMonthDate.getFullYear();
            const cMonth = String(currMonthDate.getMonth() + 1).padStart(
              2,
              "0",
            );

            let qStart = `${pYear}-${pMonth}-26`;
            let qEnd = `${cYear}-${cMonth}-25`;

            const utc1 = Date.UTC(pYear, prevMonthDate.getMonth(), 26);
            const utc2 = Date.UTC(cYear, currMonthDate.getMonth(), 25);
            split.customDaysInMonth =
              Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;

            let projIdStr = Object.values(projectsById)
              .find((p) => p.name === split.projectName)
              ?._id?.toString();
            let nDocs = allRawAttendance.filter((a) => {
              let pid = a.projectId?._id
                ? a.projectId._id.toString()
                : a.projectId?.toString();
              return pid === projIdStr && a.date >= qStart && a.date <= qEnd;
            });

            let nStats = {
              P: 0,
              A: 0,
              DD: 0,
              HD: 0,
              OFF: 0,
              H: 0,
              calendarOffs: 0,
            };
            nDocs.forEach((d) => {
              if (d.status === "OFF") nStats.calendarOffs++;
              else if (d.status) nStats[d.status] = (nStats[d.status] || 0) + 1;
            });
            let wDays = nStats.P + nStats.DD + nStats.HD + nStats.H;
            let earnedWeekOff = Math.min(Math.floor(wDays / 6), 4);
            nStats.weekOffs = Math.max(0, earnedWeekOff - nStats.calendarOffs);
            split.stats = nStats;
          }
        }
      }

      for (const split of splits) {
        if (
          projectId &&
          projectId !== "all" &&
          projectId !== "office" &&
          validObjectIdRegex.test(projectId.toString())
        ) {
          const contextProj = await Project.findById(projectId);
          if (contextProj && split.projectName !== contextProj.name) continue;
        }

        const projectRefId =
          guard.department === "OFFICE"
            ? guard.projectId?._id || guard.projectId || null
            : Object.values(projectsById).find(
                (p) => p.name === split.projectName,
              )?._id || null;

        const record = await SalaryRecord.findOne({
          guardId: guard._id,
          year,
          month,
          projectId: projectRefId && validObjectIdRegex.test(projectRefId.toString()) ? projectRefId : null,
        });

        let carriedEdAmount = 0;
        let carriedSkipPfEsic = false;
        let carriedOverrides = {};

        if (!record) {
          const pastRecord = await SalaryRecord.findOne({
            guardId: guard._id,
          }).sort({ year: -1, month: -1 });
          if (pastRecord) {
            carriedEdAmount = pastRecord.edAmount || 0;
            carriedSkipPfEsic = pastRecord.skipPfEsic || false;
            carriedOverrides = pastRecord.overrides || {};
          }
        } else {
          carriedOverrides = record.overrides || {};
        }

        let splitSalary = Number(guard.salary) || 0;
        const projectRefIdStr = projectRefId ? projectRefId.toString() : null;

        if (guard.department !== "OFFICE" && projectRefIdStr) {
          const currentProjectId = guard.projectId?._id
            ? guard.projectId._id.toString()
            : guard.projectId?.toString();
          if (currentProjectId !== projectRefIdStr) {
            const pastStints = (guard.projectHistory || [])
              .filter((h) => {
                const hId = h.projectId?._id
                  ? h.projectId._id.toString()
                  : h.projectId?.toString();
                return hId === projectRefIdStr;
              })
              .sort(
                (a, b) =>
                  new Date(b.endDate || "9999-12-31") -
                  new Date(a.endDate || "9999-12-31"),
              );

            if (
              pastStints.length > 0 &&
              pastStints[0].salary &&
              pastStints[0].salary > 0
            ) {
              splitSalary = pastStints[0].salary;
            }
          }
        }

        const math = calculateSalaryMath(
          guard,
          split.stats,
          year,
          month,
          record,
          carriedEdAmount,
          carriedSkipPfEsic,
          split.customDaysInMonth,
          carriedOverrides,
          splitSalary,
        );

        result.push({
          guard,
          projectId: projectRefId,
          projectName:
            split.projectName || guard.projectId?.name || "Unassigned",
          attendanceStats: split.stats,
          math,
          isPaid: record?.isPaid || false,
          customDaysInMonth: split.customDaysInMonth || null,
        });
      }
    }

    result.sort((a, b) => {
      const isOffA = a.guard.department === "OFFICE" ? 1 : 0;
      const isOffB = b.guard.department === "OFFICE" ? 1 : 0;
      if (isOffA !== isOffB) return isOffB - isOffA;

      const pA = a.projectName || "Unassigned";
      const pB = b.projectName || "Unassigned";
      const pCmp = pA.localeCompare(pB);
      if (pCmp !== 0) return pCmp;

      return (a.guard.name || "").localeCompare(b.guard.name || "");
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate salary sheet",
      error: error.message,
    });
  }
}

async function updateEditableFields(req, res) {
  const {
    guardId,
    year,
    month,
    projectId,
    bonus,
    edAmount,
    advance,
    othersDeduction,
    skipPfEsic,
    isPaid,
    overrides,
  } = req.body;
  try {
    const validProjectId = projectId && validObjectIdRegex.test(projectId.toString()) ? projectId : null;
    const record = await SalaryRecord.findOneAndUpdate(
      { guardId, year, month, projectId: validProjectId },
      {
        $set: {
          bonus,
          edAmount,
          advance,
          othersDeduction,
          skipPfEsic,
          isPaid,
          overrides: overrides || {},
        },
      },
      { new: true, upsert: true },
    );
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: "Failed to save record" });
  }
}

async function downloadSlip(req, res) {
  const guardId = req.query.guardId;
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);

  try {
    const guard = await Guard.findById(guardId).populate("projectId", "name");

    let projectsById = {};

    const guardForReport = guard.toObject();
    if (guardForReport.projectId && guardForReport.projectId._id) {
      guardForReport.projectId = guardForReport.projectId._id.toString();
    }

    let splits = [];

    if (guard.department === "OFFICE") {
      splits = [
        { projectName: guard.projectId?.name || "Head Office", stats: {} },
      ];
    } else {
      const wideStart = new Date(year, month - 1, 20)
        .toISOString()
        .split("T")[0];
      const wideEnd = new Date(year, month + 1, 5).toISOString().split("T")[0];
      let rawAttendanceDocs = await Attendance.find({
        guardId,
        date: { $gte: wideStart, $lte: wideEnd },
      });

      const attendanceDocs = rawAttendanceDocs.map((doc) => {
        const d = doc.toObject();
        let pid = d.projectId || guardForReport.projectId;
        if (pid) d.projectId = pid._id ? pid._id.toString() : pid.toString();
        return d;
      });

      let historyIds = [];
      if (guard.projectHistory && guard.projectHistory.length) {
        historyIds = guard.projectHistory
          .map((h) => h.projectId?.toString())
          .filter(Boolean);
      } else if (guardForReport.projectId) {
        historyIds = [guardForReport.projectId.toString()];
      }
      attendanceDocs.forEach((a) => {
        if (a.projectId) historyIds.push(a.projectId.toString());
      });

      const uniqueIds = [...new Set(historyIds)].filter(id => id && validObjectIdRegex.test(id.toString()));
      const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
      projectsDocs.forEach((p) => {
        projectsById[p._id.toString()] = p;
      });

      const fullReport = buildMonthReport(
        guardForReport,
        projectsById,
        year,
        month,
        attendanceDocs,
      );
      splits = splitReportByProject(
        fullReport,
        year,
        month,
      );

      for (const split of splits) {
        let isNarayana =
          split.projectName &&
          split.projectName.toLowerCase().startsWith("narayana school");
        if (isNarayana) {
          const prevMonthDate = new Date(year, month - 1, 26);
          const currMonthDate = new Date(year, month, 25);

          const pYear = prevMonthDate.getFullYear();
          const pMonth = String(prevMonthDate.getMonth() + 1).padStart(2, "0");
          const cYear = currMonthDate.getFullYear();
          const cMonth = String(currMonthDate.getMonth() + 1).padStart(2, "0");

          let qStart = `${pYear}-${pMonth}-26`;
          let qEnd = `${cYear}-${cMonth}-25`;

          const utc1 = Date.UTC(pYear, prevMonthDate.getMonth(), 26);
          const utc2 = Date.UTC(cYear, currMonthDate.getMonth(), 25);
          split.customDaysInMonth =
            Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;

          let projIdStr = Object.values(projectsById)
            .find((p) => p.name === split.projectName)
            ?._id?.toString();
          let nDocs = rawAttendanceDocs.filter((a) => {
            let pid = a.projectId?._id
              ? a.projectId._id.toString()
              : a.projectId?.toString();
            return pid === projIdStr && a.date >= qStart && a.date <= qEnd;
          });
          let nStats = {
            P: 0,
            A: 0,
            DD: 0,
            HD: 0,
            OFF: 0,
            H: 0,
            calendarOffs: 0,
          };
          nDocs.forEach((d) => {
            if (d.status === "OFF") nStats.calendarOffs++;
            else if (d.status) nStats[d.status] = (nStats[d.status] || 0) + 1;
          });
          let wDays = nStats.P + nStats.DD + nStats.HD + nStats.H;
          let earnedWeekOff = Math.min(Math.floor(wDays / 6), 4);
          nStats.weekOffs = Math.max(0, earnedWeekOff - nStats.calendarOffs);
          split.stats = nStats;
        }
      }
    }

    let totalGross = 0,
      totalExtraPay = 0,
      totalBasic = 0,
      totalHra = 0,
      totalConv = 0;
    let totalWash = 0,
      totalAddl = 0,
      totalEpf = 0,
      totalEsic = 0,
      totalAdvance = 0;
    let totalOthers = 0,
      totalBonus = 0,
      totalIncrement = 0;
    let projectNames = [];

    for (const split of splits) {
      const projectRefIdStr = Object.values(projectsById)
        .find((p) => p.name === split.projectName)
        ?._id?.toString();

      const record = await SalaryRecord.findOne({
        guardId,
        year,
        month,
        projectId: projectRefIdStr && validObjectIdRegex.test(projectRefIdStr.toString()) ? projectRefIdStr : null,
      });

      let carriedEdAmount = 0;
      let carriedSkipPfEsic = false;
      let carriedOverrides = {};

      if (!record) {
        const pastRecord = await SalaryRecord.findOne({ guardId }).sort({
          year: -1,
          month: -1,
        });
        if (pastRecord) {
          carriedEdAmount = pastRecord.edAmount || 0;
          carriedSkipPfEsic = pastRecord.skipPfEsic || false;
          carriedOverrides = pastRecord.overrides || {};
        }
      } else {
        carriedOverrides = record.overrides || {};
      }

      let splitSalary = Number(guard.salary) || 0;

      if (guard.department !== "OFFICE" && projectRefIdStr) {
        const currentProjectId = guard.projectId?._id
          ? guard.projectId._id.toString()
          : guard.projectId?.toString();
        if (currentProjectId !== projectRefIdStr) {
          const pastStints = (guard.projectHistory || [])
            .filter((h) => {
              const hId = h.projectId?._id
                ? h.projectId._id.toString()
                : h.projectId?.toString();
              return hId === projectRefIdStr;
            })
            .sort(
              (a, b) =>
                new Date(b.endDate || "9999-12-31") -
                new Date(a.endDate || "9999-12-31"),
            );

          if (
            pastStints.length > 0 &&
            pastStints[0].salary &&
            pastStints[0].salary > 0
          ) {
            splitSalary = pastStints[0].salary;
          }
        }
      }

      const math = calculateSalaryMath(
        guard,
        split.stats,
        year,
        month,
        record,
        carriedEdAmount,
        carriedSkipPfEsic,
        split.customDaysInMonth,
        carriedOverrides,
        splitSalary,
      );

      totalGross += math.grossWages;
      totalExtraPay += math.extraDutyPay;
      totalBasic += math.basicPay;
      totalHra += math.hra;
      totalConv += math.conveyance;
      totalWash += math.washing;
      totalAddl += math.additional;
      totalEpf += math.epfEmp;
      totalEsic += math.esicEmp;
      totalBonus += math.bonus;
      totalIncrement += math.edAmount;
      totalAdvance += math.advance;
      totalOthers += math.othersDeduction;

      if (split.projectName && !projectNames.includes(split.projectName)) {
        projectNames.push(split.projectName);
      }
    }

    let pTax = 0;
    if (totalGross > 40000) pTax = 200;
    else if (totalGross > 25000) pTax = 150;
    else if (totalGross > 15000) pTax = 130;
    else if (totalGross > 10000) pTax = 110;

    const netSalary =
      totalGross +
      totalExtraPay +
      totalBonus +
      totalIncrement -
      (totalEpf + totalEsic + pTax + totalAdvance + totalOthers);

    const doc = new PDFDocument({ margin: 20, size: "A4" });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      const formatName = (str) => {
        if (!str) return "";
        return str
          .toLowerCase()
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("_");
      };
      const formattedName = guard.name ? `_${formatName(guard.name)}` : "";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Salary_Slip_${formattedName}.pdf`,
      );
      res.send(pdfBuffer);
    });
    doc.on("error", (err) => {
      res.status(500).json({ message: "PDF Generation Failed" });
    });

    const monthNameStr = new Date(year, month).toLocaleString("en-US", {
      month: "long",
    });

    doc.rect(20, 20, 555, 800).stroke("#000000");

    const logoPath = path.join(__dirname, "../assets/logo.jpg");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 35, 30, { width: 85 });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("DYNAMIC SECURITY AND MANPOWER SERVICE PVT.LTD", 130, 35, {
        align: "center",
        underline: true,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        "VILL:RANIBASAN, PO:MAJNA, PS:CONTAI, E.MEDINIPUR, 721433, WB",
        130,
        55,
        { align: "center", underline: false },
      );
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("CIN: U74999WB2019PTC234123", 130, 70, {
        align: "center",
        underline: false,
      });
    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Email : dsmsindia.info@gmail.com", 130, 85, {
        align: "center",
        underline: false,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("PHONE : +91 8967940947, A/C-6297902962", 130, 100, {
        align: "center",
        underline: false,
      });

    doc.moveTo(20, 120).lineTo(575, 120).stroke("#000000");

    doc.moveDown(1);
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(`Payslip For the Month of ${monthNameStr}-${year}`, {
        align: "center",
        underline: true,
      });
    doc.moveDown(1);

    const detailsTop = doc.y;
    doc.fontSize(10).font("Helvetica");

    doc.text("Employee Name", 30, detailsTop, { underline: false });
    doc.text(":", 130, detailsTop, { underline: false });
    doc.text(guard.name, 140, detailsTop, { underline: false });
    doc.text("Employee Code", 30, detailsTop + 15, { underline: false });
    doc.text(":", 130, detailsTop + 15, { underline: false });
    doc.text(guard.employeeCode || "0", 140, detailsTop + 15, {
      underline: false,
    });

    doc.text("Designation", 30, detailsTop + 30, { underline: false });
    doc.text(":", 130, detailsTop + 30, { underline: false });
    doc.text(guard.department || "", 140, detailsTop + 30, {
      underline: false,
    });

    doc.text("M.O.P.", 30, detailsTop + 45, { underline: false });
    doc.text(":", 130, detailsTop + 45, { underline: false });
    doc.text("A/c Transfer", 140, detailsTop + 45, { underline: false });

    doc.text("Employee PAN", 300, detailsTop, { underline: false });
    doc.text(":", 400, detailsTop, { underline: false });
    doc.text(guard.pan || "", 410, detailsTop, { underline: false });
    doc.text("UAN", 300, detailsTop + 15, { underline: false });
    doc.text(":", 400, detailsTop + 15, { underline: false });
    doc.text(guard.pfNumber || "", 410, detailsTop + 15, { underline: false });
    doc.text("ESI Number", 300, detailsTop + 30, { underline: false });
    doc.text(":", 400, detailsTop + 30, { underline: false });
    doc.text(guard.esicNumber || "", 410, detailsTop + 30, {
      underline: false,
    });
    doc.text("D.O.J.", 300, detailsTop + 45, { underline: false });
    doc.text(":", 400, detailsTop + 45, { underline: false });
    doc.text(guard.doj || "", 410, detailsTop + 45, { underline: false });

    doc
      .moveTo(20, detailsTop + 65)
      .lineTo(575, detailsTop + 65)
      .stroke("#000000");

    let tableTop = detailsTop + 65;
    doc.font("Helvetica-Bold");
    doc.text("Earnings", 80, tableTop + 5, { underline: false });
    doc.text("Amount", 220, tableTop + 5, { underline: false });
    doc.text("Deductions", 360, tableTop + 5, { underline: false });
    doc.text("Amount", 500, tableTop + 5, { underline: false });

    doc
      .moveTo(20, tableTop + 20)
      .lineTo(575, tableTop + 20)
      .stroke("#000000");

    doc.font("Helvetica");
    let currY = tableTop + 25;

    const earnings = [
      { label: "Basic Salary", val: totalBasic },
      { label: "HRA", val: totalHra },
      { label: "TA", val: totalConv },
      { label: "Washing", val: totalWash },
      { label: "Addl wages for 12 hours duty", val: totalAddl },
      { label: "Increment Amount", val: totalIncrement },
      { label: "Extra Duty Pay", val: totalExtraPay },
      { label: "Bonus", val: totalBonus },
    ];

    const deductions = [
      { label: "Employee EPF (12%)", val: totalEpf },
      { label: "Employee ESI (0.75%)", val: totalEsic },
      { label: "Professional Tax", val: pTax },
      { label: "Advance", val: totalAdvance },
      { label: "Other Deduction", val: totalOthers },
    ];

    for (let i = 0; i < Math.max(earnings.length, deductions.length); i++) {
      if (earnings[i]) {
        doc.text(earnings[i].label, 30, currY, { underline: false });
        doc.text(earnings[i].val.toFixed(0), 220, currY, {
          width: 65,
          align: "right",
          underline: false,
        });
      }
      if (deductions[i]) {
        doc.text(deductions[i].label, 305, currY, { underline: false });
        doc.text(deductions[i].val.toFixed(0), 500, currY, {
          width: 65,
          align: "right",
          underline: false,
        });
      }
      currY += 15;
    }

    doc.moveTo(20, currY).lineTo(575, currY).stroke("#000000");

    const totalEarningsCalc = earnings.reduce((a, b) => a + b.val, 0);
    const totalDeductionsCalc = deductions.reduce((a, b) => a + b.val, 0);

    doc.font("Helvetica-Bold");
    doc.text("Total Earnings", 30, currY + 5, { underline: false });
    doc.text(totalEarningsCalc.toFixed(0), 220, currY + 5, {
      width: 65,
      align: "right",
      underline: false,
    });
    doc.text("Total Deductions", 305, currY + 5, { underline: false });
    doc.text(totalDeductionsCalc.toFixed(0), 500, currY + 5, {
      width: 65,
      align: "right",
      underline: false,
    });

    doc
      .moveTo(20, currY + 20)
      .lineTo(575, currY + 20)
      .stroke("#000000");

    doc.text("Net take home Salary", 30, currY + 25, { underline: false });
    doc.text(netSalary.toFixed(0), 220, currY + 25, {
      width: 65,
      align: "right",
      underline: false,
    });

    doc
      .moveTo(20, currY + 40)
      .lineTo(575, currY + 40)
      .stroke("#000000");

    doc
      .moveTo(297.5, tableTop)
      .lineTo(297.5, currY + 40)
      .stroke("#000000");
    doc
      .moveTo(200, tableTop)
      .lineTo(200, currY + 40)
      .stroke("#000000");
    doc
      .moveTo(480, tableTop)
      .lineTo(480, currY + 20)
      .stroke("#000000");

    doc.moveDown(4);
    const footerTop = doc.y;
    const currentDateTime = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "short",
      timeStyle: "short",
    });

    doc.font("Helvetica").fontSize(10);
    doc.text("Date & Time :", 30, footerTop, { underline: false });
    doc.text(currentDateTime, 120, footerTop, { underline: false });
    doc.text("Place :", 30, footerTop + 15, { underline: false });
    doc.text("Contai", 120, footerTop + 15, { underline: false });

    doc
      .font("Helvetica-Bold")
      .text(
        "This is a computer generated slip and does not require signature.",
        30,
        footerTop + 50,
        { underline: false },
      );

    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Failed to generate PDF" });
  }
}

function getColLetter(col) {
  let temp,
    letter = "";
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

async function downloadExcelSheet(req, res) {
  const projectId = req.query.projectId;
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  
  const workbook = new ExcelJS.Workbook();

  const monthNameStr = new Date(year, month).toLocaleString("en-US", {
    month: "long",
  });
  const sheet = workbook.addWorksheet(`Salary_${year}_${month}`);

  const titleRow = sheet.addRow([
    "DYNAMIC SECURITY AND MANPOWER SERVICE PVT. LTD.",
  ]);
  sheet.mergeCells(1, 1, 1, 38);
  titleRow.font = { size: 16, bold: true };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 30;

  const subtitleRow = sheet.addRow([
    `SALARY SHEET FOR THE MONTH ${monthNameStr.toUpperCase()} ${year}`,
  ]);
  sheet.mergeCells(2, 1, 2, 38);
  subtitleRow.font = { size: 14, bold: true };
  subtitleRow.alignment = { horizontal: "center", vertical: "middle" };
  subtitleRow.height = 25;

  const currentDateTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  });
  const timestampRow = sheet.addRow([`Generated on: ${currentDateTime}`]);
  sheet.mergeCells(3, 1, 3, 38);
  timestampRow.font = { size: 11, italic: true, color: { argb: "FF475569" } };
  timestampRow.alignment = { horizontal: "right", vertical: "middle" };
  timestampRow.height = 20;

  const superHeaders = [
    { title: "EMPLOYEE", span: 1, color: "FFCBD5E1" },
    { title: "ROLE & PROJECT", span: 2, color: "FFCBD5E1" },
    { title: "IDENTIFICATION", span: 2, color: "FFE2E8F0" },
    { title: "ATTENDANCE", span: 8, color: "FFE0E7FF", fontColor: "FF3730A3" },
    {
      title: "EARNINGS & ALLOWANCES",
      span: 9,
      color: "FFD1FAE5",
      fontColor: "FF065F46",
    },
    {
      title: "DEDUCTIONS & CONTRIBUTIONS",
      span: 6,
      color: "FFFFE4E6",
      fontColor: "FF9F1239",
    },
    {
      title: "ADJUSTMENTS (EDITABLE)",
      span: 5,
      color: "FFFEF3C7",
      fontColor: "FF92400E",
    },
    {
      title: "NET PAYABLES",
      span: 2,
      color: "FFF3E8FF",
      fontColor: "FF6B21A8",
    },
    { title: "BANK DETAILS", span: 3, color: "FFE2E8F0" },
  ];

  const superHeaderRow = sheet.addRow(Array(38).fill(""));
  superHeaderRow.height = 25;
  let currentStartCol = 1;
  superHeaders.forEach((sh) => {
    sheet.mergeCells(4, currentStartCol, 4, currentStartCol + sh.span - 1);
    const cell = superHeaderRow.getCell(currentStartCol);
    cell.value = sh.title;
    cell.font = {
      bold: true,
      color: { argb: sh.fontColor || "FF0F172A" },
      size: 10,
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };

    for (let i = 0; i < sh.span; i++) {
      const c = superHeaderRow.getCell(currentStartCol + i);
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: sh.color },
      };
      c.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
    currentStartCol += sh.span;
  });

  const headers = [
    "NAME",
    "DEPARTMENT",
    "PROJECT\nNAME",
    "UAN\nNUMBER",
    "ESIC\nNUMBER",
    "TOTAL\nDAYS",
    "WORKING\nDAYS",
    "WEEKLY\nOFF\n(TAKEN)",
    "WEEKLY\nOFF\n(PAYABLE)",
    "PRESENT\nDAYS",
    "LEAVE\nADJUSTMENT",
    "TOTAL\nDUTY",
    "EXTRA\nDUTY",
    "MINIMUM\nWAGES",
    "PER\nDAY\nAMOUNT",
    "GROSS\nWAGES",
    "EXTRA\nDUTY\nPAY",
    "BASIC\nPAY",
    "HRA",
    "CONVEYANCE",
    "WASHING",
    "ADDL WAGES FOR\n12 HOURS DUTY",
    "EPF\nEMP\n12%",
    "ESIC\nEMP\n0.75%",
    "P\nTAX",
    "EPF\nEMPLOYER\n12%",
    "ADMIN\nCHARGES\n1%",
    "ESIC\nEMPLOYER\n3.25%",
    "WAIVE\nPF/ESI",
    "BONUS",
    "INCREMENT\nAMOUNT",
    "ADVANCE",
    "OTHERS",
    "CTC",
    "NET\nSALARY",
    "BANK\nNAME",
    "ACC\nNUMBER",
    "IFSC\nCODE",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 70;

  const headerColors = [
    "FFE2E8F0",
    "FFE2E8F0",
    "FFE2E8F0",
    "FFE2E8F0",
    "FFE2E8F0",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFFFE4E6",
    "FFFFE4E6",
    "FFFFE4E6",
    "FFFFE4E6",
    "FFFFE4E6",
    "FFFFE4E6",
    "FFFEF3C7",
    "FFFEF3C7",
    "FFFEF3C7",
    "FFFEF3C7",
    "FFFEF3C7",
    "FFF3E8FF",
    "FF6EE7B7",
    "FFE2E8F0",
    "FFE2E8F0",
    "FFE2E8F0",
  ];

  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerColors[colNum - 1] },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  const bodyColColors = [
    "FFFFFFFF",
    "FFFFFFFF",
    "FFFFFFFF",
    "FFFFFFFF",
    "FFFFFFFF",
    "FFEEF2FF",
    "FFEEF2FF",
    "FFEEF2FF",
    "FFEEF2FF",
    "FFEEF2FF",
    "FFEEF2FF",
    "FFE0E7FF",
    "FFE0E7FF",
    "FFECFDF5",
    "FFECFDF5",
    "FFD1FAE5",
    "FFD1FAE5",
    "FFECFDF5",
    "FFECFDF5",
    "FFECFDF5",
    "FFECFDF5",
    "FFECFDF5",
    "FFFFF1F2",
    "FFFFF1F2",
    "FFFFF1F2",
    "FFFFF1F2",
    "FFFFF1F2",
    "FFFFF1F2",
    "FFFFFBEB",
    "FFFFFBEB",
    "FFFFFBEB",
    "FFFFFBEB",
    "FFFFFBEB",
    "FFF3E8FF",
    "FFA7F3D0",
    "FFFFFFFF",
    "FFFFFFFF",
    "FFFFFFFF",
  ];

  try {
    const guards = await getRelevantGuards(year, month, projectId);
    const allRowsToExport = [];

    for (const guard of guards) {
      let splits = [];
      let projectsById = {};

      const guardForReport = guard.toObject();
      if (guardForReport.projectId && guardForReport.projectId._id) {
        guardForReport.projectId = guardForReport.projectId._id.toString();
      }

      if (guard.department === "OFFICE") {
        const pName = guard.projectId?.name || "Head Office";
        splits = [{ projectName: pName, stats: {} }];
      } else {
        const wideStart = new Date(year, month - 1, 20)
          .toISOString()
          .split("T")[0];
        const wideEnd = new Date(year, month + 1, 5)
          .toISOString()
          .split("T")[0];
        let allRawAttendance = await Attendance.find({
          guardId: guard._id,
          date: { $gte: wideStart, $lte: wideEnd },
        });

        const attendanceDocs = allRawAttendance.map((doc) => {
          const d = doc.toObject();
          let pid = d.projectId || guardForReport.projectId;
          if (pid) d.projectId = pid._id ? pid._id.toString() : pid.toString();
          return d;
        });

        let historyIds = [];
        if (guard.projectHistory && guard.projectHistory.length) {
          historyIds = guard.projectHistory
            .map((h) => h.projectId?.toString())
            .filter(Boolean);
        } else if (guardForReport.projectId) {
          historyIds = [guardForReport.projectId.toString()];
        }
        attendanceDocs.forEach((a) => {
          if (a.projectId) historyIds.push(a.projectId.toString());
        });

        const uniqueIds = [...new Set(historyIds)].filter(id => id && validObjectIdRegex.test(id.toString()));
        const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
        projectsDocs.forEach((p) => {
          projectsById[p._id.toString()] = p;
        });

        const fullReport = buildMonthReport(
          guardForReport,
          projectsById,
          year,
          month,
          attendanceDocs,
        );
        splits = splitReportByProject(
          fullReport,
          parseInt(year),
          parseInt(month),
        );

        for (const split of splits) {
          let isNarayana =
            split.projectName &&
            split.projectName.toLowerCase().startsWith("narayana school");
          if (isNarayana) {
            const prevMonthDate = new Date(year, month - 1, 26);
            const currMonthDate = new Date(year, month, 25);

            const pYear = prevMonthDate.getFullYear();
            const pMonth = String(prevMonthDate.getMonth() + 1).padStart(
              2,
              "0",
            );
            const cYear = currMonthDate.getFullYear();
            const cMonth = String(currMonthDate.getMonth() + 1).padStart(
              2,
              "0",
            );

            let qStart = `${pYear}-${pMonth}-26`;
            let qEnd = `${cYear}-${cMonth}-25`;

            const utc1 = Date.UTC(pYear, prevMonthDate.getMonth(), 26);
            const utc2 = Date.UTC(cYear, currMonthDate.getMonth(), 25);
            split.customDaysInMonth =
              Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;

            let projIdStr = Object.values(projectsById)
              .find((p) => p.name === split.projectName)
              ?._id?.toString();
            let nDocs = allRawAttendance.filter((a) => {
              let pid = a.projectId?._id
                ? a.projectId._id.toString()
                : a.projectId?.toString();
              return pid === projIdStr && a.date >= qStart && a.date <= qEnd;
            });

            let nStats = {
              P: 0,
              A: 0,
              DD: 0,
              HD: 0,
              OFF: 0,
              H: 0,
              calendarOffs: 0,
            };
            nDocs.forEach((d) => {
              if (d.status === "OFF") nStats.calendarOffs++;
              else if (d.status) nStats[d.status] = (nStats[d.status] || 0) + 1;
            });
            let wDays = nStats.P + nStats.DD + nStats.HD + nStats.H;
            let earnedWeekOff = Math.min(Math.floor(wDays / 6), 4);
            nStats.weekOffs = Math.max(0, earnedWeekOff - nStats.calendarOffs);
            split.stats = nStats;
          }
        }
      }

      for (const split of splits) {
        if (
          projectId &&
          projectId !== "all" &&
          projectId !== "office" &&
          validObjectIdRegex.test(projectId.toString())
        ) {
          const contextProj = await Project.findById(projectId);
          if (contextProj && split.projectName !== contextProj.name) continue;
        }

        const projectRefId =
          guard.department === "OFFICE"
            ? guard.projectId?._id || guard.projectId || null
            : Object.values(projectsById).find(
                (p) => p.name === split.projectName,
              )?._id || null;

        const record = await SalaryRecord.findOne({
          guardId: guard._id,
          year,
          month,
          projectId: projectRefId && validObjectIdRegex.test(projectRefId.toString()) ? projectRefId : null,
        });

        let carriedEdAmount = 0;
        let carriedSkipPfEsic = false;
        let carriedOverrides = {};

        if (!record) {
          const pastRecord = await SalaryRecord.findOne({
            guardId: guard._id,
          }).sort({ year: -1, month: -1 });
          if (pastRecord) {
            carriedEdAmount = pastRecord.edAmount || 0;
            carriedSkipPfEsic = pastRecord.skipPfEsic || false;
            carriedOverrides = pastRecord.overrides || {};
          }
        } else {
          carriedOverrides = record.overrides || {};
        }

        let splitSalary = Number(guard.salary) || 0;
        const projectRefIdStr = projectRefId ? projectRefId.toString() : null;

        if (guard.department !== "OFFICE" && projectRefIdStr) {
          const currentProjectId = guard.projectId?._id
            ? guard.projectId._id.toString()
            : guard.projectId?.toString();
          if (currentProjectId !== projectRefIdStr) {
            const pastStints = (guard.projectHistory || [])
              .filter((h) => {
                const hId = h.projectId?._id
                  ? h.projectId._id.toString()
                  : h.projectId?.toString();
                return hId === projectRefIdStr;
              })
              .sort(
                (a, b) =>
                  new Date(b.endDate || "9999-12-31") -
                  new Date(a.endDate || "9999-12-31"),
              );

            if (
              pastStints.length > 0 &&
              pastStints[0].salary &&
              pastStints[0].salary > 0
            ) {
              splitSalary = pastStints[0].salary;
            }
          }
        }

        // FIX: The calculation output is correctly saved as 'm' here so it can be pushed properly on the next line
        const m = calculateSalaryMath(
          guard,
          split.stats,
          year,
          month,
          record,
          carriedEdAmount,
          carriedSkipPfEsic,
          split.customDaysInMonth,
          carriedOverrides,
          splitSalary,
        );
        allRowsToExport.push({ guard, split, m });
      }
    }

    allRowsToExport.sort((a, b) => {
      const isOffA = a.guard.department === "OFFICE" ? 1 : 0;
      const isOffB = b.guard.department === "OFFICE" ? 1 : 0;
      if (isOffA !== isOffB) return isOffB - isOffA;

      const pA = a.split.projectName || "Unassigned";
      const pB = b.split.projectName || "Unassigned";
      const pCmp = pA.localeCompare(pB);
      if (pCmp !== 0) return pCmp;

      return (a.guard.name || "").localeCompare(b.guard.name || "");
    });

    for (const rowData of allRowsToExport) {
      const { guard, split, m } = rowData;

      const finalProjectName =
        split.projectName || guard.projectId?.name || "Unassigned";
      const textF = (val) =>
        val && val !== "-"
          ? {
              formula: `"${String(val).replace(/"/g, '""')}"`,
              result: String(val),
            }
          : "-";

      const row = sheet.addRow([
        guard.name,
        guard.department,
        finalProjectName,
        textF(guard.pfNumber),
        textF(guard.esicNumber),
        m.daysInMonth,
        m.workDays,
        split.stats?.calendarOffs || 0,
        split.stats?.weekOffs || 0,
        m.presentDays,
        m.leaveAdjustments,
        m.totalDuty,
        m.extraDuty,
        m.minWages,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        m.pTax,
        0,
        0,
        0,
        m.skipPfEsic ? "YES" : "NO",
        m.bonus,
        m.edAmount,
        m.advance,
        m.othersDeduction,
        0,
        0,
        guard.bankName,
        textF(guard.accountNumber),
        textF(guard.ifscCode),
      ]);

      const R = row.number;
      const O = m.overrides || {};

      const setEx = (col, key, formStr, res) => {
        if (O[key] !== undefined && O[key] !== null)
          row.getCell(col).value = Number(O[key]);
        else row.getCell(col).value = { formula: formStr, result: res };
      };

      setEx(15, "perDayAmount", `ROUND(N${R}/F${R}, 0)`, m.perDayAmount);
      row.getCell(16).value = m.grossWages;
      setEx(17, "extraDutyPay", `ROUND(O${R}*M${R}, 0)`, m.extraDutyPay);
      setEx(18, "basicPay", `ROUND(P${R}*0.5, 0)`, m.basicPay);
      setEx(19, "hra", `ROUND(P${R}*0.2, 0)`, m.hra);
      setEx(20, "conveyance", `ROUND(P${R}*0.1, 0)`, m.conveyance);
      setEx(21, "washing", `ROUND(P${R}*0.1, 0)`, m.washing);
      setEx(
        22,
        "additional",
        `ROUND(P${R}-(R${R}+S${R}+T${R}+U${R}), 0)`,
        m.additional,
      );

      setEx(
        23,
        "epfEmp",
        m.skipPfEsic ? "0" : `ROUND(R${R}*0.12, 0)`,
        m.epfEmp,
      );
      setEx(
        24,
        "esicEmp",
        m.skipPfEsic ? "0" : `ROUND(P${R}*0.0075, 0)`,
        m.esicEmp,
      );

      setEx(
        26,
        "epfEmployer",
        m.skipPfEsic ? "0" : `ROUND(R${R}*0.12, 0)`,
        m.epfEmployer,
      );
      setEx(
        27,
        "adminCharges",
        m.skipPfEsic ? "0" : `ROUND(R${R}*0.01, 0)`,
        m.adminCharges,
      );
      setEx(
        28,
        "esicEmployer",
        m.skipPfEsic ? "0" : `ROUND(P${R}*0.0325, 0)`,
        m.esicEmployer,
      );

      setEx(12, "totalDuty", `J${R}+K${R}`, m.totalDuty);

      row.getCell(34).value = {
        formula: `ROUND(P${R}+Q${R}+Z${R}+AA${R}+AB${R}, 0)`,
        result: m.ctc,
      };
      row.getCell(35).value = {
        formula: `ROUND(P${R}+Q${R}+AD${R}+AE${R}-(W${R}+X${R}+Y${R}+AF${R}+AG${R}), 0)`,
        result: m.netSalary,
      };

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bodyColColors[colNumber - 1] },
        };

        if (colNumber >= 6 && colNumber <= 13) {
          cell.numFmt = "0.00";
        } else if (colNumber >= 14 && colNumber <= 35 && colNumber !== 29) {
          cell.numFmt = "#,##0";
        }

        if (colNumber === 12 || colNumber === 13) {
          cell.font = { bold: true, color: { argb: "FF312E81" } };
        } else if (colNumber === 16 || colNumber === 17 || colNumber === 35) {
          cell.font = { bold: true, color: { argb: "FF064E3B" } };
        } else if (colNumber === 34) {
          cell.font = { bold: true, color: { argb: "FF581C87" } };
        } else if (colNumber === 32 || colNumber === 33) {
          cell.font = { color: { argb: "FFDC2626" } };
        } else if (colNumber >= 23 && colNumber <= 25) {
          cell.font = { color: { argb: "FF9F1239" } };
        } else if (colNumber === 26 || colNumber === 27 || colNumber === 28) {
          cell.font = { color: { argb: "FF64748B" } };
        }
      });
    }

    sheet.getColumn(1).width = 22;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 12;
    for (let i = 6; i <= 35; i++) {
      sheet.getColumn(i).width = 9;
    }
    sheet.getColumn(36).width = 15;
    sheet.getColumn(37).width = 15;
    sheet.getColumn(38).width = 15;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${req.query.fileName || `SalarySheet_${monthNameStr}_${year}.xlsx`}`,
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send("Error generating Excel");
  }
}

module.exports = {
  getSalarySheet,
  updateEditableFields,
  downloadSlip,
  downloadExcelSheet,
};