require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../utils/db");
const User = require("../models/User");

async function run() {
  await connectDB();

  const username = process.argv[2];
  const plainPassword = process.argv[3];

  if (!username || !plainPassword) {
    console.log("❌ Error: Missing credentials.");
    console.log(
      "👉 Usage: node server/seed/createAdmin.js <username> <new_password>",
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const existing = await User.findOne({ username });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.isActive = true; // Added this!
    await existing.save();
    console.log(
      `✅ SUCCESS: Password successfully updated for existing admin '${username}'.`,
    );
  } else {
    // Added isActive: true here!
    await User.create({
      username,
      passwordHash,
      role: "admin",
      guardId: null,
      isActive: true,
    });
    console.log(
      `✅ SUCCESS: New Admin created — username: ${username} / password: ${plainPassword}`,
    );
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
