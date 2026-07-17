const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

const {
  getProjects,
  createProject,
  updateProject,
  toggleProjectHoliday, // Imported new controller
} = require("../controllers/projectController");

router.get("/", verifyToken, getProjects);
router.post("/", verifyToken, adminOnly, createProject);
router.put("/:id", verifyToken, adminOnly, updateProject);
router.put("/:id/holiday", verifyToken, adminOnly, toggleProjectHoliday); // New Endpoint

module.exports = router;
