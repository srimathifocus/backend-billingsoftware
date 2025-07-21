const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  phone: { 
    type: String, 
    required: true,
    unique: true,
    trim: true 
  },
  address: {
    doorNo: { type: String, trim: true },
    street: { type: String, trim: true },
    town: { type: String, trim: true },
    district: { type: String, trim: true },
    pincode: { type: String, trim: true }
  },
  nominee: { 
    type: String, 
    trim: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true })

// Index for better performance (phone already has unique: true, so no need for separate index)
customerSchema.index({ name: 1 })

module.exports = mongoose.model('Customer', customerSchema)