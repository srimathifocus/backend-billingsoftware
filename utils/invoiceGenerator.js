const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')
const ShopDetails = require('../models/ShopDetails')

// Light and Clean Color Scheme
const colors = {
  primary: '#2563eb',      // Modern Blue
  secondary: '#3b82f6',    // Light Blue
  light: '#dbeafe',        // Very Light Blue
  white: '#FFFFFF',        // White
  black: '#1f2937',        // Dark Gray (instead of pure black)
  lightBlue: '#f0f9ff',    // Ultra light blue
  gray: '#6b7280',         // Medium Gray
  border: '#d1d5db'        // Light border
}

const generateInvoice = async (data, filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 20, // --newww: Reduced margin from 30 to 20
        size: 'A4',
        bufferPages: false,
        autoFirstPage: true,
        layout: 'portrait',
        info: {
          Title: 'Invoice',
          Author: 'Pawn Shop'
        }
      })
      
      // Override addPage to prevent additional pages - CRITICAL FIX
      const originalAddPage = doc.addPage
      doc.addPage = function(options) {
        // Block any additional page creation to ensure single page
        return this
      }

      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      // Track page creation for monitoring
      let pageCount = 0
      doc.on('pageAdded', () => {
        pageCount++
      })

      // Get shop details
      const shopDetails = await ShopDetails.findOne({ isActive: true }).catch(() => null) || {
        shopName: 'PAWN SHOP',
        address: '123 Business Street, City - 123456',
        phone: '+91 9876543210',
        gstNumber: '29ABCDE1234F1Z5',
        licenseNumber: 'PWN/2024/001'
      }
      
      // Header with dark blue background - More Compact
      const headerHeight = 45 // --newww: Reduced from 60 to 45
      doc.rect(0, 0, doc.page.width, headerHeight)
         .fill(colors.primary)
      
      // Company Name in white - Smaller
      doc.fillColor(colors.white)
         .fontSize(16) // --newww: Reduced from 18 to 16
         .font('Helvetica-Bold')
         .text(shopDetails?.shopName || 'PAWN SHOP', 30, 8, { align: 'center' })
      
      if (shopDetails) {
        doc.fontSize(7) // --newww: Reduced from 8 to 7
           .font('Helvetica')
           .text(`${shopDetails.address} | Phone: ${shopDetails.phone}`, 30, 25, { align: 'center' })
           .text(`GST: ${shopDetails.gstNumber} | License: ${shopDetails.licenseNumber}`, 30, 34, { align: 'center' })
      }

      // Reset position after header
      doc.y = headerHeight + 10 // --newww: Reduced spacing

      // Invoice Title with dark blue background - More Compact
      const titleY = doc.y
      const invoiceTitle = data.type === 'repayment' ? 'REPAYMENT INVOICE' : 'BILLING INVOICE'
      
      doc.rect(30, titleY, doc.page.width - 60, 20) // --newww: Reduced height from 25 to 20
         .fill(colors.secondary)
      
      doc.fillColor(colors.white)
         .fontSize(12) // --newww: Reduced from 14 to 12
         .font('Helvetica-Bold')
         .text(invoiceTitle, 30, titleY + 4, { // --newww: Adjusted position
           align: 'center',
           width: doc.page.width - 60
         })

      doc.y = titleY + 25 // --newww: Reduced spacing

      // Invoice details box with light blue background - More Compact
      const detailsBoxY = doc.y
      doc.rect(30, detailsBoxY, doc.page.width - 60, 28) // --newww: Reduced height from 35 to 28
         .fill(colors.lightBlue)
         .stroke(colors.primary)

      doc.fillColor(colors.primary)
         .fontSize(8) // --newww: Reduced from 10 to 8
         .font('Helvetica-Bold')
         .text(`Loan ID: ${data.loanId}`, 35, detailsBoxY + 5)
         .text(`Date: ${new Date(data.date || data.loanDate).toLocaleDateString()}`, 320, detailsBoxY + 5)

      if (data.type === 'repayment') {
        doc.text(`Repayment Date: ${new Date(data.repaymentDate).toLocaleDateString()}`, 320, detailsBoxY + 16)
        doc.text(`Status: FULLY REPAID`, 35, detailsBoxY + 16)
      } else {
        doc.text(`Due Date: ${new Date(data.dueDate).toLocaleDateString()}`, 320, detailsBoxY + 16)
        doc.text(`Status: ACTIVE LOAN`, 35, detailsBoxY + 16)
      }

      doc.y = detailsBoxY + 33 // --newww: Reduced spacing

      // Customer Details Section - More Compact
      drawSectionHeader(doc, 'CUSTOMER DETAILS')
      
      const customerBoxY = doc.y
      doc.rect(30, customerBoxY, doc.page.width - 60, 35) // --newww: Reduced height from 45 to 35
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .fontSize(8) // --newww: Reduced from 9 to 8
         .font('Helvetica')
         .text(`Name: ${data.customerName}`, 35, customerBoxY + 5)
         .text(`Phone: ${data.phone}`, 280, customerBoxY + 5)

      if (data.address) {
        const address = `${data.address.doorNo || ''} ${data.address.street || ''}, ${data.address.town || ''}, ${data.address.district || ''} - ${data.address.pincode || ''}`.trim()
        doc.text(`Address: ${address}`, 35, customerBoxY + 17, { width: doc.page.width - 80 })
      }

      doc.y = customerBoxY + 40 // --newww: Reduced spacing

      // Financial Details Section - More Compact
      drawSectionHeader(doc, data.type === 'repayment' ? 'REPAYMENT DETAILS' : 'LOAN DETAILS')
      
      const financeBoxY = doc.y
      const financeBoxHeight = data.type === 'repayment' ? 55 : 40 // --newww: Reduced heights
      
      doc.rect(30, financeBoxY, doc.page.width - 60, financeBoxHeight)
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .fontSize(8) // --newww: Reduced from 9 to 8
         .text(`Principal Amount: Rs.${data.loanAmount.toLocaleString()}`, 35, financeBoxY + 5)
         .text(`Interest Rate: ${data.interestRate}% per month`, 280, financeBoxY + 5)
         .text(`Validity Period: ${data.validity} months`, 35, financeBoxY + 15)

      if (data.type === 'repayment') {
        doc.text(`Days Elapsed: ${data.daysDifference} days`, 280, financeBoxY + 15)
           .text(`Interest Amount: Rs.${data.interestAmount.toLocaleString()}`, 35, financeBoxY + 25)
           .text(`Total Amount: Rs.${data.totalAmount.toLocaleString()}`, 280, financeBoxY + 25)
           
        // Highlight total amount - More Compact
        doc.rect(275, financeBoxY + 35, 110, 15) // --newww: Reduced size
           .fill(colors.secondary)
        
        doc.fillColor(colors.white)
           .font('Helvetica-Bold')
           .fontSize(7) // --newww: Reduced font size
           .text(`TOTAL PAID: Rs.${data.totalAmount.toLocaleString()}`, 280, financeBoxY + 40)
      }

      doc.y = financeBoxY + financeBoxHeight + 8 // --newww: Reduced spacing

      // Payment Breakdown Section - More Compact
      drawSectionHeader(doc, 'PAYMENT BREAKDOWN')
      
      const paymentBoxY = doc.y
      doc.rect(30, paymentBoxY, doc.page.width - 60, 25) // --newww: Reduced height from 35 to 25
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .fontSize(8) // --newww: Reduced from 9 to 8
         .font('Helvetica')
         .text(`Cash: Rs.${(data.payment.cash || 0).toLocaleString()}`, 35, paymentBoxY + 5)
         .text(`Online: Rs.${(data.payment.online || 0).toLocaleString()}`, 150, paymentBoxY + 5)
         .text(`Total: Rs.${((data.payment.cash || 0) + (data.payment.online || 0)).toLocaleString()}`, 280, paymentBoxY + 5)

      doc.y = paymentBoxY + 30 // --newww: Reduced spacing

      // Items Table Section - More Compact
      drawSectionHeader(doc, 'PLEDGED ITEMS')
      
      const tableY = doc.y
      const tableHeaders = ['S.No', 'Item Name', 'Category', 'Carat', 'Weight (g)', 'Value (Rs.)']
      const colWidths = [25, 90, 60, 40, 60, 65] // --newww: Adjusted column widths
      const colStartX = [30, 55, 145, 205, 245, 305]

      // Table header with dark blue background - More Compact
      doc.rect(30, tableY, doc.page.width - 60, 16) // --newww: Reduced height from 20 to 16
         .fill(colors.primary)

      doc.fillColor(colors.white)
         .fontSize(7) // --newww: Reduced from 8 to 7
         .font('Helvetica-Bold')

      tableHeaders.forEach((header, i) => {
        doc.text(header, colStartX[i], tableY + 4, { width: colWidths[i], align: 'center' })
      })

      let currentY = tableY + 16
      let totalValue = 0

      // Table rows - More Compact (Limit to 6 items max) --newww: Added item limit
      const limitedItems = data.items.slice(0, 6)
      limitedItems.forEach((item, index) => {
        const rowHeight = 12 // --newww: Reduced from 16 to 12
        
        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(30, currentY, doc.page.width - 60, rowHeight)
             .fill(colors.lightBlue)
        }

        doc.fillColor(colors.black)
           .fontSize(6) // --newww: Reduced from 7 to 6
           .font('Helvetica')

        const rowData = [
          (index + 1).toString(),
          item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name, // --newww: Shortened text
          item.category.length > 8 ? item.category.substring(0, 8) + '...' : item.category, // --newww: Shortened text
          item.carat || 'N/A',
          item.weight.toString(),
          item.estimatedValue.toLocaleString()
        ]

        rowData.forEach((data, i) => {
          doc.text(data, colStartX[i], currentY + 3, { 
            width: colWidths[i], 
            align: i === 0 || i === 4 || i === 5 ? 'center' : 'left'
          })
        })

        totalValue += item.estimatedValue
        currentY += rowHeight
      })

      // --newww: Show remaining items count if more than 6
      if (data.items.length > 6) {
        doc.fillColor(colors.gray)
           .fontSize(6)
           .text(`... and ${data.items.length - 6} more items`, 35, currentY + 2)
        currentY += 12
      }

      // Total row - More Compact
      doc.rect(30, currentY, doc.page.width - 60, 16) // --newww: Reduced height from 20 to 16
         .fill(colors.secondary)

      doc.fillColor(colors.white)
         .fontSize(8) // --newww: Reduced from 9 to 8
         .font('Helvetica-Bold')
         .text('TOTAL ESTIMATED VALUE:', colStartX[2], currentY + 4)
         .text(`Rs.${totalValue.toLocaleString()}`, colStartX[5], currentY + 4, { 
           width: colWidths[5], 
           align: 'center' 
         })

      currentY += 20 // --newww: Reduced spacing

      // Terms and Conditions Section - Much More Compact --newww: Significantly reduced
      drawSectionHeader(doc, 'TERMS & CONDITIONS', currentY)
      currentY = doc.y

      const termsBoxY = currentY
      doc.rect(30, termsBoxY, doc.page.width - 60, 30) // --newww: Reduced height from 60 to 30
         .stroke(colors.primary)

      doc.fillColor(colors.black)
         .fontSize(6) // --newww: Reduced from 7 to 6
         .font('Helvetica')
         .text('• Interest calculated monthly. Items returned upon full repayment. Default may result in auction.', 35, termsBoxY + 5, { width: doc.page.width - 80 })
         .text('• Computer generated invoice, no signature required. Contact us during business hours for queries.', 35, termsBoxY + 15, { width: doc.page.width - 80 })

      currentY = termsBoxY + 35

      // Footer - More Compact
      const footerY = doc.page.height - 30 // --newww: Reduced footer height
      doc.rect(0, footerY, doc.page.width, 30) // --newww: Reduced from 40 to 30
         .fill(colors.primary)

      doc.fillColor(colors.white)
         .fontSize(7) // --newww: Reduced from 8 to 7
         .font('Helvetica')
         .text('Thank you!', 0, footerY + 6, { 
           align: 'center',
           width: doc.page.width
         })
         .text(`Generated on: ${new Date().toLocaleString()}`, 0, footerY + 16, { 
           align: 'center',
           width: doc.page.width
         })

      // --newww: Force single page by checking if content exceeds page height
      if (currentY > doc.page.height - 60) {
        console.warn('Content may exceed single page, consider reducing font sizes or content')
      }

      // CRITICAL: End document to finalize single page
      doc.end()

      stream.on('finish', () => resolve(filePath))
      stream.on('error', reject)

    } catch (error) {
      reject(error)
    }
  })
}

// Helper function to draw section headers - More Compact --newww: Reduced sizes
function drawSectionHeader(doc, title, yPosition = null) {
  if (yPosition) doc.y = yPosition
  
  const headerY = doc.y
  doc.rect(30, headerY, doc.page.width - 60, 12) // --newww: Reduced height from 16 to 12
     .fill(colors.light)

  doc.fillColor(colors.primary)
     .fontSize(8) // --newww: Reduced from 9 to 8
     .font('Helvetica-Bold')
     .text(title, 30, headerY + 2, { // --newww: Adjusted position
       align: 'center',
       width: doc.page.width - 60
     })

  doc.y = headerY + 16 // --newww: Reduced spacing from 22 to 16
}

module.exports = { generateInvoice }