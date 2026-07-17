const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

const {
  getSalarySheet,
  updateEditableFields,
  downloadSlip,
  downloadExcelSheet
} = require("../controllers/salaryController");

router.get("/sheet", verifyToken, adminOnly, getSalarySheet);
router.post("/update", verifyToken, adminOnly, updateEditableFields);
router.get("/download-slip", verifyToken, downloadSlip);
router.get("/download-excel", verifyToken, adminOnly, downloadExcelSheet);

module.exports = router;