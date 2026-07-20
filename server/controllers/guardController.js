const Guard = require("../models/Guard");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function listGuards(req, res) {
  try {
    const guards = await Guard.find()
      .populate("projectId", "name active")
      .populate("projectHistory.projectId", "name")
      .sort({ active: -1, name: 1 });
    res.json(guards);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch guards" });
  }
}

async function createGuard(req, res) {
  try {
    const {
      name,
      fathersName,
      address,
      contact,
      department,
      projectId,
      salary,
      isReliever,
      pfNumber,
      esicNumber,
      adhar,
      pan,
      doj,
      bloodGroup,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
    } = req.body;

    if (!name || !contact) {
      return res.status(400).json({ message: "Name and contact are required" });
    }

    const finalProjectId = projectId && projectId !== "" ? projectId : null;

    if (!isReliever && !finalProjectId) {
      return res
        .status(400)
        .json({ message: "Project is required for regular guards" });
    }

    const cleanContact = contact.replace(/\D/g, "");

    const existingGuard = await Guard.findOne({ contact: cleanContact });
    if (existingGuard) {
      return res
        .status(400)
        .json({ message: "Guard with this contact number already exists" });
    }

    const existingUser = await User.findOne({ username: cleanContact });
    if (existingUser) {
      return res
        .status(400)
        .json({
          message: "A login account for this mobile number already exists.",
        });
    }

    const effStartDate = doj || todayStr();

    const guard = await Guard.create({
      name: name.toUpperCase(),
      fathersName: fathersName?.toUpperCase() || "",
      address: address?.toUpperCase() || "",
      contact: cleanContact,
      department: department?.toUpperCase() || "SECURITY GUARD",
      projectId: finalProjectId,
      isReliever,
      salary: salary || 0,
      pfNumber: pfNumber?.toUpperCase() || "",
      esicNumber: esicNumber?.toUpperCase() || "",
      adhar,
      pan: pan?.toUpperCase(),
      doj,
      bloodGroup: bloodGroup?.toUpperCase(),
      bankName: bankName?.toUpperCase(),
      accountNumber,
      ifscCode: ifscCode?.toUpperCase(),
      branchName: branchName?.toUpperCase(),
      username: cleanContact,
      // Initialize first project history stint with the starting salary
      projectHistory: [
        {
          projectId: finalProjectId,
          startDate: effStartDate,
          endDate: null,
          salary: salary || 0,
        },
      ],
    });

    const passwordHash = await bcrypt.hash(cleanContact, 10);
    await User.create({
      username: cleanContact,
      passwordHash,
      role: "guard",
      guardId: guard._id,
    });

    const populatedGuard = await Guard.findById(guard._id)
      .populate("projectId", "name active")
      .populate("projectHistory.projectId", "name");

    res.status(201).json(populatedGuard);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to create guard" });
  }
}

async function updateGuardDetails(req, res) {
  try {
    const guardId = req.params.id;
    const {
      name,
      fathersName,
      address,
      contact,
      department,
      salary,
      pfNumber,
      esicNumber,
      isReliever,
      projectId,
      effectiveDate,
      adhar,
      pan,
      doj,
      bloodGroup,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
    } = req.body;

    const guard = await Guard.findById(guardId);
    if (!guard) return res.status(404).json({ message: "Guard not found" });

    // CAPTURE THE OLD SALARY BEFORE UPDATING IT
    const oldSalary = guard.salary || 0;

    guard.name = name?.toUpperCase();
    guard.fathersName = fathersName?.toUpperCase() || "";
    guard.address = address?.toUpperCase() || "";
    guard.contact = contact;
    guard.department = department?.toUpperCase() || "SECURITY GUARD";
    guard.salary = salary || 0; // Updated to new salary
    guard.pfNumber = pfNumber?.toUpperCase() || "";
    guard.esicNumber = esicNumber?.toUpperCase() || "";

    guard.adhar = adhar;
    guard.pan = pan?.toUpperCase();
    guard.doj = doj;
    guard.bloodGroup = bloodGroup?.toUpperCase();
    guard.bankName = bankName?.toUpperCase();
    guard.accountNumber = accountNumber;
    guard.ifscCode = ifscCode?.toUpperCase();
    guard.branchName = branchName?.toUpperCase();

    const effDate = effectiveDate || todayStr();
    let assignmentChanged = false;

    const isNowReliever = isReliever === true;
    const safeProjectId = projectId && projectId !== "" ? projectId : null;
    const finalProjectId = isNowReliever ? null : safeProjectId;

    if (
      guard.isReliever === isNowReliever &&
      String(guard.projectId) === String(finalProjectId)
    ) {
      assignmentChanged = false;
    } else if (guard.projectHistory && guard.projectHistory.length > 0) {
      const openStint = guard.projectHistory.find((h) => h.endDate === null);
      if (openStint) {
        const currentStr = openStint.projectId
          ? openStint.projectId.toString()
          : null;
        const newStr = finalProjectId ? finalProjectId.toString() : null;

        if (currentStr !== newStr) {
          openStint.endDate = effDate;
          openStint.salary = oldSalary; // SNAPSHOT: Lock in the old salary for the past project
          assignmentChanged = true;
        }
      } else {
        assignmentChanged = true;
      }
    } else {
      assignmentChanged = true;
    }

    if (assignmentChanged) {
      guard.projectHistory.push({
        projectId: finalProjectId,
        startDate: effDate,
        endDate: null,
        salary: guard.salary, // Apply the new salary to the new stint
      });
    }

    guard.isReliever = isNowReliever;
    guard.projectId = finalProjectId;

    await guard.save();

    const populated = await Guard.findById(guard._id)
      .populate("projectId", "name")
      .populate("projectHistory.projectId", "name");

    res.json(populated);
  } catch (error) {
    res
      .status(500)
      .json({
        message: error.message || "Server error occurred while updating.",
      });
  }
}

async function deactivate(req, res) {
  try {
    const guard = await Guard.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { returnDocument: "after" },
    )
      .populate("projectId", "name")
      .populate("projectHistory.projectId", "name");
    res.json(guard);
  } catch (error) {
    res.status(500).json({ message: "Failed to deactivate guard" });
  }
}

async function reactivate(req, res) {
  try {
    const guard = await Guard.findByIdAndUpdate(
      req.params.id,
      { active: true },
      { returnDocument: "after" },
    )
      .populate("projectId", "name")
      .populate("projectHistory.projectId", "name");
    res.json(guard);
  } catch (error) {
    res.status(500).json({ message: "Failed to reactivate guard" });
  }
}

module.exports = {
  listGuards,
  createGuard,
  updateGuardDetails,
  deactivate,
  reactivate,
};
