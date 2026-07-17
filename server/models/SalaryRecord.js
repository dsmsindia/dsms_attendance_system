const mongoose = require("mongoose");

const salaryRecordSchema = new mongoose.Schema(
  {
    guardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guard",
      required: true,
    },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    bonus: { type: Number, default: null },
    edAmount: { type: Number, default: null },
    advance: { type: Number, default: null },
    othersDeduction: { type: Number, default: null },
    
    // Toggles whether PF & ESIC should be bypassed (0) for this month
    skipPfEsic: { type: Boolean, default: false },
    
    // NEW: Stores all manual math overrides for the Waterfall Math Engine
    overrides: { type: Object, default: {} },
    
    isPaid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

salaryRecordSchema.index({ guardId: 1, year: 1, month: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model("SalaryRecord", salaryRecordSchema);