const mongoose = require("mongoose");
const dns = require("dns");

const configureDnsServers = () => {
  if (!process.env.DNS_SERVERS) {
    return;
  }

  const servers = process.env.DNS_SERVERS.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    dns.setServers(servers);
  }
};

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
};

module.exports = connectDB;
