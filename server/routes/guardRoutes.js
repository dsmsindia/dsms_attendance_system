const express = require("express");
const router = express.Router();

// Import authentication and authorization middlewares
const verifyToken = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

// Import the correct matching function names from guardController.js
const {
  listGuards,
  createGuard,
  updateGuardDetails,
  deactivate,
  reactivate,
} = require("../controllers/guardController");

// Define guard endpoints using the correct imported functions
router.get("/", verifyToken, listGuards);
router.post("/", verifyToken, adminOnly, createGuard);
router.put("/:id", verifyToken, adminOnly, updateGuardDetails);
router.patch("/:id/deactivate", verifyToken, adminOnly, deactivate);
router.patch("/:id/reactivate", verifyToken, adminOnly, reactivate);

module.exports = router;
