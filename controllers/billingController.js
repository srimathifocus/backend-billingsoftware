const Customer = require('../models/Customer')
const Item = require('../models/Item')
const Loan = require('../models/Loan')
const BillingRecord = require('../models/BillingRecord')
const Transaction = require('../models/transactionsModel')
const { generateLoanId } = require('./loanController')

exports.createBilling = async (req, res) => {
  try {
    const { customer, items, loan, payment } = req.body
    
    // Validate required fields
    if (!customer || !items || !loan || !payment) {
      return res.status(400).json({ 
        message: 'All fields are required',
        error: 'VALIDATION_ERROR'
      })
    }

    // Validate customer fields
    if (!customer.name || !customer.phone || !customer.address || !customer.nominee) {
      return res.status(400).json({ 
        message: 'Customer name, phone, address, and nominee are required',
        error: 'VALIDATION_ERROR'
      })
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        message: 'At least one item is required',
        error: 'VALIDATION_ERROR'
      })
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.name || !item.category || !item.weight || !item.estimatedValue) {
        return res.status(400).json({ 
          message: `Item ${i + 1}: name, category, weight, and estimated value are required`,
          error: 'VALIDATION_ERROR'
        })
      }
      if (item.weight <= 0 || item.estimatedValue <= 0) {
        return res.status(400).json({ 
          message: `Item ${i + 1}: weight and estimated value must be greater than 0`,
          error: 'VALIDATION_ERROR'
        })
      }
    }

    // Validate loan fields
    if (!loan.amount || !loan.interestPercent || !loan.validity) {
      return res.status(400).json({ 
        message: 'Loan amount, interest percent, and validity are required',
        error: 'VALIDATION_ERROR'
      })
    }

    if (loan.amount <= 0 || loan.interestPercent <= 0) {
      return res.status(400).json({ 
        message: 'Loan amount and interest percent must be greater than 0',
        error: 'VALIDATION_ERROR'
      })
    }

    // Validate payment
    const totalPayment = (payment.cash || 0) + (payment.online || 0)
    if (totalPayment > loan.amount) {
      return res.status(400).json({ 
        message: 'Total payment cannot exceed loan amount',
        error: 'VALIDATION_ERROR'
      })
    }
    
    // Check if customer already exists
    let existingCustomer = await Customer.findOne({ phone: customer.phone })
    let createdCustomer
    
    if (existingCustomer) {
      createdCustomer = existingCustomer
    } else {
      createdCustomer = await Customer.create(customer)
    }
    
    // Generate unique loan ID
    const loanId = await generateLoanId()
    
    // Generate unique item codes for billing items
    const generateUniqueItemCode = async (baseCode, index) => {
      const timestamp = Date.now()
      const uniqueCode = `${baseCode}_${timestamp}_${index}`
      
      // Check if code already exists
      const existingItem = await Item.findOne({ code: uniqueCode })
      if (existingItem) {
        // If still exists, add random suffix
        return `${uniqueCode}_${Math.random().toString(36).substr(2, 5)}`
      }
      return uniqueCode
    }

    // Create items with unique codes
    const itemsWithUniqueCodes = await Promise.all(
      items.map(async (item, index) => ({
        ...item,
        code: await generateUniqueItemCode(item.code || 'ITEM', index),
        loanId: null, // Will be updated after loan creation
        status: 'pledged',
        itemType: 'billing'
      }))
    )

    const createdItems = await Item.insertMany(itemsWithUniqueCodes)
    
    const itemIds = createdItems.map(i => i._id)
    
    // Calculate due date based on validity
    const dueDate = new Date()
    const validityMonths = parseInt(loan.validity)
    dueDate.setMonth(dueDate.getMonth() + validityMonths)
    
    // Create loan
    const createdLoan = await Loan.create({
      loanId,
      customerId: createdCustomer._id,
      itemIds,
      amount: loan.amount,
      interestType: loan.interestType || 'monthly',
      interestPercent: loan.interestPercent,
      validity: loan.validity,
      dueDate,
      payment: {
        cash: payment.cash || 0,
        online: payment.online || 0
      }
    })
    
    // Update items with loan reference
    await Item.updateMany(
      { _id: { $in: itemIds } },
      { loanId: createdLoan._id }
    )
    
    // Create billing record
    const billingRecord = await BillingRecord.create({
      customer: createdCustomer,
      items: createdItems,
      loan: createdLoan
    })
    
    // Create transaction records
    if (payment.cash > 0) {
      await Transaction.create({
        loanId: createdLoan._id,
        type: 'billing',
        mode: 'cash',
        amount: payment.cash,
        date: new Date()
      })
    }
    
    if (payment.online > 0) {
      await Transaction.create({
        loanId: createdLoan._id,
        type: 'billing',
        mode: 'online',
        amount: payment.online,
        date: new Date()
      })
    }
    
    res.status(201).json({
      success: true,
      message: 'Billing created successfully',
      data: {
        loanId: createdLoan.loanId,
        customerId: createdCustomer._id,
        billingRecord
      }
    })
    
  } catch (error) {
    console.error('Billing creation error:', error)
    console.error('Error stack:', error.stack)
    console.error('Request body:', req.body)
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      const value = error.keyValue[field]
      return res.status(400).json({ 
        message: `Duplicate ${field}: ${value} already exists`,
        error: 'DUPLICATE_KEY_ERROR'
      })
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message)
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: validationErrors,
        error: 'VALIDATION_ERROR'
      })
    }
    
    // Handle cast errors (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: `Invalid ${error.path}: ${error.value}`,
        error: 'CAST_ERROR'
      })
    }
    
    // Generic server error
    res.status(500).json({ 
      message: 'Internal server error occurred while creating billing',
      error: 'INTERNAL_SERVER_ERROR'
    })
  }
}

exports.getBillingStats = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const loans = await Loan.find({
      createdAt: { $gte: today, $lt: tomorrow }
    })
    
    const totalLoanAmount = loans.reduce((sum, l) => sum + l.amount, 0)
    const totalCash = loans.reduce((sum, l) => sum + (l.payment.cash || 0), 0)
    const totalOnline = loans.reduce((sum, l) => sum + (l.payment.online || 0), 0)
    
    res.json({
      totalLoanAmount,
      totalCash,
      totalOnline,
      totalLoans: loans.length
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
} 
