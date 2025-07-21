const mongoose = require('mongoose')

const repaymentSchema = new mongoose.Schema({
  loanId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Loan', 
    required: true 
  },
  principalAmount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  interestAmount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  totalAmount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  payment: {
    cash: { type: Number, default: 0 },
    online: { type: Number, default: 0 }
  },
  repaymentDate: { 
    type: Date, 
    default: Date.now 
  },
  daysDifference: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['completed', 'partial'], 
    default: 'completed' 
  }
}, { timestamps: true })

// Index for better performance
repaymentSchema.index({ loanId: 1 })
repaymentSchema.index({ repaymentDate: 1 })

module.exports = mongoose.model('Repayment', repaymentSchema)
