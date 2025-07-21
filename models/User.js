const mongoose = require('mongoose')
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager'], default: 'manager' },
  phone: { type: String },
  department: { type: String },
  isActive: { type: Boolean, default: true },
  otp: String,
  otpExpiry: Date
}, { timestamps: true })
module.exports = mongoose.model('User', userSchema)