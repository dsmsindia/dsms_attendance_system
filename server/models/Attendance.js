const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    guardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guard",
      required: true,
    },
    date: { type: String, required: true },
    time: { type: String, default: null }, // Stores the exact time (e.g., "09:30 AM")
    status: {
      type: String,
      enum: ["P", "A", "DD", "HD", "OFF", "H"],
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    markedByAdmin: { type: Boolean, default: false }, // Tracks if admin manually saved this
    isLocked: { type: Boolean, default: false }, // NEW: Locks Holiday edits from users
  },
  { timestamps: true },
);

// Your existing index
attendanceSchema.index({ guardId: 1, date: 1, projectId: 1 }, { unique: true });

// RESTORED: Your original cleanup indices function that server.js relies on
attendanceSchema.statics.cleanupIndices = async function () {
  try {
    await this.collection.dropIndex("guardId_1_date_1");
    console.log("✅ Dropped legacy compound index: guardId_1_date_1");
  } catch (err) {
    // Safe to ignore if it doesn't exist
  }
};

const Attendance = mongoose.model("Attendance", attendanceSchema);
module.exports = Attendance;
