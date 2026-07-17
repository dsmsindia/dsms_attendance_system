const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const {
  downloadExcelReport,
  getGuardsForReport,
} = require("../controllers/reportController");

router.get("/guards", verifyToken, adminOnly, getGuardsForReport);
router.get("/excel", verifyToken, adminOnly, downloadExcelReport);

module.exports = router;
