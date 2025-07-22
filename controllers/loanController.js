const Loan = require('../models/Loan')
const Customer = require('../models/Customer')
const Item = require('../models/Item')
const Repayment = require('../models/Repayment')
const Transaction = require('../models/transactionsModel')

// Utility function to generate loan ID
const generateLoanId = async () => {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  
  const todayLoans = await Loan.find({
    loanId: { $regex: `^LN${year}${month}${day}` }
  }).sort({ loanId: -1 }).limit(1)
  
  let sequence = 1
  if (todayLoans.length > 0) {
    const lastLoanId = todayLoans[0].loanId
    sequence = parseInt(lastLoanId.slice(-3)) + 1
  }
  
  return `LN${year}${month}${day}${sequence.toString().padStart(3, '0')}`
}

// Calculate interest based on time difference
const calculateInterest = (principal, interestRate, loanDate, currentDate = new Date()) => {
  const daysDiff = Math.ceil((currentDate - loanDate) / (1000 * 60 * 60 * 24))
  const monthsDiff = daysDiff / 30
  
  // Calculate interest based on months
  const interest = (principal * interestRate * monthsDiff) / 100
  
  return {
    daysDifference: daysDiff,
    monthsDifference: monthsDiff,
    interestAmount: Math.round(interest)
  }
}

// Get all active loans
exports.getActiveLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ status: 'active' })
      .populate('customerId', 'name phone')
      .populate('itemIds', 'name category weight estimatedValue')
      .sort({ createdAt: -1 })
    
    const loansWithInterest = loans.map(loan => {
      const interestData = calculateInterest(
        loan.amount, 
        loan.interestPercent, 
        loan.loanDate
      )
      
      return {
        ...loan.toObject(),
        currentInterest: interestData.interestAmount,
        daysPassed: interestData.daysDifference,
        totalDue: loan.amount + interestData.interestAmount
      }
    })
    
    res.json(loansWithInterest)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get all inactive loans
exports.getInactiveLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ status: 'inactive' })
      .populate('customerId', 'name phone')
      .populate('itemIds', 'name category weight estimatedValue')
      .sort({ createdAt: -1 })
    
    const loansWithRepayment = await Promise.all(
      loans.map(async (loan) => {
        const repayment = await Repayment.findOne({ loanId: loan._id })
        return {
          ...loan.toObject(),
          repaymentDetails: repayment
        }
      })
    )
    
    res.json(loansWithRepayment)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Search loans by phone number
exports.searchLoansByPhone = async (req, res) => {
  try {
    const { phone } = req.params
    
    const customer = await Customer.findOne({ phone })
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' })
    }
    
    const loans = await Loan.find({ customerId: customer._id })
      .populate('customerId', 'name phone address')
      .populate('itemIds', 'name category weight estimatedValue')
      .sort({ createdAt: -1 })
    
    const loansWithDetails = loans.map(loan => {
      if (loan.status === 'active') {
        const interestData = calculateInterest(
          loan.amount, 
          loan.interestPercent, 
          loan.loanDate
        )
        
        return {
          ...loan.toObject(),
          currentInterest: interestData.interestAmount,
          daysPassed: interestData.daysDifference,
          totalDue: loan.amount + interestData.interestAmount
        }
      }
      return loan.toObject()
    })
    
    res.json(loansWithDetails)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get loan by ID
exports.getLoanById = async (req, res) => {
  try {
    const { id } = req.params
    
    // Build query - try loanId first, then _id if it's a valid ObjectId
    let query = { loanId: id }
    
    // Check if id is a valid ObjectId format
    const mongoose = require('mongoose')
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { loanId: id }] }
    }
    
    const loan = await Loan.findOne(query)
    .populate('customerId', 'name phone address')
    .populate('itemIds', 'name category weight estimatedValue')
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' })
    }
    
    let loanData = loan.toObject()
    
    if (loan.status === 'active') {
      const interestData = calculateInterest(
        loan.amount, 
        loan.interestPercent, 
        loan.loanDate
      )
      
      loanData = {
        ...loanData,
        currentInterest: interestData.interestAmount,
        daysPassed: interestData.daysDifference,
        totalDue: loan.amount + interestData.interestAmount
      }
    } else {
      // Get repayment details for inactive loans
      const repayment = await Repayment.findOne({ loanId: loan._id })
      loanData.repaymentDetails = repayment
    }
    
    res.json(loanData)
  } catch (error) {
    console.error('Error in getLoanById:', error)
    res.status(500).json({ message: error.message })
  }
}

// Get loan statistics
exports.getLoanStatistics = async (req, res) => {
  try {
    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // Get current month's date range
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)
    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    
    const totalLoans = await Loan.countDocuments()
    const activeLoans = await Loan.countDocuments({ status: 'active' })
    const inactiveLoans = await Loan.countDocuments({ status: 'inactive' })
    
    // Get today's loans given
    const todayLoansGiven = await Loan.find({
      createdAt: { $gte: today, $lt: tomorrow }
    })
    const todayLoanAmount = todayLoansGiven.reduce((sum, loan) => sum + loan.amount, 0)
    
    // Get today's repayments - Fixed field name from dateRepaid to repaymentDate
    const Repayment = require('../models/Repayment')
    const todayRepayments = await Repayment.find({
      repaymentDate: { $gte: today, $lt: tomorrow }
    })
    const todayRepaymentAmount = todayRepayments.reduce((sum, repayment) => sum + repayment.totalAmount, 0)
    
    // Calculate today's profit - This should be the interest earned from repayments
    const todayInterestEarned = todayRepayments.reduce((sum, repayment) => sum + repayment.interestAmount, 0)
    
    // Get this month's repayments for monthly profit
    const monthlyRepayments = await Repayment.find({
      repaymentDate: { $gte: currentMonth, $lt: nextMonth }
    })
    const monthlyInterestEarned = monthlyRepayments.reduce((sum, repayment) => sum + repayment.interestAmount, 0)
    const monthlyRepaymentAmount = monthlyRepayments.reduce((sum, repayment) => sum + repayment.totalAmount, 0)
    
    // Get this month's loans given
    const monthlyLoansGiven = await Loan.find({
      createdAt: { $gte: currentMonth, $lt: nextMonth }
    })
    const monthlyLoanAmount = monthlyLoansGiven.reduce((sum, loan) => sum + loan.amount, 0)
    
    // Get total loan amounts
    const activeLoanAmounts = await Loan.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ])
    
    const inactiveLoanAmounts = await Loan.aggregate([
      { $match: { status: 'inactive' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ])
    
    // Get payment method breakdown
    const paymentBreakdown = await Loan.aggregate([
      { $group: { 
        _id: '$status',
        totalCash: { $sum: '$payment.cash' },
        totalOnline: { $sum: '$payment.online' }
      }}
    ])
    
    // Calculate total interest for active loans
    const activeLoansWithInterest = await Loan.find({ status: 'active' })
    let totalCurrentInterest = 0
    
    activeLoansWithInterest.forEach(loan => {
      const interestData = calculateInterest(
        loan.amount, 
        loan.interestPercent, 
        loan.loanDate
      )
      totalCurrentInterest += interestData.interestAmount
    })
    
    res.json({
      totalLoans,
      activeLoans,
      inactiveLoans,
      totalActiveLoanAmount: activeLoanAmounts[0]?.totalAmount || 0,
      totalInactiveLoanAmount: inactiveLoanAmounts[0]?.totalAmount || 0,
      totalCurrentInterest,
      todayLoanAmount,
      todayRepaymentAmount,
      todayProfit: todayInterestEarned, // Changed to interest earned instead of repayment - given
      monthlyLoanAmount,
      monthlyRepaymentAmount,
      monthlyProfit: monthlyInterestEarned,
      paymentBreakdown
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Functions are already exported using exports.functionName above
// Additional exports for utility functions
module.exports = {
  ...module.exports,
  generateLoanId,
  calculateInterest
}