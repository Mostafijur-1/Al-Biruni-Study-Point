/**
 * Create the first admin user (no public registration for admins).
 *
 * Usage:
 *   node scripts/seed-admin.mjs "Admin Name" admin@example.com "your-password"
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node scripts/seed-admin.mjs "Name" email@example.com "password"');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    role: { type: String, default: "admin" },
    isActive: { type: Boolean, default: true },
    approvalStatus: { type: String, default: "approved" },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

await mongoose.connect(uri, { dbName: "absp" });

const existing = await User.findOne({ email: email.toLowerCase() });

if (existing) {
  console.error("A user with this email already exists.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

await User.create({
  name,
  email: email.toLowerCase(),
  password: hash,
  role: "admin",
  isActive: true,
  approvalStatus: "approved",
});

console.log("Admin user created:", email);
await mongoose.disconnect();
