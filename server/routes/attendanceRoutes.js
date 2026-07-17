const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const ownGuardOrAdmin = require("../middleware/ownGuardOrAdmin");
const adminOnly = require("../middleware/adminOnly"); // Required for admin route

const {
  markAttendance,
  getMonthAttendance,
  adminUpdateAttendance,
} = require("../controllers/attendanceController");

router.post("/mark", verifyToken, markAttendance);
router.get("/:guardId", verifyToken, ownGuardOrAdmin, getMonthAttendance);

// NEW: Admin Attendance Override Route
router.put("/admin/update", verifyToken, adminOnly, adminUpdateAttendance);

module.exports = router;
