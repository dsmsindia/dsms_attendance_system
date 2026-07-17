const express = require("express");
const cors = require("cors");
const connectDB = require("./utils/db.js");
const Attendance = require("./models/Attendance");
const guardRoutes = require("./routes/guardRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const projectRoutes = require("./routes/projectRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const authRoutes = require("./routes/authRoutes");

require("dotenv").config();

const app = express();

// Generic CORS Configuration: Automatically allows any origin (Vercel, Localhost, etc.) with credentials
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/guards", guardRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/salary", salaryRoutes);
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