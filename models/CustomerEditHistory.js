const mongoose = require('mongoose')

const customerEditHistorySchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  editedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  editType: {
    type: String,
    enum: ['UPDATE', 'DELETE'],
    required: true
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  previousData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  newData: {
    type: mongoose.Schema.Types.Mixed
  },
  reason: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, { timestamps: true })

// Index for better performance
customerEditHistorySchema.index({ customerId: 1, createdAt: -1 })
customerEditHistorySchema.index({ editedBy: 1, createdAt: -1 })

module.exports = mongoose.model('CustomerEditHistory', customerEditHistorySchema)