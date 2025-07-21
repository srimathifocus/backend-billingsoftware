const Loan = require('../models/Loan')
const Customer = require('../models/Customer')
const Item = require('../models/Item')
const Repayment = require('../models/Repayment')
const { generateCompactInvoice } = require('../utils/compactInvoiceGenerator')
const path = require('path')

// Compact Invoice Generation for Jewelry Shop
exports.generateCompactLoanInvoicePDF = async (req, res) => {
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
    
    // Default shop details - customize these for your jewelry shop
    const shopDetails = {
      name: "GOLDEN JEWELLERY",
      address: "123 Main Street, Jewelry District, City - 500001",
      phone: "+91 9876543210",
      email: "info@goldenjewellery.com",
      gstNo: "29ABCDE1234F1Z5",
      licenseNo: "JWL/2024/001"
    }
    
    const invoiceData = {
      type: 'loan',
      invoiceId: loan.loanId,
      date: loan.createdAt,
      customerName: loan.customerId.name,
      customerPhone: loan.customerId.phone,
      customerAddress: loan.customerId.address ? 
        `${loan.customerId.address.doorNo || ''} ${loan.customerId.address.street || ''}, ${loan.customerId.address.town || ''}, ${loan.customerId.address.district || ''} - ${loan.customerId.address.pincode || ''}`.trim() : '',
      loanAmount: loan.amount,
      interestRate: loan.interestPercent,
      validity: loan.validity,
      dueDate: loan.dueDate,
      payment: loan.payment,
      items: loan.itemIds.map(item => ({
        name: item.name,
        category: item.category,
        carat: item.carat,
        weight: item.weight,
        estimatedValue: item.estimatedValue
      })),
      shopDetails
    }
    
    const fileName = `compact_loan_invoice_${loan.loanId}.pdf`
    const filePath = path.join(__dirname, '..', 'temp', fileName)
    
    // Ensure temp directory exists
    const fs = require('fs')
    const tempDir = path.join(__dirname, '..', 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    await generateCompactInvoice(invoiceData, filePath)
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err)
        res.status(500).json({ message: 'Error generating compact invoice' })
      }
      // Clean up temp file
      fs.unlinkSync(filePath)
    })
    
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.generateCompactRepaymentInvoicePDF = async (req, res) => {
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
    
    // Default shop details - customize these for your jewelry shop
    const shopDetails = {
      name: "GOLDEN JEWELLERY",
      address: "123 Main Street, Jewelry District, City - 500001",
      phone: "+91 9876543210",
      email: "info@goldenjewellery.com",
      gstNo: "29ABCDE1234F1Z5",
      licenseNo: "JWL/2024/001"
    }
    
    const invoiceData = {
      type: 'repayment',
      invoiceId: loan.loanId,
      date: repayment.repaymentDate,
      customerName: loan.customerId.name,
      customerPhone: loan.customerId.phone,
      customerAddress: loan.customerId.address ? 
        `${loan.customerId.address.doorNo || ''} ${loan.customerId.address.street || ''}, ${loan.customerId.address.town || ''}, ${loan.customerId.address.district || ''} - ${loan.customerId.address.pincode || ''}`.trim() : '',
      loanAmount: loan.amount,
      interestRate: loan.interestPercent,
      validity: loan.validity,
      dueDate: loan.dueDate,
      repaymentDate: repayment.repaymentDate,
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
      })),
      shopDetails
    }
    
    const fileName = `compact_repayment_invoice_${loan.loanId}.pdf`
    const filePath = path.join(__dirname, '..', 'temp', fileName)
    
    // Ensure temp directory exists
    const fs = require('fs')
    const tempDir = path.join(__dirname, '..', 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    await generateCompactInvoice(invoiceData, filePath)
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err)
        res.status(500).json({ message: 'Error generating compact invoice' })
      }
      // Clean up temp file
      fs.unlinkSync(filePath)
    })
    
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}