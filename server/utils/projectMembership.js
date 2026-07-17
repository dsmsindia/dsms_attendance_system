function monthBounds(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  return { start, end };
}

// Was this guard assigned to `projectId` at any point overlapping the given month?
// This is what makes a transferred-out guard still show up in their OLD project's
// report for the month they left, instead of vanishing the moment they transfer.
function wasAtProjectDuringMonth(guard, projectId, year, month) {
  const { start, end } = monthBounds(year, month);
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

  return history.some((h) => {
    if (!h.projectId || !projectId) return false; // Safely handle null/undefined project IDs
    if (h.projectId.toString() !== projectId.toString()) return false;
    const stintEnd = h.endDate || "9999-12-31"; // still ongoing = counts as covering any future month
    return h.startDate <= end && stintEnd >= start;
  });
}

module.exports = { monthBounds, wasAtProjectDuringMonth };
