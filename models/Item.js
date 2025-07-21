const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  categories: [{ 
    type: String, 
    required: true,
    trim: true 
  }],
  carats: [{ 
    type: String, 
    required: true,
    trim: true 
  }],
  // Keep old fields for backward compatibility with billing
  category: { 
    type: String, 
    trim: true 
  },
  carat: { 
    type: String, 
    trim: true 
  },
  weight: { 
    type: Number, 
    min: 0 
  },
  estimatedValue: { 
    type: Number, 
    min: 0 
  },
  loanId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Loan' 
  },
  status: { 
    type: String, 
    enum: ['available', 'pledged', 'released'], 
    default: 'available' 
  },
  // New field to distinguish between master items and billing items
  itemType: {
    type: String,
    enum: ['master', 'billing'],
    default: 'master'
  }
}, { timestamps: true })

// Index for better performance (code already has unique: true, so no need for separate index)
itemSchema.index({ loanId: 1 })
itemSchema.index({ category: 1 })

module.exports = mongoose.model('Item', itemSchema)