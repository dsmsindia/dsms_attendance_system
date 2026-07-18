const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Guard = require("../models/Guard");
const Project = require("../models/Project");
const Attendance = require("../models/Attendance");
const SalaryRecord = require("../models/SalaryRecord");
const { buildMonthReport, splitReportByProject } = require("../utils/attendance");
const { monthBounds } = require("../utils/projectMembership");

async function getRelevantGuards(year, month, projectIdFilter) {
  const { start, end } = monthBounds(year, month);
  
  // FIX: Fetch both active and inactive guards so inactive guards with attendance can be evaluated
  const activeGuards = await Guard.find({ active: true }).populate("projectId", "name");
  const inactiveGuards = await Guard.find({ active: false }).populate("projectId", "name");
  const allGuards = [...activeGuards, ...inactiveGuards];
  const scopedGuards = [];

  for (const g of allGuards) {
    let include = false;
    const hasAttendance = await Attendance.exists({ guardId: g._id, date: { $gte: start, $lte: end } });

    if (projectIdFilter === "office") {
      if (g.department === "OFFICE" && (g.active || hasAttendance)) include = true;
    } else if (g.department === "OFFICE") {
      if (projectIdFilter === "all" && (g.active || hasAttendance)) include = true;
      else if (projectIdFilter !== "relievers" && g.projectId && g.projectId._id.toString() === projectIdFilter && (g.active || hasAttendance)) include = true;
    } else {
      const history = g.projectHistory && g.projectHistory.length
          ? g.projectHistory
          : [{ projectId: g.projectId, startDate: "2000-01-01", endDate: null }];

      if (g.active) {
        if (!projectIdFilter || projectIdFilter === "all") {
          include = true;
        } else if (projectIdFilter === "relievers") {
          if (g.isReliever) include = true;
        } else {
          const assignedToThis = history.some(h => h.projectId?.toString() === projectIdFilter && h.startDate <= end && (h.endDate || "9999-12-31") >= start);
          const workedAtThis = await Attendance.exists({ guardId: g._id, projectId: projectIdFilter, date: { $gte: start, $lte: end } });
          if (assignedToThis || workedAtThis) include = true;
        }
      } else {
        // FIX: Inactive guards are ONLY included if they have physical attendance in this month/project
        if (!projectIdFilter || projectIdFilter === "all") {
          if (hasAttendance) include = true;
        } else if (projectIdFilter === "relievers") {
          if (g.isReliever && hasAttendance) include = true;
        } else {
          const workedAtThis = await Attendance.exists({ guardId: g._id, projectId: projectIdFilter, date: { $gte: start, $lte: end } });
          if (workedAtThis) include = true;
        }
      }
    }
    if (include) scopedGuards.push(g);
  }
  return scopedGuards;
}

function calculateSalaryMath(guard, splitStats, year, month, editableData, carriedEdAmount, carriedSkipPfEsic = false, customDaysInMonth = null, carriedOverrides = {}) {
  const O = editableData?.overrides || carriedOverrides || {};
  const safeO = (key, fallback) => (O[key] !== undefined && O[key] !== null) ? Number(O[key]) : fallback;

  const standardDays = new Date(year, month + 1, 0).getDate();
  const daysInMonth = safeO('daysInMonth', customDaysInMonth || standardDays);

  const baseWorkDays = (Number(splitStats?.P) || 0) + ((Number(splitStats?.DD) || 0) * 2) + ((Number(splitStats?.HD) || 0) * 0.5) + (Number(splitStats?.H) || 0);
  const workDays = safeO('workDays', guard.department === "OFFICE" ? daysInMonth : baseWorkDays);
  
  splitStats.weekOffs = safeO('weekOffs', guard.department === "OFFICE" ? 0 : (Number(splitStats?.weekOffs) || 0));
  
  const totalPayableDays = workDays + splitStats.weekOffs;

  const totalDuty = safeO('totalDuty', Math.min(totalPayableDays, daysInMonth));
  const extraDuty = safeO('extraDuty', Math.max(0, totalPayableDays - daysInMonth));

  const minWages = safeO('minWages', Number(guard.salary) || 0);
  
  // FIX: Calculate precise daily rate without rounding it early
  const preciseDailyRate = minWages / daysInMonth;

  // FIX: If full month attendance, force exact minWages to prevent penny errors
  const baseGross = (totalDuty === daysInMonth) ? minWages : Math.round(preciseDailyRate * totalDuty);
  const grossWages = safeO('grossWages', baseGross);
  
  const actualPerDayAmount = safeO('perDayAmount', Math.round(preciseDailyRate));
  const extraDutyPay = safeO('extraDutyPay', Math.round(actualPerDayAmount * extraDuty));

  const basicPay = safeO('basicPay', Math.round(grossWages * 0.50));
  const hra = safeO('hra', Math.round(grossWages * 0.20));
  const conveyance = safeO('conveyance', Math.round(grossWages * 0.10));
  const washing = safeO('washing', Math.round(grossWages * 0.10));
  const additional = safeO('additional', Math.round(grossWages - (basicPay + hra + conveyance + washing)));

  const skipPfEsic = editableData?.skipPfEsic ?? carriedSkipPfEsic;

  const epfEmp = skipPfEsic ? 0 : safeO('epfEmp', Math.round(basicPay * 0.12));
  const esicEmp = skipPfEsic ? 0 : safeO('esicEmp', Math.round(grossWages * 0.0075));
  
  let calcPTax = 0;
  if (grossWages > 40000) calcPTax = 200;
  else if (grossWages > 25000) calcPTax = 150;
  else if (grossWages > 15000) calcPTax = 130;
  else if (grossWages > 10000) calcPTax = 110;
  const pTax = safeO('pTax', calcPTax);

  const epfEmployer = skipPfEsic ? 0 : safeO('epfEmployer', Math.round(basicPay * 0.13));
  const esicEmployer = skipPfEsic ? 0 : safeO('esicEmployer', Math.round(grossWages * 0.0325));

  const bonus = Math.round(Number(editableData?.bonus) || 0);
  const incrementAmount = Math.round(Number(editableData?.edAmount ?? carriedEdAmount) || 0);
  const advance = Math.round(Number(editableData?.advance) || 0);
  const othersDeduction = Math.round(Number(editableData?.othersDeduction) || 0);

  const ctc = Math.round(grossWages + extraDutyPay + epfEmployer + esicEmployer);
  const netSalary = Math.round(grossWages + extraDutyPay + bonus + incrementAmount - (epfEmp + esicEmp + pTax + advance + othersDeduction));

  return {
    daysInMonth, perDayAmount: actualPerDayAmount, totalDuty, extraDuty, extraDutyPay, grossWages, basicPay, hra, conveyance, washing, additional,
    epfEmp, esicEmp, pTax, epfEmployer, esicEmployer, bonus, edAmount: incrementAmount, advance, othersDeduction,
    ctc, netSalary, workDays, totalPayableDays, skipPfEsic, overrides: O, minWages
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
        const wideStart = new Date(year, month - 1, 20).toISOString().split('T')[0];
        const wideEnd = new Date(year, month + 1, 5).toISOString().split('T')[0];
        let allRawAttendance = await Attendance.find({ guardId: guard._id, date: { $gte: wideStart, $lte: wideEnd } });
        
        const attendanceDocs = allRawAttendance.map(doc => {
          const d = doc.toObject();
          let pid = d.projectId || guardForReport.projectId;
          if (pid) d.projectId = pid._id ? pid._id.toString() : pid.toString();
          return d;
        });

        let historyIds = [];
        if (guard.projectHistory && guard.projectHistory.length) {
          historyIds = guard.projectHistory.map((h) => h.projectId?.toString()).filter(Boolean);
        } else if (guardForReport.projectId) {
          historyIds = [guardForReport.projectId.toString()];
        }
        attendanceDocs.forEach((a) => {
          if (a.projectId) historyIds.push(a.projectId.toString());
        });

        const uniqueIds = [...new Set(historyIds)];
        const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
        projectsDocs.forEach((p) => { projectsById[p._id.toString()] = p; });

        const fullReport = buildMonthReport(guardForReport, projectsById, year, month, attendanceDocs);
        splits = splitReportByProject(fullReport, year, month);

        for (const split of splits) {
            let isNarayana = split.projectName && split.projectName.toLowerCase().startsWith("narayana school");
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
                split.customDaysInMonth = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;

                let projIdStr = Object.values(projectsById).find(p => p.name === split.projectName)?._id?.toString();
                let nDocs = allRawAttendance.filter(a => {
                    let pid = a.projectId?._id ? a.projectId._id.toString() : a.projectId?.toString();
                    return pid === projIdStr && a.date >= qStart && a.date <= qEnd;
                });
                
                let nStats = { P: 0, A: 0, DD: 0, HD: 0, OFF: 0, H: 0, calendarOffs: 0 };
                nDocs.forEach(d => {
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
        if (projectId && projectId !== "all" && projectId !== "relievers" && projectId !== "office") {
          const contextProj = await Project.findById(projectId);
          if (contextProj && split.projectName !== contextProj.name) continue;
        }

        const projectRefId = guard.department === "OFFICE" 
            ? (guard.projectId?._id || guard.projectId || null) 
            : (Object.values(projectsById).find(p => p.name === split.projectName)?._id || null);

        const record = await SalaryRecord.findOne({ guardId: guard._id, year, month, projectId: projectRefId });
        
        let carriedEdAmount = 0;
        let carriedSkipPfEsic = false;
        let carriedOverrides = {};

        if (!record) {
          const pastRecord = await SalaryRecord.findOne({ guardId: guard._id }).sort({ year: -1, month: -1 });
          if (pastRecord) {
            carriedEdAmount = pastRecord.edAmount || 0;
            carriedSkipPfEsic = pastRecord.skipPfEsic || false;
            carriedOverrides = pastRecord.overrides || {};
          }
        } else {
            carriedOverrides = record.overrides || {};
        }

        const math = calculateSalaryMath(guard, split.stats, year, month, record, carriedEdAmount, carriedSkipPfEsic, split.customDaysInMonth, carriedOverrides);
        
        result.push({
          guard,
          projectId: projectRefId,
          projectName: split.projectName || (guard.isReliever ? "Reliever" : (guard.projectId?.name || "Unassigned")),
          attendanceStats: split.stats,
          math,
          isPaid: record?.isPaid || false,
          customDaysInMonth: split.customDaysInMonth || null 
        });
      }
    }

    result.sort((a, b) => {
      const isOffA = a.guard.department === "OFFICE" ? 1 : 0;
      const isOffB = b.guard.department === "OFFICE" ? 1 : 0;
      if (isOffA !== isOffB) return isOffB - isOffA; 

      const isRelA = a.guard.isReliever ? 1 : 0;
      const isRelB = b.guard.isReliever ? 1 : 0;
      if (isRelA !== isRelB) return isRelA - isRelB; 

      const pA = a.projectName || "Unassigned";
      const pB = b.projectName || "Unassigned";
      const pCmp = pA.localeCompare(pB);
      if (pCmp !== 0) return pCmp; 

      return (a.guard.name || "").localeCompare(b.guard.name || ""); 
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate salary sheet", error: error.message });
  }
}

async function updateEditableFields(req, res) {
  const { guardId, year, month, projectId, bonus, edAmount, advance, othersDeduction, skipPfEsic, isPaid, overrides } = req.body;
  try {
    const record = await SalaryRecord.findOneAndUpdate(
      { guardId, year, month, projectId },
      { $set: { bonus, edAmount, advance, othersDeduction, skipPfEsic, isPaid, overrides: overrides || {} } }, 
      { new: true, upsert: true }
    );
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: "Failed to save record" });
  }
}

async function downloadSlip(req, res) {
  const { guardId, year, month, projectId } = req.query;
  try {
    const guard = await Guard.findById(guardId).populate("projectId", "name");
    
    let targetSplit;
    let projectsById = {};

    const guardForReport = guard.toObject();
    if (guardForReport.projectId && guardForReport.projectId._id) {
        guardForReport.projectId = guardForReport.projectId._id.toString();
    }

    if (guard.department === "OFFICE") {
      targetSplit = { projectName: guard.projectId?.name || "Head Office", stats: {} };
    } else {
      const wideStart = new Date(year, month - 1, 20).toISOString().split('T')[0];
      const wideEnd = new Date(year, month + 1, 5).toISOString().split('T')[0];
      let rawAttendanceDocs = await Attendance.find({ guardId, date: { $gte: wideStart, $lte: wideEnd } });
      
      const attendanceDocs = rawAttendanceDocs.map(doc => {
        const d = doc.toObject();
        let pid = d.projectId || guardForReport.projectId;
        if (pid) d.projectId = pid._id ? pid._id.toString() : pid.toString();
        return d;
      });

      let historyIds = [];
      if (guard.projectHistory && guard.projectHistory.length) {
        historyIds = guard.projectHistory.map((h) => h.projectId?.toString()).filter(Boolean);
      } else if (guardForReport.projectId) {
        historyIds = [guardForReport.projectId.toString()];
      }
      attendanceDocs.forEach((a) => {
        if (a.projectId) historyIds.push(a.projectId.toString());
      });

      const uniqueIds = [...new Set(historyIds)];
      const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
      projectsDocs.forEach((p) => { projectsById[p._id.toString()] = p; });

      const fullReport = buildMonthReport(guardForReport, projectsById, parseInt(year), parseInt(month), attendanceDocs);
      const splits = splitReportByProject(fullReport, parseInt(year), parseInt(month));
      
      for (const split of splits) {
          let isNarayana = split.projectName && split.projectName.toLowerCase().startsWith("narayana school");
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
              split.customDaysInMonth = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;

              let projIdStr = Object.values(projectsById).find(p => p.name === split.projectName)?._id?.toString();
              let nDocs = rawAttendanceDocs.filter(a => {
                  let pid = a.projectId?._id ? a.projectId._id.toString() : a.projectId?.toString();
                  return pid === projIdStr && a.date >= qStart && a.date <= qEnd;
              });
              let nStats = { P: 0, A: 0, DD: 0, HD: 0, OFF: 0, H: 0, calendarOffs: 0 };
              nDocs.forEach(d => {
                  if (d.status === "OFF") nStats.calendarOffs++;
                  else if (d.status) nStats[d.status] = (nStats[d.status] || 0) + 1;
              });
              let wDays = nStats.P + nStats.DD + nStats.HD + nStats.H;
              let earnedWeekOff = Math.min(Math.floor(wDays / 6), 4);
              nStats.weekOffs = Math.max(0, earnedWeekOff - nStats.calendarOffs);
              split.stats = nStats;
          }
      }

      targetSplit = splits[0];
      if (projectId && projectId !== "null") {
          const pTarget = await Project.findById(projectId);
          targetSplit = splits.find(s => s.projectName === pTarget.name) || splits[0];
      }
    }

    const record = await SalaryRecord.findOne({ guardId, year, month, projectId: projectId === "null" ? null : projectId });
    
    let carriedEdAmount = 0;
    let carriedSkipPfEsic = false;
    let carriedOverrides = {};

    if (!record) {
      const pastRecord = await SalaryRecord.findOne({ guardId }).sort({ year: -1, month: -1 });
      if (pastRecord) {
        carriedEdAmount = pastRecord.edAmount || 0;
        carriedSkipPfEsic = pastRecord.skipPfEsic || false;
        carriedOverrides = pastRecord.overrides || {};
      }
    } else {
        carriedOverrides = record.overrides || {};
    }

    const math = calculateSalaryMath(guard, targetSplit.stats, parseInt(year), parseInt(month), record, carriedEdAmount, carriedSkipPfEsic, targetSplit.customDaysInMonth, carriedOverrides);

    const doc = new PDFDocument({ margin: 20, size: 'A4' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      const monthNameStr = new Date(year, month).toLocaleString('en-US', { month: 'long' });
      const formatName = (str) => {
        if (!str) return "";
        return str.toLowerCase().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("_");
      };
      const formattedName = guard.name ? `_${formatName(guard.name)}` : "";
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=Salary_Slip_${formattedName}.pdf`);
      res.send(pdfBuffer);
    });
    doc.on('error', (err) => {
        res.status(500).json({ message: "PDF Generation Failed" });
    });

    const monthNameStr = new Date(year, month).toLocaleString('en-US', { month: 'long' });

    doc.rect(20, 20, 555, 800).stroke('#000000');

    const logoPath = path.join(__dirname, "../assets/logo.jpg");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 35, 30, { width: 85 });
    }

    doc.font('Helvetica-Bold').fontSize(16).text("DYNAMIC SECURITY AND MANPOWER SERVICE PVT.LTD", 130, 35, { align: 'center', underline: true });
    doc.font('Helvetica-Bold').fontSize(10).text("VILL:RANIBASAN, PO:MAJNA, PS:CONTAI, E.MEDINIPUR, 721433, WB", 130, 55, { align: 'center', underline: false });
    doc.font('Helvetica-Bold').fontSize(10).text("CIN: U74999WB2019PTC234123", 130, 70, { align: 'center', underline: false });
    doc.font('Helvetica').fontSize(10).text("Email : dsmsindia.info@gmail.com", 130, 85, { align: 'center', underline: false });
    doc.font('Helvetica-Bold').fontSize(10).text("PHONE : +91 8967940947, A/C-6297902962", 130, 100, { align: 'center', underline: false });

    doc.moveTo(20, 120).lineTo(575, 120).stroke('#000000');

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(14).text(`Payslip For the Month of ${monthNameStr}-${year}`, { align: 'center', underline: true });
    doc.moveDown(1);

    const detailsTop = doc.y;
    doc.fontSize(10).font('Helvetica');
    
    doc.text("Employee Name", 30, detailsTop, { underline: false }); doc.text(":", 130, detailsTop, { underline: false }); doc.text(guard.name, 140, detailsTop, { underline: false });
    doc.text("Employee Code", 30, detailsTop+15, { underline: false }); doc.text(":", 130, detailsTop+15, { underline: false }); doc.text(guard.employeeCode || "0", 140, detailsTop+15, { underline: false });
    doc.text("Designation", 30, detailsTop+30, { underline: false }); doc.text(":", 130, detailsTop+30, { underline: false }); doc.text(guard.department, 140, detailsTop+30, { underline: false });
    doc.text("M.O.P.", 30, detailsTop+45, { underline: false }); doc.text(":", 130, detailsTop+45, { underline: false }); doc.text("A/c Transfer", 140, detailsTop+45, { underline: false });

    doc.text("Employee PAN", 300, detailsTop, { underline: false }); doc.text(":", 400, detailsTop, { underline: false }); doc.text(guard.pan || "", 410, detailsTop, { underline: false });
    doc.text("UAN", 300, detailsTop+15, { underline: false }); doc.text(":", 400, detailsTop+15, { underline: false }); doc.text(guard.pfNumber || "", 410, detailsTop+15, { underline: false });
    doc.text("ESI Number", 300, detailsTop+30, { underline: false }); doc.text(":", 400, detailsTop+30, { underline: false }); doc.text(guard.esicNumber || "", 410, detailsTop+30, { underline: false });
    doc.text("D.O.J.", 300, detailsTop+45, { underline: false }); doc.text(":", 400, detailsTop+45, { underline: false }); doc.text(guard.doj || "", 410, detailsTop+45, { underline: false });

    doc.moveTo(20, detailsTop + 65).lineTo(575, detailsTop + 65).stroke('#000000');

    let tableTop = detailsTop + 65;
    doc.font('Helvetica-Bold');
    doc.text("Earnings", 80, tableTop + 5, { underline: false });
    doc.text("Amount", 220, tableTop + 5, { underline: false });
    doc.text("Deductions", 360, tableTop + 5, { underline: false });
    doc.text("Amount", 500, tableTop + 5, { underline: false });

    doc.moveTo(20, tableTop + 20).lineTo(575, tableTop + 20).stroke('#000000');

    doc.font('Helvetica');
    let currY = tableTop + 25;
    
    const earnings = [
      { label: "Basic Salary", val: math.basicPay },
      { label: "HRA", val: math.hra },
      { label: "TA", val: math.conveyance },
      { label: "Washing", val: math.washing },
      { label: "Ad wages for 12 hrs.", val: math.additional },
      { label: "Increment Amount", val: math.edAmount },
      { label: "Extra Duty Pay", val: math.extraDutyPay },
      { label: "Bonus", val: math.bonus }
    ];
    
    const deductions = [
      { label: "Employee EPF", val: math.epfEmp },
      { label: "Employee ESI", val: math.esicEmp },
      { label: "Professional Tax", val: math.pTax },
      { label: "Advance", val: math.advance },
      { label: "Other Deduction", val: math.othersDeduction }
    ];

    for (let i = 0; i < Math.max(earnings.length, deductions.length); i++) {
      if (earnings[i]) {
        doc.text(earnings[i].label, 30, currY, { underline: false });
        doc.text(earnings[i].val.toFixed(0), 220, currY, { width: 65, align: 'right', underline: false });
      }
      if (deductions[i]) {
        doc.text(deductions[i].label, 305, currY, { underline: false });
        doc.text(deductions[i].val.toFixed(0), 500, currY, { width: 65, align: 'right', underline: false });
      }
      currY += 15;
    }

    doc.moveTo(20, currY).lineTo(575, currY).stroke('#000000');

    const totalEarnings = earnings.reduce((a, b) => a + b.val, 0);
    const totalDeductions = deductions.reduce((a, b) => a + b.val, 0);

    doc.font('Helvetica-Bold');
    doc.text("Total Earnings", 30, currY + 5, { underline: false });
    doc.text(totalEarnings.toFixed(0), 220, currY + 5, { width: 65, align: 'right', underline: false });
    doc.text("Total Deductions", 305, currY + 5, { underline: false });
    doc.text(totalDeductions.toFixed(0), 500, currY + 5, { width: 65, align: 'right', underline: false });
    
    doc.moveTo(20, currY + 20).lineTo(575, currY + 20).stroke('#000000');
    
    doc.text("Net take home Salary", 30, currY + 25, { underline: false });
    doc.text(math.netSalary.toFixed(0), 220, currY + 25, { width: 65, align: 'right', underline: false });
    
    doc.moveTo(20, currY + 40).lineTo(575, currY + 40).stroke('#000000');

    doc.moveTo(297.5, tableTop).lineTo(297.5, currY + 40).stroke('#000000'); 
    doc.moveTo(200, tableTop).lineTo(200, currY + 40).stroke('#000000'); 
    doc.moveTo(480, tableTop).lineTo(480, currY + 20).stroke('#000000'); 

    doc.moveDown(4);
    const footerTop = doc.y;
    const currentDateTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" });
    
    doc.font('Helvetica').fontSize(10);
    doc.text("Date & Time :", 30, footerTop, { underline: false });
    doc.text(currentDateTime, 120, footerTop, { underline: false });
    doc.text("Place :", 30, footerTop + 15, { underline: false });
    doc.text("Contai", 120, footerTop + 15, { underline: false });

    doc.font('Helvetica-Bold').text("This is a computer generated slip and does not require signature.", 30, footerTop + 50, { underline: false });

    doc.end();

  } catch (error) {
    res.status(500).json({ message: "Failed to generate PDF" });
  }
}

function getColLetter(col) {
  let temp, letter = '';
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

async function downloadExcelSheet(req, res) {
  const { year, month, projectId } = req.query;
  const workbook = new ExcelJS.Workbook();
  
  const monthNameStr = new Date(year, month).toLocaleString('en-US', { month: 'long' });
  const sheet = workbook.addWorksheet(`Salary_${year}_${month}`);

  const titleRow = sheet.addRow(["DYNAMIC SECURITY AND MANPOWER SERVICE PVT. LTD."]);
  sheet.mergeCells(1, 1, 1, 35); 
  titleRow.font = { size: 16, bold: true };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 30;

  const subtitleRow = sheet.addRow([`SALARY SHEET FOR THE MONTH ${monthNameStr.toUpperCase()} ${year}`]);
  sheet.mergeCells(2, 1, 2, 35);
  subtitleRow.font = { size: 14, bold: true };
  subtitleRow.alignment = { horizontal: "center", vertical: "middle" };
  subtitleRow.height = 25;

  const currentDateTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" });
  const timestampRow = sheet.addRow([`Generated on: ${currentDateTime}`]);
  sheet.mergeCells(3, 1, 3, 35);
  timestampRow.font = { size: 11, italic: true, color: { argb: "FF475569" } };
  timestampRow.alignment = { horizontal: "right", vertical: "middle" };
  timestampRow.height = 20;

  const headers = [
    "NAME", "DEPARTMENT", "PROJECT\nNAME", "UAN\nNUMBER", "ESIC\nNUMBER", 
    "TOTAL\nDAYS", "WORKING\nDAYS", "WEEKLY\nOFF\n(TAKEN)", "WEEKLY\nOFF\n(PAYABLE)", "TOTAL\nDUTY", "EXTRA\nDUTY",
    "MINIMUM\nWAGES", "PER\nDAY\nAMOUNT", "GROSS\nWAGES", "EXTRA\nDUTY\nPAY", "BASIC\nPAY", "HRA", "CONVEYANCE",
    "WASHING", "ADDITIONAL", "EPF\nEMP\n12%", "ESIC\nEMP\n0.75%", "P\nTAX", "EPF\nEMPLOYER\n13%",
    "ESIC\nEMPLOYER\n3.25%", "WAIVE\nPF/ESI", "BONUS", "INCREMENT\nAMOUNT", "ADVANCE", "OTHERS", "CTC", "NET\nSALARY",
    "BANK\nNAME", "ACC\nNUMBER", "IFSC\nCODE"
  ];
  
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  
  headerRow.height = 70; 
  headerRow.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' }};
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
  });

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
        const wideStart = new Date(year, month - 1, 20).toISOString().split('T')[0];
        const wideEnd = new Date(year, month + 1, 5).toISOString().split('T')[0];
        let allRawAttendance = await Attendance.find({ guardId: guard._id, date: { $gte: wideStart, $lte: wideEnd } });
        
        const attendanceDocs = allRawAttendance.map(doc => {
          const d = doc.toObject();
          let pid = d.projectId || guardForReport.projectId;
          if (pid) d.projectId = pid._id ? pid._id.toString() : pid.toString();
          return d;
        });

        let historyIds = [];
        if (guard.projectHistory && guard.projectHistory.length) {
          historyIds = guard.projectHistory.map((h) => h.projectId?.toString()).filter(Boolean);
        } else if (guardForReport.projectId) {
          historyIds = [guardForReport.projectId.toString()];
        }
        attendanceDocs.forEach((a) => {
          if (a.projectId) historyIds.push(a.projectId.toString());
        });

        const uniqueIds = [...new Set(historyIds)];
        const projectsDocs = await Project.find({ _id: { $in: uniqueIds } });
        projectsDocs.forEach((p) => { projectsById[p._id.toString()] = p; });

        const fullReport = buildMonthReport(guardForReport, projectsById, parseInt(year), parseInt(month), attendanceDocs);
        splits = splitReportByProject(fullReport, parseInt(year), parseInt(month));

        for (const split of splits) {
            let isNarayana = split.projectName && split.projectName.toLowerCase().startsWith("narayana school");
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
                split.customDaysInMonth = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;

                let projIdStr = Object.values(projectsById).find(p => p.name === split.projectName)?._id?.toString();
                let nDocs = allRawAttendance.filter(a => {
                    let pid = a.projectId?._id ? a.projectId._id.toString() : a.projectId?.toString();
                    return pid === projIdStr && a.date >= qStart && a.date <= qEnd;
                });
                
                let nStats = { P: 0, A: 0, DD: 0, HD: 0, OFF: 0, H: 0, calendarOffs: 0 };
                nDocs.forEach(d => {
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
         if (guard.department !== "OFFICE" && projectId && projectId !== "all" && projectId !== "relievers" && projectId !== "office") {
            const contextProj = await Project.findById(projectId);
            if (contextProj && split.projectName !== contextProj.name) continue;
         }

         const projectRefId = guard.department === "OFFICE" 
            ? (guard.projectId?._id || guard.projectId || null) 
            : (Object.values(projectsById).find(p => p.name === split.projectName)?._id || null);

         const record = await SalaryRecord.findOne({ guardId: guard._id, year, month, projectId: projectRefId });
         
         let carriedEdAmount = 0;
         let carriedSkipPfEsic = false;
         let carriedOverrides = {};

         if (!record) {
           const pastRecord = await SalaryRecord.findOne({ guardId: guard._id }).sort({ year: -1, month: -1 });
           if (pastRecord) {
             carriedEdAmount = pastRecord.edAmount || 0;
             carriedSkipPfEsic = pastRecord.skipPfEsic || false;
             carriedOverrides = pastRecord.overrides || {};
           }
         } else {
             carriedOverrides = record.overrides || {};
         }

         const m = calculateSalaryMath(guard, split.stats, parseInt(year), parseInt(month), record, carriedEdAmount, carriedSkipPfEsic, split.customDaysInMonth, carriedOverrides);
         allRowsToExport.push({ guard, split, m });
      }
    }

    allRowsToExport.sort((a, b) => {
      const isOffA = a.guard.department === "OFFICE" ? 1 : 0;
      const isOffB = b.guard.department === "OFFICE" ? 1 : 0;
      if (isOffA !== isOffB) return isOffB - isOffA;

      const isRelA = a.guard.isReliever ? 1 : 0;
      const isRelB = b.guard.isReliever ? 1 : 0;
      if (isRelA !== isRelB) return isRelA - isRelB;

      const pA = a.split.projectName || "Unassigned";
      const pB = b.split.projectName || "Unassigned";
      const pCmp = pA.localeCompare(pB);
      if (pCmp !== 0) return pCmp;

      return (a.guard.name || "").localeCompare(b.guard.name || "");
    });

    for (const rowData of allRowsToExport) {
      const { guard, split, m } = rowData;
      
      const finalProjectName = split.projectName || (guard.isReliever ? "Reliever" : (guard.projectId?.name || "Unassigned"));

      const textF = (val) => val && val !== "-" ? { formula: `"${String(val).replace(/"/g, '""')}"`, result: String(val) } : "-";

      const row = sheet.addRow([
         guard.name, guard.department, finalProjectName, textF(guard.pfNumber), textF(guard.esicNumber), m.daysInMonth,
         m.workDays, split.stats?.calendarOffs || 0, split.stats?.weekOffs || 0, m.totalDuty, m.extraDuty,
         m.minWages, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, m.pTax, 0, 0, m.skipPfEsic ? "YES" : "NO", m.bonus, m.edAmount, m.advance, m.othersDeduction,
         0, 0, guard.bankName, textF(guard.accountNumber), textF(guard.ifscCode)
       ]);

       const R = row.number;
       const O = m.overrides || {};

       const setEx = (col, key, formStr, res) => {
           if (O[key] !== undefined && O[key] !== null) row.getCell(col).value = Number(O[key]);
           else row.getCell(col).value = { formula: formStr, result: res };
       };

       setEx(13, 'perDayAmount', `ROUND(L${R}/F${R}, 0)`, m.perDayAmount);
       setEx(14, 'grossWages', `ROUND(M${R}*J${R}, 0)`, m.grossWages);
       setEx(15, 'extraDutyPay', `ROUND(M${R}*K${R}, 0)`, m.extraDutyPay);
       setEx(16, 'basicPay', `ROUND(N${R}*0.5, 0)`, m.basicPay);
       setEx(17, 'hra', `ROUND(N${R}*0.2, 0)`, m.hra);
       setEx(18, 'conveyance', `ROUND(N${R}*0.1, 0)`, m.conveyance);
       setEx(19, 'washing', `ROUND(N${R}*0.1, 0)`, m.washing);
       setEx(20, 'additional', `ROUND(N${R}-(P${R}+Q${R}+R${R}+S${R}), 0)`, m.additional);
       
       setEx(21, 'epfEmp', m.skipPfEsic ? '0' : `ROUND(P${R}*0.12, 0)`, m.epfEmp);
       setEx(22, 'esicEmp', m.skipPfEsic ? '0' : `ROUND(N${R}*0.0075, 0)`, m.esicEmp);
       
       setEx(24, 'epfEmployer', m.skipPfEsic ? '0' : `ROUND(P${R}*0.13, 0)`, m.epfEmployer);
       setEx(25, 'esicEmployer', m.skipPfEsic ? '0' : `ROUND(N${R}*0.0325, 0)`, m.esicEmployer);

       row.getCell(31).value = { formula: `ROUND(N${R}+O${R}+X${R}+Y${R}, 0)`, result: m.ctc }; 
       row.getCell(32).value = { formula: `ROUND(N${R}+O${R}+AA${R}+AB${R}-(U${R}+V${R}+W${R}+AC${R}+AD${R}), 0)`, result: m.netSalary }; 

       row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        
        if (colNumber >= 6 && colNumber <= 11) {
            cell.numFmt = '0.00';
        } else if (colNumber >= 12 && colNumber <= 32 && colNumber !== 26) {
            cell.numFmt = '#,##0'; 
        }
      });
    }

    sheet.getColumn(1).width = 22;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 12;
    for(let i = 6; i <= 32; i++) {
        sheet.getColumn(i).width = 9;
    }
    sheet.getColumn(33).width = 15;
    sheet.getColumn(34).width = 15;
    sheet.getColumn(35).width = 15;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${req.query.fileName || `SalarySheet_${monthNameStr}_${year}.xlsx`}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send("Error generating Excel");
  }
}

module.exports = { getSalarySheet, updateEditableFields, downloadSlip, downloadExcelSheet };