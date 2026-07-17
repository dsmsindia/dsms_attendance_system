function findProjectForDate(guard, dateStr, projectsById, attendanceDoc) {
  if (attendanceDoc && attendanceDoc.projectId) {
    return projectsById[attendanceDoc.projectId.toString()] || null;
  }
  if (guard.isReliever) return null;

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
    (h) =>
      dateStr >= h.startDate && (h.endDate === null || dateStr <= h.endDate),
  );
  const chosen = stint || history[history.length - 1];

  if (!chosen || !chosen.projectId) return null;
  return projectsById[chosen.projectId.toString()] || null;
}

function computeDayStatus(project, dateStr, explicitStatus, todayStr) {
  if (explicitStatus) return explicitStatus;
  if (!project) return null;

  if (project.holidays && Array.isArray(project.holidays)) {
    const holiday = project.holidays.find((h) => h.date === dateStr);
    if (holiday) {
      if (holiday.worksOnHoliday) return dateStr < todayStr ? "A" : null;
      return "H";
    }
  }

  const dow = new Date(dateStr + "T00:00:00").getDay();
  if (project.weeklyOff === dow) return "OFF";

  return dateStr < todayStr ? "A" : null;
}

function buildMonthReport(guard, projectsById, year, month, attendanceDocs) {
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  const docsByDate = {};
  attendanceDocs.forEach((a) => {
    if (!docsByDate[a.date]) docsByDate[a.date] = [];
    docsByDate[a.date].push(a);
  });

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const docsForDay = docsByDate[dateStr] || [];

    if (docsForDay.length > 0) {
      docsForDay.forEach((doc) => {
        const pIdStr = doc.projectId ? doc.projectId.toString() : null;
        const project = pIdStr ? projectsById[pIdStr] : null;
        days.push({
          date: dateStr,
          status: doc.status,
          projectName: project ? project.name : null,
          projectId: pIdStr,
          projectType: project ? project.type : "WEEKLY OFF",
          time: doc.time || null,
          markedByAdmin: doc.markedByAdmin || false,
        });
      });
    } else {
      const project = findProjectForDate(guard, dateStr, projectsById, null);
      const status = computeDayStatus(project, dateStr, null, todayStr);
      days.push({
        date: dateStr,
        status,
        projectName: project ? project.name : null,
        projectId: project ? project._id?.toString() : null,
        projectType: project ? project.type : "WEEKLY OFF",
        time: null,
        markedByAdmin: false,
      });
    }
  }

  const fullReport = { days, guard };
  const splits = splitReportByProject(fullReport, year, month);

  const totalStats = {
    P: 0,
    A: 0,
    DD: 0,
    HD: 0,
    OFF: 0,
    H: 0,
    pending: 0,
    calendarOffs: 0,
    weekOffs: 0,
    totalWorkingDays: 0,
  };

  splits.forEach((s) => {
    totalStats.P += s.stats.P;
    totalStats.A += s.stats.A;
    totalStats.DD += s.stats.DD;
    totalStats.HD += s.stats.HD;
    totalStats.OFF += s.stats.calendarOffs || s.stats.OFF || 0;
    totalStats.calendarOffs += s.stats.calendarOffs;
    totalStats.H += s.stats.H;
    totalStats.pending += s.stats.pending;
    totalStats.weekOffs += s.stats.weekOffs;
    totalStats.totalWorkingDays += s.stats.totalWorkingDays;
  });

  totalStats.weekOffs = Number(totalStats.weekOffs.toFixed(2));
  totalStats.totalWorkingDays = Number(totalStats.totalWorkingDays.toFixed(2));

  return { days, stats: totalStats, guard };
}

function splitReportByProject(fullReport, year, month) {
  const { days, guard } = fullReport;
  const pNames = [...new Set(days.map((d) => d.projectName).filter(Boolean))];

  const daysInMonth =
    year !== undefined && month !== undefined
      ? new Date(year, month + 1, 0).getDate()
      : days.length;

  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

  if (pNames.length === 0) {
    const splitDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      let dateStr = "";
      if (year !== undefined && month !== undefined) {
        dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      } else {
        dateStr = days[d - 1]?.date;
      }

      const matchingDay = days.find((day) => day.date === dateStr);
      if (matchingDay) {
        splitDays.push({ ...matchingDay });
      } else {
        const isPast = dateStr <= todayStr;
        splitDays.push({
          date: dateStr,
          status: !guard?.isReliever && isPast ? "A" : null,
          projectName: null,
          projectType: null,
          time: null,
          markedByAdmin: false,
        });
      }
    }

    const stats = {
      P: 0,
      A: 0,
      DD: 0,
      HD: 0,
      OFF: 0,
      H: 0,
      pending: 0,
      calendarOffs: 0,
      weekOffs: 0,
      totalWorkingDays: 0,
    };
    splitDays.forEach((d) => {
      if (d.status) {
        if (d.status === "OFF") stats.calendarOffs++;
        else if (stats[d.status] !== undefined)
          stats[d.status] = (stats[d.status] || 0) + 1;
      } else stats.pending++;
    });

    const p = Number(stats.P || 0);
    const dd = Number(stats.DD || 0);
    const hd = Number(stats.HD || 0);
    const h = Number(stats.H || 0);
    const off = Number(stats.calendarOffs || 0);

    const pureDays = p + dd * 2 + hd * 0.5 + h;
    const workingDays = p + dd + hd + h;

    let earnedWeekOff = 0;
    if (!guard?.isReliever) {
      earnedWeekOff = Math.min(Math.floor(workingDays / 6), 4);
    }

    const payableWeekOff = Math.max(0, earnedWeekOff - off);
    const totalDays = pureDays + payableWeekOff;

    stats.weekOffs = Number(payableWeekOff.toFixed(2));
    stats.totalWorkingDays = Number(totalDays.toFixed(2));

    return [
      {
        days: splitDays,
        stats,
        projectName: guard?.isReliever ? "Reliever" : null,
        projectType: guard?.isReliever ? "" : "WEEKLY OFF",
      },
    ];
  }

  const splits = [];
  for (const pName of pNames) {
    const splitDays = [];

    for (let d = 1; d <= daysInMonth; d++) {
      let dateStr = "";
      if (year !== undefined && month !== undefined) {
        dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      } else {
        dateStr = days[d - 1]?.date;
      }

      const matchingDay = days.find(
        (day) => day.date === dateStr && day.projectName === pName,
      );

      if (matchingDay) {
        splitDays.push({ ...matchingDay });
      } else {
        const isPast = dateStr <= todayStr;
        splitDays.push({
          date: dateStr,
          status: !guard?.isReliever && isPast ? "A" : null,
          projectName: pName,
          projectType: null,
          time: null,
          markedByAdmin: false,
        });
      }
    }

    const pType =
      splitDays.find((d) => d.projectName === pName)?.projectType ||
      "WEEKLY OFF";
    const stats = {
      P: 0,
      A: 0,
      DD: 0,
      HD: 0,
      OFF: 0,
      H: 0,
      pending: 0,
      calendarOffs: 0,
      weekOffs: 0,
      totalWorkingDays: 0,
    };

    splitDays.forEach((d) => {
      if (d.status) {
        if (d.status === "OFF") stats.calendarOffs++;
        else if (stats[d.status] !== undefined)
          stats[d.status] = (stats[d.status] || 0) + 1;
      } else stats.pending++;
    });

    const p = Number(stats.P || 0);
    const dd = Number(stats.DD || 0);
    const hd = Number(stats.HD || 0);
    const h = Number(stats.H || 0);
    const off = Number(stats.calendarOffs || 0);

    const isAllDay =
      String(pType).toUpperCase() === "ALL_DAY" ||
      String(pType).toUpperCase() === "ALL DAY";

    const pureDays = p + dd * 2 + hd * 0.5 + h;
    const workingDays = p + dd + hd + h;

    let earnedWeekOff = 0;
    if (!isAllDay && !guard?.isReliever) {
      earnedWeekOff = Math.min(Math.floor(workingDays / 6), 4);
    }

    const payableWeekOff = Math.max(0, earnedWeekOff - off);
    const totalDays = pureDays + payableWeekOff;

    stats.weekOffs = Number(payableWeekOff.toFixed(2));
    stats.totalWorkingDays = Number(totalDays.toFixed(2));

    splits.push({
      days: splitDays,
      stats,
      projectName: pName,
      projectType: pType,
    });
  }
  return splits;
}

function fmtDays(n) {
  return typeof n === "number" ? n.toFixed(2) : "0.00";
}

module.exports = {
  computeDayStatus,
  buildMonthReport,
  findProjectForDate,
  splitReportByProject,
  fmtDays,
};
