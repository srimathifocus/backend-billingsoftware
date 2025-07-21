const mongoose = require('mongoose')

const balanceSheetSchema = new mongoose.Schema({
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
  // Assets
  cashInHandBank: {
    type: Number,
    default: 0,
    min: 0
  },
  loanReceivables: {
    type: Number,
    default: 0,
    min: 0
  },
  forfeitedInventory: {
    type: Number,
    default: 0,
    min: 0
  },
  furnitureFixtures: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAssets: {
    type: Number,
    default: 0
  },
  // Liabilities & Equity
  customerPayables: {
    type: Number,
    default: 0,
    min: 0
  },
  bankOverdraft: {
    type: Number,
    default: 0,
    min: 0
  },
  ownersEquity: {
    type: Number,
    default: 0
  },
  totalLiabilitiesEquity: {
    type: Number,
    default: 0
  },
  // Revenue
  interestIncome: {
    type: Number,
    default: 0,
    min: 0
  },
  saleOfForfeitedItems: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  // Net Profit (calculated from revenue - expenses)
  netProfit: {
    type: Number,
    default: 0
  }
}, { timestamps: true })

// Compound index to ensure unique month-year combination
balanceSheetSchema.index({ month: 1, year: 1 }, { unique: true })

// Pre-save middleware to calculate totals
balanceSheetSchema.pre('save', function(next) {
  this.totalAssets = this.cashInHandBank + this.loanReceivables + this.forfeitedInventory + this.furnitureFixtures
  this.totalLiabilitiesEquity = this.customerPayables + this.bankOverdraft + this.ownersEquity
  this.totalRevenue = this.interestIncome + this.saleOfForfeitedItems
  next()
})

module.exports = mongoose.model('BalanceSheet', balanceSheetSchema)