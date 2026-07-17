const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: "Username and password required" });

  try {
    const trimmedUsername = String(username).trim();
    const noSpaceUsername = trimmedUsername.replace(/\s+/g, ""); 

    const user = await User.findOne({
      $or: [ { username: trimmedUsername }, { username: noSpaceUsername }, { username: new RegExp('^' + trimmedUsername + '$', 'i') } ]
    }).populate("guardId");

    if (!user) return res.status(401).json({ message: "Incorrect username or password" });

    const safePassword = String(password).trim();
    let match = await bcrypt.compare(safePassword, user.passwordHash);

    if (!match && safePassword.length === 4 && safePassword === user.username.slice(-4)) {
        const isDefaultPassword = await bcrypt.compare(user.username, user.passwordHash);
        if (isDefaultPassword) match = true; 
    }

    if (!match) return res.status(401).json({ message: "Incorrect username or password" });

    const token = jwt.sign(
      { id: user._id, role: user.role, guardId: user.guardId?._id || user.guardId, name: user.guardId ? user.guardId.name : null },
      process.env.JWT_SECRET, { expiresIn: "12h" }
    );

    res.json({
      token,
      user: {
        id: user._id, username: user.username, role: user.role,
        guardId: user.guardId?._id || user.guardId, name: user.guardId ? user.guardId.name : null, 
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error during login. Please try again." });
  }
}

module.exports = { login };