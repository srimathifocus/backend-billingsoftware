const Loan = require('../models/Loan')
const Customer = require('../models/Customer')
const Item = require('../models/Item')
const Repayment = require('../models/Repayment')
const { generateInvoice } = require('../utils/invoiceGenerator')
const { generateCompactInvoice } = require('../utils/compactInvoiceGenerator')
const path = require('path')
const fs = require('fs')

exports.getLoanInvoice = async (req, res) => {
  try {
    const { loanId } = req.params
    
    const loan = await Loan.findOne({
      $or: [{ _id: loanId }, { loanId: loanId }]
    })
    .populate('customerId')
    .populate('itemIds')
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' })
    }
    
    res.json({ 
      customer: loan.customerId, 
      items: loan.itemIds, 
      loan 
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.getRepaymentInvoice = async (req, res) => {
  try {
    const { loanId } = req.params
    
    const repayment = await Repayment.findOne({ loanId })
      .populate({ 
        path: 'loanId', 
        populate: [
          { path: 'customerId' },
          { path: 'itemIds' }
        ]
      })
    
    if (!repayment) {
      return res.status(404).json({ message: 'Repayment not found' })
    }
    
    const { loanId: loan } = repayment
    res.json({ 
      customer: loan.customerId, 
      items: loan.itemIds, 
      loan, 
      repayment 
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.generateLoanInvoicePDF = async (req, res) => {
  try {
    const { loanId } = req.params
    
    const loan = await Loan.findOne({
      $or: [{ _id: loanId }, { loanId: loanId }]
    })
    .populate('customerId')
    .populate('itemIds')
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' })
    }
    
    const invoiceData = {
      loanId: loan.loanId,
      customerName: loan.customerId.name,
      phone: loan.customerId.phone,
      address: loan.customerId.address,
      loanAmount: loan.amount,
      interestRate: loan.interestPercent,
      validity: loan.validity,
      date: loan.createdAt,
      dueDate: loan.dueDate,
      payment: loan.payment,
      items: loan.itemIds.map(item => ({
        name: item.name,
        category: item.category,
        carat: item.carat,
        weight: item.weight,
        estimatedValue: item.estimatedValue
      }))
    }
    
    const fileName = `loan_invoice_${loan.loanId}.pdf`
    const filePath = path.join(__dirname, '..', 'temp', fileName)
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    await generateInvoice(invoiceData, filePath)
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err)
        res.status(500).json({ message: 'Error generating invoice' })
      }
      // Clean up temp file
      fs.unlinkSync(filePath)
    })
    
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.generateRepaymentInvoicePDF = async (req, res) => {
  try {
    const { loanId } = req.params
    
    const repayment = await Repayment.findOne({ loanId })
      .populate({ 
        path: 'loanId', 
        populate: [
          { path: 'customerId' },
          { path: 'itemIds' }
        ]
      })
    
    if (!repayment) {
      return res.status(404).json({ message: 'Repayment not found' })
    }
    
    const { loanId: loan } = repayment
    
    const invoiceData = {
      type: 'repayment',
      loanId: loan.loanId,
      customerName: loan.customerId.name,
      phone: loan.customerId.phone,
      address: loan.customerId.address,
      loanAmount: loan.amount,
      interestRate: loan.interestPercent,
      validity: loan.validity,
      loanDate: loan.createdAt,
      repaymentDate: repayment.repaymentDate,
      dueDate: loan.dueDate,
      principalAmount: repayment.principalAmount,
      interestAmount: repayment.interestAmount,
      totalAmount: repayment.totalAmount,
      daysDifference: repayment.daysDifference,
      payment: repayment.payment,
      items: loan.itemIds.map(item => ({
        name: item.name,
        category: item.category,
        carat: item.carat,
        weight: item.weight,
        estimatedValue: item.estimatedValue
      }))
    }
    
    const fileName = `repayment_invoice_${loan.loanId}.pdf`
    const filePath = path.join(__dirname, '..', 'temp', fileName)
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    await generateInvoice(invoiceData, filePath)
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err)
        res.status(500).json({ message: 'Error generating invoice' })
      }
      // Clean up temp file
      fs.unlinkSync(filePath)
    })
    
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Print loan invoice (for browser printing)
exports.printLoanInvoice = async (req, res) => {
  try {
    const { loanId } = req.params
    
    const loan = await Loan.findOne({
      $or: [{ _id: loanId }, { loanId: loanId }]
    })
    .populate('customerId')
    .populate('itemIds')
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' })
    }
    
    const invoiceData = {
      loanId: loan.loanId,
      customerName: loan.customerId.name,
      phone: loan.customerId.phone,
      address: loan.customerId.address,
      loanAmount: loan.amount,
      interestRate: loan.interestPercent,
      validity: loan.validity,
      date: loan.createdAt,
      dueDate: loan.dueDate,
      payment: loan.payment,
      items: loan.itemIds.map(item => ({
        name: item.name,
        category: item.category,
        carat: item.carat,
        weight: item.weight,
        estimatedValue: item.estimatedValue
      }))
    }
    
    const fileName = `loan_invoice_${loan.loanId}.pdf`
    const filePath = path.join(__dirname, '..', 'temp', fileName)
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    await generateInvoice(invoiceData, filePath)
    
    // Set headers for PDF viewing in browser (for printing)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"')
    
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
    
    fileStream.on('end', () => {
      // Clean up temp file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath)
        } catch (e) {
          console.log('Error cleaning temp file:', e.message)
        }
      }, 5000)
    })
    
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Print repayment invoice (for browser printing)
exports.printRepaymentInvoice = async (req, res) => {
  try {
    const { loanId } = req.params
    
    const repayment = await Repayment.findOne({ loanId })
      .populate({ 
        path: 'loanId', 
        populate: [
          { path: 'customerId' },
          { path: 'itemIds' }
        ]
      })
    
    if (!repayment) {
      return res.status(404).json({ message: 'Repayment not found' })
    }
    
    const { loanId: loan } = repayment
    
    const invoiceData = {
      type: 'repayment',
      loanId: loan.loanId,
      customerName: loan.customerId.name,
      phone: loan.customerId.phone,
      address: loan.customerId.address,
      loanAmount: loan.amount,
      interestRate: loan.interestPercent,
      validity: loan.validity,
      loanDate: loan.createdAt,
      repaymentDate: repayment.repaymentDate,
      dueDate: loan.dueDate,
      principalAmount: repayment.principalAmount,
      interestAmount: repayment.interestAmount,
      totalAmount: repayment.totalAmount,
      daysDifference: repayment.daysDifference,
      payment: repayment.payment,
      items: loan.itemIds.map(item => ({
        name: item.name,
        category: item.category,
        carat: item.carat,
        weight: item.weight,
        estimatedValue: item.estimatedValue
      }))
    }
    
    const fileName = `repayment_invoice_${loan.loanId}.pdf`
    const filePath = path.join(__dirname, '..', 'temp', fileName)
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    await generateInvoice(invoiceData, filePath)
    
    // Set headers for PDF viewing in browser (for printing)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"')
    
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
    
    fileStream.on('end', () => {
      // Clean up temp file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath)
        } catch (e) {
          console.log('Error cleaning temp file:', e.message)
        }
      }, 5000)
    })
    
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}