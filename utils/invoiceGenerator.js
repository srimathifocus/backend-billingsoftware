const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')
const ShopDetails = require('../models/ShopDetails')

// Dark Blue and White Color Scheme
const colors = {
  primary: '#00008B',      // Dark Blue
  secondary: '#1E3A8A',    // Medium Dark Blue
  light: '#3B82F6',        // Light Blue
  white: '#FFFFFF',        // White
  black: '#000000',        // Black
  lightBlue: '#EBF8FF',    // Very light blue
  gray: '#64748B'          // Blue-gray
}

const generateInvoice = async (data, filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4'
      })

      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      // Get shop details
      const shopDetails = await ShopDetails.findOne({ isActive: true })
      
      // Header with dark blue background
      const headerHeight = 80
      doc.rect(0, 0, doc.page.width, headerHeight)
         .fill(colors.primary)
      
      // Company Name in white
      doc.fillColor(colors.white)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(shopDetails?.shopName || 'PAWN SHOP', 50, 25, { align: 'center' })
      
      if (shopDetails) {
        doc.fontSize(10)
           .font('Helvetica')
           .text(`${shopDetails.address} | Phone: ${shopDetails.phone}`, 50, 50, { align: 'center' })
           .text(`GST: ${shopDetails.gstNumber} | License: ${shopDetails.licenseNumber}`, 50, 62, { align: 'center' })
      }

      // Reset position after header
      doc.y = headerHeight + 20

      // Invoice Title with dark blue background
      const titleY = doc.y
      const invoiceTitle = data.type === 'repayment' ? 'REPAYMENT INVOICE' : 'BILLING INVOICE'
      
      doc.rect(50, titleY, doc.page.width - 100, 30)
         .fill(colors.secondary)
      
      doc.fillColor(colors.white)
         .fontSize(18)
         .font('Helvetica-Bold')
         .text(invoiceTitle, 50, titleY + 8, { 
           align: 'center',
           width: doc.page.width - 100
         })

      doc.y = titleY + 50

      // Invoice details box with light blue background
      const detailsBoxY = doc.y
      doc.rect(50, detailsBoxY, doc.page.width - 100, 45)
         .fill(colors.lightBlue)
         .stroke(colors.primary)

      doc.fillColor(colors.primary)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(`Loan ID: ${data.loanId}`, 60, detailsBoxY + 10)
         .text(`Date: ${new Date(data.date || data.loanDate).toLocaleDateString()}`, 400, detailsBoxY + 10)

      if (data.type === 'repayment') {
        doc.text(`Repayment Date: ${new Date(data.repaymentDate).toLocaleDateString()}`, 400, detailsBoxY + 25)
        doc.text(`Status: FULLY REPAID`, 60, detailsBoxY + 25)
      } else {
        doc.text(`Due Date: ${new Date(data.dueDate).toLocaleDateString()}`, 400, detailsBoxY + 25)
        doc.text(`Status: ACTIVE LOAN`, 60, detailsBoxY + 25)
      }

      doc.y = detailsBoxY + 65

      // Customer Details Section
      drawSectionHeader(doc, 'CUSTOMER DETAILS')
      
      const customerBoxY = doc.y
      doc.rect(50, customerBoxY, doc.page.width - 100, 60)
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .fontSize(11)
         .font('Helvetica')
         .text(`Name: ${data.customerName}`, 60, customerBoxY + 10)
         .text(`Phone: ${data.phone}`, 60, customerBoxY + 25)

      if (data.address) {
        const address = `${data.address.doorNo || ''} ${data.address.street || ''}, ${data.address.town || ''}, ${data.address.district || ''} - ${data.address.pincode || ''}`.trim()
        doc.text(`Address: ${address}`, 60, customerBoxY + 40)
      }

      doc.y = customerBoxY + 75

      // Financial Details Section
      drawSectionHeader(doc, data.type === 'repayment' ? 'REPAYMENT DETAILS' : 'LOAN DETAILS')
      
      const financeBoxY = doc.y
      const financeBoxHeight = data.type === 'repayment' ? 100 : 80
      
      doc.rect(50, financeBoxY, doc.page.width - 100, financeBoxHeight)
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .fontSize(11)
         .text(`Principal Amount: ₹${data.loanAmount.toLocaleString()}`, 60, financeBoxY + 10)
         .text(`Interest Rate: ${data.interestRate}% per month`, 300, financeBoxY + 10)
         .text(`Validity Period: ${data.validity} months`, 60, financeBoxY + 25)

      if (data.type === 'repayment') {
        doc.text(`Days Elapsed: ${data.daysDifference} days`, 300, financeBoxY + 25)
           .text(`Interest Amount: ₹${data.interestAmount.toLocaleString()}`, 60, financeBoxY + 40)
           .text(`Total Amount: ₹${data.totalAmount.toLocaleString()}`, 300, financeBoxY + 40)
           
        // Highlight total amount
        doc.rect(295, financeBoxY + 55, 150, 20)
           .fill(colors.secondary)
        
        doc.fillColor(colors.white)
           .font('Helvetica-Bold')
           .text(`TOTAL PAID: ₹${data.totalAmount.toLocaleString()}`, 300, financeBoxY + 60)
      }

      doc.y = financeBoxY + financeBoxHeight + 15

      // Payment Breakdown Section
      drawSectionHeader(doc, 'PAYMENT BREAKDOWN')
      
      const paymentBoxY = doc.y
      doc.rect(50, paymentBoxY, doc.page.width - 100, 45)
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .font('Helvetica')
         .text(`Cash Payment: ₹${(data.payment.cash || 0).toLocaleString()}`, 60, paymentBoxY + 10)
         .text(`Online Payment: ₹${(data.payment.online || 0).toLocaleString()}`, 300, paymentBoxY + 10)
         .text(`Total Payment: ₹${((data.payment.cash || 0) + (data.payment.online || 0)).toLocaleString()}`, 60, paymentBoxY + 25)

      doc.y = paymentBoxY + 60

      // Items Table Section
      drawSectionHeader(doc, 'PLEDGED ITEMS')
      
      const tableY = doc.y
      const tableHeaders = ['S.No', 'Item Name', 'Category', 'Carat', 'Weight (g)', 'Value (₹)']
      const colWidths = [40, 120, 80, 60, 80, 80]
      const colStartX = [50, 90, 210, 290, 350, 430]

      // Table header with dark blue background
      doc.rect(50, tableY, doc.page.width - 100, 25)
         .fill(colors.primary)

      doc.fillColor(colors.white)
         .fontSize(10)
         .font('Helvetica-Bold')

      tableHeaders.forEach((header, i) => {
        doc.text(header, colStartX[i], tableY + 8, { width: colWidths[i], align: 'center' })
      })

      let currentY = tableY + 25
      let totalValue = 0

      // Table rows
      data.items.forEach((item, index) => {
        const rowHeight = 20
        
        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(50, currentY, doc.page.width - 100, rowHeight)
             .fill(colors.lightBlue)
        }

        doc.fillColor(colors.black)
           .fontSize(9)
           .font('Helvetica')

        const rowData = [
          (index + 1).toString(),
          item.name,
          item.category,
          item.carat || 'N/A',
          item.weight.toString(),
          item.estimatedValue.toLocaleString()
        ]

        rowData.forEach((data, i) => {
          doc.text(data, colStartX[i], currentY + 6, { 
            width: colWidths[i], 
            align: i === 0 || i === 4 || i === 5 ? 'center' : 'left'
          })
        })

        totalValue += item.estimatedValue
        currentY += rowHeight
      })

      // Total row
      doc.rect(50, currentY, doc.page.width - 100, 25)
         .fill(colors.secondary)

      doc.fillColor(colors.white)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('TOTAL ESTIMATED VALUE:', colStartX[3], currentY + 8)
         .text(`₹${totalValue.toLocaleString()}`, colStartX[5], currentY + 8, { 
           width: colWidths[5], 
           align: 'center' 
         })

      currentY += 40

      // Terms and Conditions Section
      if (currentY > doc.page.height - 150) {
        doc.addPage()
        currentY = 50
      }

      drawSectionHeader(doc, 'TERMS & CONDITIONS', currentY)
      currentY = doc.y

      const termsBoxY = currentY
      doc.rect(50, termsBoxY, doc.page.width - 100, 90)
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .fontSize(9)
         .font('Helvetica')
         .text('• Interest is calculated monthly from the loan date.', 60, termsBoxY + 10)
         .text('• Items will be returned upon full repayment of principal and interest amount.', 60, termsBoxY + 25)
         .text('• In case of default after due date, items may be auctioned as per government regulations.', 60, termsBoxY + 40)
         .text('• This invoice is computer generated and does not require physical signature.', 60, termsBoxY + 55)
         .text('• For any queries, please contact us during business hours.', 60, termsBoxY + 70)

      // Footer
      const footerY = doc.page.height - 50
      doc.rect(0, footerY, doc.page.width, 50)
         .fill(colors.primary)

      doc.fillColor(colors.white)
         .fontSize(10)
         .font('Helvetica')
         .text('Thank you for your business!', 0, footerY + 15, { 
           align: 'center',
           width: doc.page.width
         })
         .text(`Generated on: ${new Date().toLocaleString()}`, 0, footerY + 30, { 
           align: 'center',
           width: doc.page.width
         })

      doc.end()

      stream.on('finish', () => resolve(filePath))
      stream.on('error', reject)

    } catch (error) {
      reject(error)
    }
  })
}

// Helper function to draw section headers
function drawSectionHeader(doc, title, yPosition = null) {
  if (yPosition) doc.y = yPosition
  
  const headerY = doc.y
  doc.rect(50, headerY, doc.page.width - 100, 20)
     .fill(colors.light)

  doc.fillColor(colors.white)
     .fontSize(12)
     .font('Helvetica-Bold')
     .text(title, 50, headerY + 6, { 
       align: 'center',
       width: doc.page.width - 100
     })

  doc.y = headerY + 30
}

module.exports = { generateInvoice }