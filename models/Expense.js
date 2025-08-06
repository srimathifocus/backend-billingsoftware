const mongoose = require('mongoose')

const expenseSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true,
    min: 2020
  },
  salaries: {
    type: Number,
    default: 0,
    min: 0
  },
  rent: {
    type: Number,
    default: 0,
    min: 0
  },
  utilities: {
    type: Number,
    default: 0,
    min: 0
  },
  miscellaneous: {
    type: Number,
    default: 0,
    min: 0
  },
  goldAppraiserCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  accountingAuditFees: {
    type: Number,
    default: 0,
    min: 0
  },
  totalExpenses: {
    type: Number,
    default: 0
  }
}, { timestamps: true })

// Compound index to ensure unique month-year combination
expenseSchema.index({ month: 1, year: 1 }, { unique: true })

// Pre-save middleware to calculate total expenses
expenseSchema.pre('save', function(next) {
  this.totalExpenses = this.salaries + this.rent + this.utilities + this.miscellaneous + this.goldAppraiserCharges + this.accountingAuditFees
  next()
})

module.exports = mongoose.model('Expense', expenseSchema)