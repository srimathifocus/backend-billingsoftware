const { generateInvoice } = require('./utils/invoiceGenerator')
const { generateCompactInvoice } = require('./utils/compactInvoiceGenerator')
const path = require('path')

// Sample data for testing invoice generation
const sampleData = {
  type: 'loan',
  loanId: 'LN250807005',
  date: new Date(),
  loanDate: new Date(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  customerName: 'Test Customer',
  phone: '+91 9876543210',
  address: {
    doorNo: '123',
    street: 'Main Street',
    town: 'Chennai',
    district: 'Chennai',
    pincode: '600001'
  },
  loanAmount: 50000,
  interestRate: 2.5,
  validity: 12,
  items: [
    {
      name: 'Gold Ring',
      category: 'Ring',
      carat: '22K',
      weight: 10,
      estimatedValue: 30000
    },
    {
      name: 'Gold Chain',
      category: 'Chain',
      carat: '18K', 
      weight: 15,
      estimatedValue: 25000
    }
  ],
  payment: {
    cash: 30000,
    online: 20000
  }
}

// Sample repayment data
const sampleRepaymentData = {
  ...sampleData,
  type: 'repayment',
  repaymentDate: new Date(),
  daysDifference: 45,
  interestAmount: 5625, // 2.5% * 1.5 months * 50000
  totalAmount: 55625
}

async function testInvoices() {
  try {
    console.log('🧪 Testing invoice generation with Rs. currency...')
    
    // Test regular loan invoice
    const regularInvoicePath = path.join(__dirname, 'temp', 'test_loan_invoice_rs.pdf')
    await generateInvoice(sampleData, regularInvoicePath)
    console.log('✅ Regular loan invoice generated:', regularInvoicePath)
    
    // Test repayment invoice
    const repaymentInvoicePath = path.join(__dirname, 'temp', 'test_repayment_invoice_rs.pdf')
    await generateInvoice(sampleRepaymentData, repaymentInvoicePath)
    console.log('✅ Repayment invoice generated:', repaymentInvoicePath)
    
    // Test compact loan invoice
    const compactData = {
      ...sampleData,
      invoiceId: 'INV250807005',
      shopDetails: {
        name: 'Test Pawn Shop',
        address: '456 Business Street, Chennai - 600002',
        phone: '+91 9876543210',
        email: 'test@pawnshop.com',
        gstNo: '33ABCDE1234F1Z5',
        licenseNo: 'PWN/2024/001'
      },
      customerAddress: '123 Main Street, Chennai - 600001'
    }
    
    const compactInvoicePath = path.join(__dirname, 'temp', 'test_compact_invoice_rs.pdf')
    await generateCompactInvoice(compactData, compactInvoicePath)
    console.log('✅ Compact invoice generated:', compactInvoicePath)
    
    // Test compact repayment invoice
    const compactRepaymentData = {
      ...compactData,
      ...sampleRepaymentData
    }
    
    const compactRepaymentPath = path.join(__dirname, 'temp', 'test_compact_repayment_rs.pdf')
    await generateCompactInvoice(compactRepaymentData, compactRepaymentPath)
    console.log('✅ Compact repayment invoice generated:', compactRepaymentPath)
    
    console.log('🎉 All invoices generated successfully with Rs. currency!')
    console.log('📁 Check the temp/ folder for generated PDFs')
    
  } catch (error) {
    console.error('❌ Error testing invoices:', error)
  }
}

// Run the test
testInvoices()