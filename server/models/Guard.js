const mongoose = require("mongoose");

const projectStintSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    salary: { type: Number, default: 0 }, // NEW: Stores historical salary
  },
  { _id: false },
);

const guardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fathersName: { type: String, default: "" },
    address: { type: String, default: "" },
    contact: { type: String, required: true },
    department: { type: String, default: "Security Guard" },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    isReliever: { type: Boolean, default: false },
    projectHistory: { type: [projectStintSchema], default: [] },
    username: { type: String, required: true },
    active: { type: Boolean, default: true },
    salary: { type: Number, default: 0 },

    adhar: { type: String, default: "" },
    pan: { type: String, default: "" },
    doj: { type: String, default: "" },
    bloodGroup: { type: String, default: "" },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    branchName: { type: String, default: "" },
    employeeCode: { type: String, default: "" },

    pfNumber: { type: String, default: "" },
    esicNumber: { type: String, default: "" },
  },
  { timestamps: true },
);

guardSchema.pre("save", function () {
  if (
    this.adhar &&
    typeof this.adhar === "string" &&
    this.adhar.length >= 4 &&
    !this.employeeCode
  ) {
    this.employeeCode = `DSMS${this.adhar.substring(0, 4)}`;
  }
});

module.exports = mongoose.model("Guard", guardSchema);
