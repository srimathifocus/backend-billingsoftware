const mongoose = require('mongoose')

const shopDetailsSchema = new mongoose.Schema({
  shopName: {
    type: String,
    required: true,
    trim: true,
    default: 'GOLDEN JEWELLERY'
  },
  address: {
    type: String,
    required: true,
    trim: true,
    default: '123 Main Street, Jewelry District, City - 500001'
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    default: '+91 9876543210'
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    default: 'info@goldenjewellery.com'
  },
  gstNumber: {
    type: String,
    required: true,
    trim: true,
    default: '29ABCDE1234F1Z5'
  },
  licenseNumber: {
    type: String,
    required: true,
    trim: true,
    default: 'JWL/2024/001'
  },
  location: {
    type: String,
    required: true,
    trim: true,
    default: 'Salem, Tamil Nadu'
  },
  auditorName: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true })

// Ensure only one active shop details record
shopDetailsSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } })

module.exports = mongoose.model('ShopDetails', shopDetailsSchema)