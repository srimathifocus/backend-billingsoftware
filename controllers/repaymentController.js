const mongoose = require('mongoose')
const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Transaction = require('../models/transactionsModel')
const Item = require('../models/Item')
const { calculateInterest } = require('./loanController')

exports.repayLoan = async (req, res) => {
  try {
    const { loanId, payment } = req.body
    console.log('Processing repayment for loanId:', loanId, 'payment:', payment)
    
    // Find loan by loanId (string) or ObjectId
    let loan
    if (mongoose.Types.ObjectId.isValid(loanId)) {
      loan = await Loan.findOne({
        $or: [{ _id: loanId }, { loanId: loanId }]
      })
    } else {
      loan = await Loan.findOne({ loanId: loanId })
    }
    
    if (!loan) {
      console.log('Loan not found:', loanId)
      return res.status(404).json({ message: 'Loan not found' })
    }
    
    console.log('Loan found:', loan.loanId, 'status:', loan.status)
    
    if (loan.status === 'inactive') {
      console.log('Loan already repaid:', loan.loanId)
      return res.status(400).json({ message: 'Loan already repaid' })
    }
    
    // Calculate interest based on time difference
    const interestData = calculateInterest(
      loan.amount,
      loan.interestPercent,
      loan.loanDate
    )
    
    const totalDue = loan.amount + interestData.interestAmount
    const totalPaid = (payment.cash || 0) + (payment.online || 0)
    
    // Validate payment amount
    if (totalPaid <= 0) {
      return res.status(400).json({
        message: 'Payment amount must be greater than 0',
        required: totalDue,
        provided: totalPaid
      })
    }
    
    if (totalPaid < totalDue) {
      return res.status(400).json({
        message: 'Insufficient payment amount',
        required: totalDue,
        provided: totalPaid,
        shortage: totalDue - totalPaid
      })
    }
    
    if (totalPaid > totalDue) {
      return res.status(400).json({
        message: 'Payment amount exceeds total due',
        required: totalDue,
        provided: totalPaid,
        excess: totalPaid - totalDue
      })
    }
    
    // Use transaction to ensure data consistency
    const session = await mongoose.startSession()
    session.startTransaction()
    
    try {
      // Create repayment record
      const repayment = await Repayment.create([{
        loanId: loan._id,
        principalAmount: loan.amount,
        interestAmount: interestData.interestAmount,
        totalAmount: totalDue,
        payment: {
          cash: payment.cash || 0,
          online: payment.online || 0
        },
        daysDifference: interestData.daysDifference
      }], { session })
      
      // Create transaction records
      if (payment.cash > 0) {
        await Transaction.create([{
          loanId: loan._id,
          type: 'repayment',
          mode: 'cash',
          amount: payment.cash,
          date: new Date()
        }], { session })
      }
      
      if (payment.online > 0) {
        await Transaction.create([{
          loanId: loan._id,
          type: 'repayment',
          mode: 'online',
          amount: payment.online,
          date: new Date()
        }], { session })
      }
      
      // Update loan status
      loan.status = 'inactive'
      await loan.save({ session })
      
      // Update item status
      await Item.updateMany(
        { _id: { $in: loan.itemIds } },
        { status: 'released' },
        { session }
      )
      
      await session.commitTransaction()
      
    } catch (error) {
      await session.abortTransaction()
      console.error('Transaction failed:', error)
      throw error
    } finally {
      session.endSession()
    }
    
    res.json({
      success: true,
      message: 'Loan repaid successfully',
      data: {
        loanId: loan.loanId,
        principalAmount: loan.amount,
        interestAmount: interestData.interestAmount,
        totalAmount: totalDue,
        daysPassed: interestData.daysDifference,
        payment: {
          cash: payment.cash || 0,
          online: payment.online || 0
        },
        repaymentInvoiceAvailable: true
      }
    })
    
  } catch (error) {
    console.error('Repayment error:', error)
    res.status(500).json({ message: error.message })
  }
}

exports.searchLoanForRepayment = async (req, res) => {
  try {
    const { identifier } = req.params
    console.log('Searching for loan with identifier:', identifier)
    
    // Search by loanId or phone number
    let loan
    
    if (identifier.startsWith('LN')) {
      // Search by loanId
      console.log('Searching by loanId:', identifier)
      loan = await Loan.findOne({ loanId: identifier, status: 'active' })
        .populate('customerId', 'name phone address')
        .populate('itemIds', 'name category weight estimatedValue')
    } else {
      // Search by phone number
      console.log('Searching by phone number:', identifier)
      const Customer = require('../models/Customer')
      const customer = await Customer.findOne({ phone: identifier })
      
      if (!customer) {
        console.log('Customer not found for phone:', identifier)
        return res.status(404).json({ message: 'Customer not found' })
      }
      
      console.log('Customer found:', customer._id)
      loan = await Loan.findOne({ customerId: customer._id, status: 'active' })
        .populate('customerId', 'name phone address')
        .populate('itemIds', 'name category weight estimatedValue')
    }
    
    if (!loan) {
      console.log('No active loan found for identifier:', identifier)
      return res.status(404).json({ message: 'No active loan found' })
    }
    
    console.log('Loan found:', loan.loanId)
    
    // Calculate current interest
    const interestData = calculateInterest(
      loan.amount,
      loan.interestPercent,
      loan.loanDate
    )
    
    console.log('Interest calculated:', interestData)
    
    const response = {
      loan: {
        ...loan.toObject(),
        currentInterest: interestData.interestAmount,
        daysPassed: interestData.daysDifference,
        totalDue: loan.amount + interestData.interestAmount
      }
    }
    
    console.log('Sending response:', response)
    res.json(response)
    
  } catch (error) {
    console.error('Search loan error:', error)
    res.status(500).json({ message: error.message })
  }
}
