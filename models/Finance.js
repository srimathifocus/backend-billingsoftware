const mongoose = require('mongoose');

// Business Details Schema (as per Tamil Nadu norms)
const businessDetailsSchema = {
  proprietorName: { type: String, default: '' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  shopType: { type: String, default: 'Pawnbroking & Jewellery Sales' },
  accountingSoftware: { type: String, default: 'Custom Pawnshop Management System' },
  licenseNo: { type: String, default: '' },
  location: { type: String, default: '' },
  auditFirm: { type: String, default: '' }
};

// Profit & Loss Schema (as per Indian Accounting Standards)
const profitLossSchema = {
  revenue: {
    interestIncomeFromLoans: { type: Number, default: 0 },
    saleOfForfeitedItems: { type: Number, default: 0 },
    otherOperatingIncome: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  expenses: {
    employeeSalaries: { type: Number, default: 0 },
    officeRent: { type: Number, default: 0 },
    goldAppraiserCharges: { type: Number, default: 0 },
    utilitiesInternet: { type: Number, default: 0 },
    accountingAuditFees: { type: Number, default: 0 },
    miscellaneousExpenses: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 }
  },
  netProfitBeforeTax: { type: Number, default: 0 }
};

// Balance Sheet Schema (as per Indian Accounting Standards)
const balanceSheetSchema = {
  assets: {
    cashInHandBank: { type: Number, default: 0 },
    goldLoanReceivables: { type: Number, default: 0 },
    inventoryForfeitedItems: { type: Number, default: 0 },
    officeEquipment: { type: Number, default: 0 },
    totalAssets: { type: Number, default: 0 }
  },
  liabilitiesEquity: {
    proprietorCapital: { type: Number, default: 0 },
    sundryCreditors: { type: Number, default: 0 },
    taxesPayableGST: { type: Number, default: 0 },
    totalLiabilitiesEquity: { type: Number, default: 0 }
  }
};

// Compliance & Registers Schema (Tamil Nadu Pawnbrokers Act)
const complianceSchema = {
  kycCollection: { type: Number, default: 100 }, // Percentage
  panForHighValueLoans: { type: Number, default: 0 }, // Count of loans > 50,000 with PAN
  cctvInstalled: { type: Boolean, default: true },
  goldAppraisalByAuthorizedValuer: { type: Boolean, default: true },
  authorizedValuerName: { type: String, default: '' },
  insuranceOnPledgedGold: { type: Number, default: 0 }, // Coverage amount
  gstFilingStatus: { type: String, default: 'Regular' }, // Regular/Pending
  itReturnsStatus: { type: String, default: 'Filed' }, // Filed/Pending
  registersMaintenanceStatus: { type: String, default: 'Physical & Digital' }
};

// Loan Register Summary Schema
const loanRegisterSummarySchema = {
  totalPledgedLoans: { type: Number, default: 0 },
  activeLoans: { type: Number, default: 0 },
  settledLoans: { type: Number, default: 0 },
  forfeitedLoans: { type: Number, default: 0 },
  totalLoanValue: { type: Number, default: 0 },
  averageInterestRate: { type: Number, default: 24 }
};

// Auditor Observations Schema
const auditorObservationsSchema = {
  observations: [{ type: String }],
  conclusion: { type: String, default: '' },
  auditorName: { type: String, default: '' },
  auditorQualification: { type: String, default: '' },
  membershipNo: { type: String, default: '' },
  auditDate: { type: Date, default: Date.now }
};

const financeSchema = new mongoose.Schema({
  // Period Information
  year: {
    type: Number,
    required: true,
    min: 2020,
    max: 2030
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  
  // Financial Year (April to March)
  financialYear: {
    type: String, // Format: "2024-25"
    required: true
  },
  
  // Business Details (Manual Entry)
  businessDetails: businessDetailsSchema,
  
  // Profit & Loss Account (Manual Entry for expenses, Auto-calculated for revenue)
  profitLoss: profitLossSchema,
  
  // Balance Sheet (Manual Entry)
  balanceSheet: balanceSheetSchema,
  
  // Loan Register Summary (Auto-calculated from DB)
  loanRegisterSummary: loanRegisterSummarySchema,
  
  // Compliance & Registers (Manual Entry)
  compliance: complianceSchema,
  
  // Auditor Observations (Manual Entry)
  auditorObservations: auditorObservationsSchema,
  
  // Auto-calculated fields from database
  autoCalculatedMetrics: {
    totalLoansGivenInMonth: { type: Number, default: 0 },
    totalRepaymentsInMonth: { type: Number, default: 0 },
    totalInterestEarnedInMonth: { type: Number, default: 0 },
    newCustomersInMonth: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // System fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Status
  isFinalized: { type: Boolean, default: false },
  finalizedAt: { type: Date },
  finalizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create compound index to ensure unique year-month combination
financeSchema.index({ year: 1, month: 1 }, { unique: true });
financeSchema.index({ financialYear: 1 });

// Virtual to calculate total revenue
financeSchema.virtual('totalRevenue').get(function() {
  const revenue = this.profitLoss.revenue;
  return revenue.interestIncomeFromLoans + revenue.saleOfForfeitedItems + revenue.otherOperatingIncome;
});

// Virtual to calculate total expenses
financeSchema.virtual('totalExpenses').get(function() {
  const expenses = this.profitLoss.expenses;
  return expenses.employeeSalaries + expenses.officeRent + expenses.goldAppraiserCharges + 
         expenses.utilitiesInternet + expenses.accountingAuditFees + expenses.miscellaneousExpenses;
});

// Virtual to calculate net profit
financeSchema.virtual('netProfit').get(function() {
  return this.totalRevenue - this.totalExpenses;
});

// Virtual to calculate total assets
financeSchema.virtual('totalAssets').get(function() {
  const assets = this.balanceSheet.assets;
  return assets.cashInHandBank + assets.goldLoanReceivables + assets.inventoryForfeitedItems + assets.officeEquipment;
});

// Virtual to calculate total liabilities & equity
financeSchema.virtual('totalLiabilitiesEquity').get(function() {
  const liabilitiesEquity = this.balanceSheet.liabilitiesEquity;
  return liabilitiesEquity.proprietorCapital + liabilitiesEquity.sundryCreditors + liabilitiesEquity.taxesPayableGST;
});

// Pre-save middleware to calculate totals
financeSchema.pre('save', function(next) {
  // Calculate revenue totals
  const revenue = this.profitLoss.revenue;
  this.profitLoss.revenue.totalRevenue = revenue.interestIncomeFromLoans + revenue.saleOfForfeitedItems + revenue.otherOperatingIncome;
  
  // Calculate expense totals
  const expenses = this.profitLoss.expenses;
  this.profitLoss.expenses.totalExpenses = expenses.employeeSalaries + expenses.officeRent + expenses.goldAppraiserCharges + 
                                          expenses.utilitiesInternet + expenses.accountingAuditFees + expenses.miscellaneousExpenses;
  
  // Calculate net profit
  this.profitLoss.netProfitBeforeTax = this.profitLoss.revenue.totalRevenue - this.profitLoss.expenses.totalExpenses;
  
  // Calculate balance sheet totals
  const assets = this.balanceSheet.assets;
  this.balanceSheet.assets.totalAssets = assets.cashInHandBank + assets.goldLoanReceivables + assets.inventoryForfeitedItems + assets.officeEquipment;
  
  const liabilitiesEquity = this.balanceSheet.liabilitiesEquity;
  this.balanceSheet.liabilitiesEquity.totalLiabilitiesEquity = liabilitiesEquity.proprietorCapital + liabilitiesEquity.sundryCreditors + liabilitiesEquity.taxesPayableGST;
  
  // Generate financial year if not provided
  if (!this.financialYear) {
    const currentMonth = this.month;
    const currentYear = this.year;
    if (currentMonth >= 4) {
      this.financialYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    } else {
      this.financialYear = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    }
  }
  
  next();
});

// Ensure virtual fields are serialized
financeSchema.set('toJSON', { virtuals: true });
financeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Finance', financeSchema);