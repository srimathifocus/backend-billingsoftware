const Customer = require('../models/Customer')
const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Item = require('../models/Item')
const PDFDocument = require('pdfkit')
const ShopDetails = require('../models/ShopDetails')

exports.getAllCustomers = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query
    
    // Build search query
    const searchQuery = {}
    
    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    }

    // Get customers with basic info
    const customers = await Customer.find(searchQuery)
      .select('name phone address createdAt isActive')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))

    // Get loan status for each customer
    const customersWithStatus = await Promise.all(
      customers.map(async (customer) => {
        // Check if customer has active loans
        const activeLoan = await Loan.findOne({
          customerId: customer._id,
          status: 'active'
        })
        
        // Check if customer has any repaid loans  
        const customerLoans = await Loan.find({ customerId: customer._id })
        const loanIds = customerLoans.map(loan => loan._id)
        const repaidLoan = await Repayment.findOne({
          loanId: { $in: loanIds }
        })

        let customerStatus = 'inactive'
        if (activeLoan) {
          customerStatus = 'active'
        } else if (repaidLoan) {
          customerStatus = 'repaid'
        }

        return {
          ...customer.toObject(),
          loanStatus: customerStatus
        }
      })
    )

    // Filter by status if specified
    let filteredCustomers = customersWithStatus
    if (status && status !== 'all') {
      filteredCustomers = customersWithStatus.filter(customer => 
        customer.loanStatus === status
      )
    }

    // Get total count for pagination
    const totalCount = await Customer.countDocuments(searchQuery)

    res.json({
      success: true,
      data: filteredCustomers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCustomers: totalCount,
        limit: parseInt(limit)
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params
    
    const customer = await Customer.findById(customerId)
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' })
    }

    // Get customer loans with items
    const loans = await Loan.find({ customerId })
      .populate('itemIds', 'name category weight estimatedValue')
      .sort({ createdAt: -1 })

    // Get repayments for this customer
    const loanIds = loans.map(loan => loan._id)
    const repayments = await Repayment.find({ loanId: { $in: loanIds } })
      .populate('loanId', 'loanId')

    res.json({
      success: true,
      data: {
        customer,
        loans,
        repayments
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.getCustomerLoans = async (req, res) => {
  try {
    const { customerId } = req.params
    
    const loans = await Loan.find({ customerId })
      .populate('itemIds', 'name category weight estimatedValue')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: loans
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.getCustomerInvoices = async (req, res) => {
  try {
    const { customerId } = req.params
    
    // Get all loans for this customer
    const loans = await Loan.find({ customerId })
      .populate('customerId', 'name phone')
      .populate('itemIds', 'name category weight estimatedValue')
      .sort({ createdAt: -1 })

    // Get repayments for these loans
    const loanIds = loans.map(loan => loan._id)
    const repayments = await Repayment.find({ loanId: { $in: loanIds } })
      .populate('loanId', 'loanId')

    // Create invoice data structure
    const invoices = loans.map(loan => {
      const repayment = repayments.find(r => r.loanId._id.toString() === loan._id.toString())
      
      return {
        loanId: loan.loanId,
        loanObjectId: loan._id,
        customerName: loan.customerId.name,
        customerPhone: loan.customerId.phone,
        loanAmount: loan.amount,
        loanDate: loan.createdAt,
        status: loan.status,
        billingInvoiceAvailable: true,
        repaymentInvoiceAvailable: !!repayment,
        repaymentDate: repayment ? repayment.repaymentDate : null,
        totalAmount: repayment ? repayment.totalAmount : null,
        items: loan.itemIds
      }
    })

    res.json({
      success: true,
      data: invoices
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.printCustomerList = async (req, res) => {
  try {
    const customers = await Customer.find()
      .select('name phone address createdAt')
      .sort({ createdAt: -1 })

    // Get shop details
    const shopDetails = await ShopDetails.findOne({ isActive: true })

    // Create PDF
    const doc = new PDFDocument({ margin: 50 })
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="customer-list.pdf"')
    
    // Pipe the PDF to response
    doc.pipe(res)

    // Add shop header
    if (shopDetails) {
      doc.fontSize(18).font('Helvetica-Bold').text(shopDetails.shopName, { align: 'center' })
      doc.fontSize(12).font('Helvetica').text(shopDetails.address, { align: 'center' })
      doc.text(`Ph: ${shopDetails.phone} | ${shopDetails.email}`, { align: 'center' })
      doc.text(`GST: ${shopDetails.gstNumber} | License: ${shopDetails.licenseNumber}`, { align: 'center' })
      doc.text(`Location: ${shopDetails.location}`, { align: 'center' })
    }

    doc.moveDown(2)
    doc.fontSize(16).font('Helvetica-Bold').text('Customer List', { align: 'center' })
    doc.moveDown()

    // Table headers
    const startY = doc.y
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('S.No', 50, startY, { width: 40 })
    doc.text('Name', 90, startY, { width: 120 })
    doc.text('Phone', 210, startY, { width: 80 })
    doc.text('Address', 290, startY, { width: 200 })
    doc.text('Date Added', 490, startY, { width: 80 })

    // Draw line under headers
    doc.moveTo(50, startY + 15).lineTo(570, startY + 15).stroke()

    let currentY = startY + 25
    doc.font('Helvetica')

    customers.forEach((customer, index) => {
      if (currentY > 750) { // Start new page if needed
        doc.addPage()
        currentY = 50
      }

      const address = [
        customer.address.doorNo,
        customer.address.street,
        customer.address.town,
        customer.address.district,
        customer.address.pincode
      ].filter(Boolean).join(', ')

      doc.text((index + 1).toString(), 50, currentY, { width: 40 })
      doc.text(customer.name, 90, currentY, { width: 120 })
      doc.text(customer.phone, 210, currentY, { width: 80 })
      doc.text(address, 290, currentY, { width: 200 })
      doc.text(new Date(customer.createdAt).toLocaleDateString(), 490, currentY, { width: 80 })

      currentY += 20
    })

    // Add footer
    doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, 50, doc.page.height - 50)
    doc.text(`Total Customers: ${customers.length}`, 400, doc.page.height - 50)

    doc.end()
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}