const Project = require("../models/Project");
const Guard = require("../models/Guard");

async function getProjects(req, res) {
  try {
    // Sort: Active first (true=1, false=0 -> descending), then alphabetically by name
    const projects = await Project.find().sort({ active: -1, name: 1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
}

async function createProject(req, res) {
  try {
    const { name, type } = req.body;
    if (!name)
      return res.status(400).json({ message: "Project name is required" });
    const project = await Project.create({
      name: name.toUpperCase(),
      type: type || "WEEKLY OFF",
      active: true,
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to create project" });
  }
}

async function updateProject(req, res) {
  try {
    const { name, type, active } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (active === false) {
      const linkedGuards = await Guard.countDocuments({
        projectId: project._id,
        active: true,
      });
      if (linkedGuards > 0) {
        return res.status(400).json({
          message: `Cannot deactivate project. ${linkedGuards} active guard(s) are currently assigned to it. Transfer them first.`,
        });
      }
    }

    if (name) project.name = name.toUpperCase();
    if (type) project.type = type;
    if (active !== undefined) project.active = active;

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to update project" });
  }
}

async function toggleProjectHoliday(req, res) {
  try {
    const { id } = req.params;
    const { date, action } = req.body;

    if (!date) return res.status(400).json({ message: "Date is required" });

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (action === "add") {
      if (!project.holidays) project.holidays = [];
      if (!project.holidays.some((h) => h.date === date)) {
        project.holidays.push({ date });
      }
    } else if (action === "remove") {
      if (project.holidays) {
        project.holidays = project.holidays.filter((h) => h.date !== date);
      }
    } else {
      return res
        .status(400)
        .json({ message: "Invalid action. Use 'add' or 'remove'." });
    }

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to update holidays" });
  }
}

module.exports = {
  getProjects,
  createProject,
  updateProject,
  toggleProjectHoliday,
};
