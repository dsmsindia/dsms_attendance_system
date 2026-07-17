const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]); // avoid router DNS issues with SRV lookups

const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");
}

module.exports = connectDB;
