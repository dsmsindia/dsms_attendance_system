const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    refNo: { type: String, required: true },
    date: { type: String, required: true },
    to: { type: String, required: true, default: "THE MANAGEMENT" },
    companyName: { type: String, required: true },
    address: { type: String, required: true },
    isGstApplied: { type: Boolean, default: true }, // NEW: Saves GST status
    manpower: [
      {
        category: { type: String, required: true },
        rate: { type: Number, required: true },
        persons: { type: Number, required: true },
        dutyDays: { type: String, required: true },
        dutyHours: { type: String, required: true },
        gstPercent: { type: Number, default: 18 },
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quotation", quotationSchema);