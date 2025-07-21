const mongoose = require('mongoose')

const loanSchema = new mongoose.Schema({
  loanId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  itemIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Item' 
  }],
  amount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  interestType: { 
    type: String, 
    enum: ['monthly', 'yearly', 'daily'], 
    default: 'monthly' 
  },
  interestPercent: { 
    type: Number, 
    required: true,
    min: 0 
  },
  validity: { 
    type: String, 
    required: true 
  },
  loanDate: { 
    type: Date, 
    default: Date.now 
  },
  dueDate: { 
    type: Date, 
    required: true 
  },
  payment: {
    cash: { type: Number, default: 0 },
    online: { type: Number, default: 0 }
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  }
}, { timestamps: true })

// Index for better performance (loanId already has unique: true, so no need for separate index)
loanSchema.index({ customerId: 1, status: 1 })
loanSchema.index({ loanDate: 1 })

// Virtual for total amount
loanSchema.virtual('totalAmount').get(function() {
  return this.payment.cash + this.payment.online
})

module.exports = mongoose.model('Loan', loanSchema)
