const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["ALL DAY", "WEEKLY OFF"],
      default: "WEEKLY OFF",
    },
    active: { type: Boolean, default: true },
    holidays: [{ date: String }], // Added holidays array tracking dates
  },
  { timestamps: true },
);

module.exports = mongoose.model("Project", projectSchema);
