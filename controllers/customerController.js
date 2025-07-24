const Customer = require('../models/Customer')
const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Item = require('../models/Item')
const PDFDocument = require('pdfkit')
const ShopDetails = require('../models/ShopDetails')
const CustomerEditHistory = require('../models/CustomerEditHistory')

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
        const repaidLoan = await Loan.findOne({
          customerId: customer._id,
          status: 'repaid'
        })

        let customerStatus = 'repaid' // Default to repaid if no active loans
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

    // Handle empty customer list
    if (!customers || customers.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No customers found to generate PDF' 
      })
    }

    // Get shop details
    const shopDetails = await ShopDetails.findOne({ isActive: true })

    // Create PDF with proper settings to avoid blank pages
    const doc = new PDFDocument({ 
      margin: 40,
      size: 'A4',
      bufferPages: true, // Enable buffering for proper page management
      autoFirstPage: true // Ensure first page is created properly
    })
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="customer-list.pdf"')
    
    // Pipe the PDF to response
    doc.pipe(res)

    // Helper function to add header on each page
    const addHeader = () => {
      // Add shop header with light background
      if (shopDetails) {
        // Light header background
        doc.rect(40, 40, 515, 60).fill('#f8f9fa').stroke('#e9ecef')
        
        doc.fillColor('#2c3e50')
        doc.fontSize(16).font('Helvetica-Bold').text(shopDetails.shopName, 40, 50, { 
          width: 515, 
          align: 'center' 
        })
        doc.fontSize(10).font('Helvetica').text(shopDetails.address, 40, 68, { 
          width: 515, 
          align: 'center' 
        })
        doc.text(`Ph: ${shopDetails.phone} | ${shopDetails.email}`, 40, 80, { 
          width: 515, 
          align: 'center' 
        })
        doc.text(`GST: ${shopDetails.gstNumber} | License: ${shopDetails.licenseNumber}`, 40, 92, { 
          width: 515, 
          align: 'center' 
        })
      }

      doc.moveDown(2)
      
      // Title with light background
      const titleY = doc.y
      doc.rect(40, titleY, 515, 25).fill('#e3f2fd').stroke('#2196f3')
      doc.fillColor('#1976d2')
      doc.fontSize(14).font('Helvetica-Bold').text('Customer List', 40, titleY + 8, { 
        width: 515, 
        align: 'center' 
      })
      
      doc.moveDown(2)

      // Table headers with light background
      const headerY = doc.y
      doc.rect(40, headerY, 515, 20).fill('#f5f5f5').stroke('#ddd')
      
      doc.fillColor('#333')
      doc.fontSize(9).font('Helvetica-Bold')
      
      // Column positions and widths
      const cols = {
        sno: { x: 45, width: 30 },
        name: { x: 80, width: 120 },
        phone: { x: 205, width: 85 },
        address: { x: 295, width: 180 },
        date: { x: 480, width: 70 }
      }
      
      doc.text('S.No', cols.sno.x, headerY + 6, { width: cols.sno.width, align: 'center' })
      doc.text('Name', cols.name.x, headerY + 6, { width: cols.name.width })
      doc.text('Phone', cols.phone.x, headerY + 6, { width: cols.phone.width })
      doc.text('Address', cols.address.x, headerY + 6, { width: cols.address.width })
      doc.text('Date Added', cols.date.x, headerY + 6, { width: cols.date.width, align: 'center' })
      
      return headerY + 25
    }

    // Add first page header
    let currentY = addHeader()
    doc.fillColor('#333').font('Helvetica').fontSize(8)

    // Column positions (same as header)
    const cols = {
      sno: { x: 45, width: 30 },
      name: { x: 80, width: 120 },
      phone: { x: 205, width: 85 },
      address: { x: 295, width: 180 },
      date: { x: 480, width: 70 }
    }

    let pageNumber = 1
    
    customers.forEach((customer, index) => {
      // Check if we need a new page (leave more space for footer and better page breaks)
      if (currentY > 680) {
        // Add page number to current page footer before creating new page
        doc.fillColor('#666')
        doc.fontSize(8).font('Helvetica')
        doc.text(`Page ${pageNumber}`, 500, doc.page.height - 40, { align: 'center' })
        
        doc.addPage()
        pageNumber++
        currentY = addHeader()
        doc.fillColor('#333').font('Helvetica').fontSize(8)
      }

      // Add alternating row background for better readability
      if (index % 2 === 0) {
        doc.rect(40, currentY - 2, 515, 22).fill('#fafafa') // Increased height for better spacing
      }

      // Format address with better null handling
      const addressParts = []
      if (customer.address) {
        if (customer.address.doorNo) addressParts.push(customer.address.doorNo)
        if (customer.address.street) addressParts.push(customer.address.street)
        if (customer.address.town) addressParts.push(customer.address.town)
        if (customer.address.district) addressParts.push(customer.address.district)
        if (customer.address.pincode) addressParts.push(customer.address.pincode)
      }
      
      const address = addressParts.join(', ')
      // Truncate long addresses to prevent overflow
      const truncatedAddress = address.length > 50 ? address.substring(0, 47) + '...' : address
      
      // Format date
      const formattedDate = new Date(customer.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      })

      // Add row data with proper text color
      doc.fillColor('#333')
      doc.text((index + 1).toString(), cols.sno.x, currentY + 2, { 
        width: cols.sno.width, 
        align: 'center' 
      })
      
      doc.text(customer.name || 'N/A', cols.name.x, currentY + 2, { 
        width: cols.name.width,
        ellipsis: true
      })
      
      doc.text(customer.phone || 'N/A', cols.phone.x, currentY + 2, { 
        width: cols.phone.width 
      })
      
      doc.text(truncatedAddress || 'N/A', cols.address.x, currentY + 2, { 
        width: cols.address.width,
        ellipsis: true
      })
      
      doc.text(formattedDate, cols.date.x, currentY + 2, { 
        width: cols.date.width,
        align: 'center'
      })

      // Add line between each customer for better separation with more space
      doc.strokeColor('#e0e0e0')
      doc.moveTo(40, currentY + 18).lineTo(555, currentY + 18).stroke()

      currentY += 22 // Increased spacing between rows for better readability
    })

    // Add final footer with proper page number
    const footerY = doc.page.height - 60
    doc.rect(40, footerY, 515, 30).fill('#f8f9fa').stroke('#e9ecef')
    
    doc.fillColor('#666')
    doc.fontSize(8).font('Helvetica')
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 45, footerY + 8)
    doc.text(`Total Customers: ${customers.length}`, 45, footerY + 18)
    doc.text(`Page ${pageNumber}`, 500, footerY + 13, { align: 'center' })

    // Properly end the document to prevent extra pages
    doc.flushPages()
    doc.end()
  } catch (error) {
    console.error('Error generating customer list PDF:', error)
    res.status(500).json({ message: error.message })
  }
}

// Helper function to log customer edits
const logCustomerEdit = async (customerId, editedBy, editType, changes, previousData, newData = null, reason = '', req) => {
  try {
    const editHistory = new CustomerEditHistory({
      customerId,
      editedBy,
      editType,
      changes,
      previousData,
      newData,
      reason,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    })
    await editHistory.save()
  } catch (error) {
    console.error('Error logging customer edit:', error)
  }
}

// Update customer (Admin only)
exports.updateCustomer = async (req, res) => {
  try {
    console.log('Update customer called with ID:', req.params.customerId)
    console.log('Request body:', req.body)
    console.log('User role:', req.user?.role)
    
    const { customerId } = req.params
    const { name, phone, address, nominee, reason } = req.body

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can edit customer details' 
      })
    }

    // Find the customer
    const customer = await Customer.findById(customerId)
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found' 
      })
    }

    // Store previous data for history
    const previousData = customer.toObject()

    // Check if phone number is already taken by another customer
    if (phone && phone !== customer.phone) {
      const existingCustomer = await Customer.findOne({ 
        phone, 
        _id: { $ne: customerId } 
      })
      if (existingCustomer) {
        return res.status(400).json({ 
          success: false, 
          message: 'Phone number already exists for another customer' 
        })
      }
    }

    // Update customer data
    const updateData = {}
    const changes = {}

    if (name && name !== customer.name) {
      updateData.name = name
      changes.name = { from: customer.name, to: name }
    }

    if (phone && phone !== customer.phone) {
      updateData.phone = phone
      changes.phone = { from: customer.phone, to: phone }
    }

    if (address) {
      const addressChanged = JSON.stringify(address) !== JSON.stringify(customer.address)
      if (addressChanged) {
        updateData.address = address
        changes.address = { from: customer.address, to: address }
      }
    }

    if (nominee !== undefined && nominee !== customer.nominee) {
      updateData.nominee = nominee
      changes.nominee = { from: customer.nominee, to: nominee }
    }

    // If no changes, return early
    if (Object.keys(changes).length === 0) {
      return res.json({
        success: true,
        message: 'No changes detected',
        data: customer
      })
    }

    // Update the customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true, runValidators: true }
    )

    // Log the edit
    await logCustomerEdit(
      customerId,
      req.user._id,
      'UPDATE',
      changes,
      previousData,
      updatedCustomer.toObject(),
      reason,
      req
    )

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    })

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
}

// Delete customer (Admin only)
exports.deleteCustomer = async (req, res) => {
  try {
    const { customerId } = req.params
    const { reason } = req.body

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can delete customers' 
      })
    }

    // Find the customer
    const customer = await Customer.findById(customerId)
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found' 
      })
    }

    // Check if customer has active loans
    const activeLoans = await Loan.find({ 
      customerId, 
      status: 'active' 
    })

    if (activeLoans.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete customer with active loans. Please close all loans first.' 
      })
    }

    // Store customer data for history before deletion
    const customerData = customer.toObject()

    // Get all customer loans and repayments for cleanup
    const customerLoans = await Loan.find({ customerId })
    const loanIds = customerLoans.map(loan => loan._id)

    // Delete related data
    await Repayment.deleteMany({ loanId: { $in: loanIds } })
    await Loan.deleteMany({ customerId })

    // Delete the customer
    await Customer.findByIdAndDelete(customerId)

    // Log the deletion
    await logCustomerEdit(
      customerId,
      req.user._id,
      'DELETE',
      { deleted: true },
      customerData,
      null,
      reason || 'Customer deleted',
      req
    )

    res.json({
      success: true,
      message: 'Customer and all related data deleted successfully'
    })

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
}

// Get customer edit history (Admin only)
exports.getCustomerEditHistory = async (req, res) => {
  try {
    const { customerId } = req.params
    const { page = 1, limit = 20 } = req.query

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can view edit history' 
      })
    }

    // Get edit history with user details
    const history = await CustomerEditHistory.find({ customerId })
      .populate('editedBy', 'name email role')
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))

    // Get total count
    const totalCount = await CustomerEditHistory.countDocuments({ customerId })

    res.json({
      success: true,
      data: history,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        limit: parseInt(limit)
      }
    })

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
}

// Get all edit history (Admin only)
exports.getAllEditHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50, editType, userId } = req.query

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can view edit history' 
      })
    }

    // Build query
    const query = {}
    if (editType) query.editType = editType
    if (userId) query.editedBy = userId

    // Get edit history with user and customer details
    const history = await CustomerEditHistory.find(query)
      .populate('editedBy', 'name email role')
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))

    // Get total count
    const totalCount = await CustomerEditHistory.countDocuments(query)

    res.json({
      success: true,
      data: history,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        limit: parseInt(limit)
      }
    })

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
}