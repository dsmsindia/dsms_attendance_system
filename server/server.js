const express = require("express");
const cors = require("cors");
const connectDB = require("./utils/db.js");
const Attendance = require("./models/Attendance");
const guardRoutes = require("./routes/guardRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const projectRoutes = require("./routes/projectRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const salaryRoutes = require("./routes/salaryRoutes"); // NEW: Import Salary Routes
const authRoutes = require("./routes/authRoutes");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/guards", require("./routes/guardRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/salary", require("./routes/salaryRoutes")); // NEW: Mount Salary Routes
app.use("/api/quotations", quotationRoutes);
app.use("/api/system", require("./routes/authRoutes"));

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    // Automatically clean up old duplicate indexes on startup
    await Attendance.cleanupIndices();

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to database", err);
  });
