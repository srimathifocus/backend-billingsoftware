const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')
const ShopDetails = require('../models/ShopDetails')
const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Transaction = require('../models/transactionsModel')
const moment = require('moment')

// Professional color scheme
const colors = {
  primary: '#1a365d',      // Dark blue
  secondary: '#2d3748',    // Dark gray
  accent: '#3182ce',       // Blue
  text: '#2d3748',         // Dark gray
  lightGray: '#f7fafc',    // Very light gray
  border: '#e2e8f0'        // Light gray
}

const generateAuditReportPDF = async (auditData, filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 25, // Minimal margin for maximum content
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: auditData.title,
          Author: auditData.preparedBy,
          Subject: 'Audit Report',
          Keywords: 'audit, financial, report'
        }
      })

      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      // Get shop details (if not provided in auditData)
      let shopDetails = auditData.shopDetails
      if (!shopDetails) {
        try {
          shopDetails = await ShopDetails.findOne({ isActive: true })
        } catch (error) {
          console.log('Could not fetch shop details from database, using default values')
          shopDetails = {
            shopName: 'Test Shop',
            location: 'Test Location',
            licenseNumber: 'TEST123'
          }
        }
      }
      
      // Page dimensions - optimized for maximum content
      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 25
      const contentWidth = pageWidth - (margin * 2)
      const usableHeight = pageHeight - (margin * 2) // Maximum usable height
      
      let currentY = margin

      // Helper functions with strict space management
      const checkPageSpace = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          doc.addPage()
          currentY = margin
          return true
        }
        return false
      }

      const addTitle = (text, fontSize = 15, color = colors.primary) => {
        checkPageSpace(fontSize + 5)
        doc.fillColor(color)
           .fontSize(fontSize)
           .font('Helvetica-Bold')
           .text(text, margin, currentY, { align: 'center', width: contentWidth })
        currentY += fontSize + 5
      }

      const addSectionHeader = (text, fontSize = 12) => {
        checkPageSpace(fontSize + 10)
        
        doc.fillColor(colors.primary)
           .fontSize(fontSize)
           .font('Helvetica-Bold')
           .text(text, margin, currentY)
        
        // Add underline
        doc.moveTo(margin, currentY + fontSize + 1)
           .lineTo(pageWidth - margin, currentY + fontSize + 1)
           .strokeColor(colors.border)
           .stroke()
        
        currentY += fontSize + 5 // Minimal spacing
      }

      const addText = (text, fontSize = 12, options = {}) => {
        const font = options.bold ? 'Helvetica-Bold' : 'Helvetica'
        const color = options.color || colors.text
        const indent = options.indent || 0
        
        checkPageSpace(fontSize + 2)
        
        doc.fillColor(color)
           .fontSize(fontSize)
           .font(font)
           .text(text, margin + indent, currentY, { 
             width: contentWidth - indent,
             align: options.align || 'left'
           })
        
        currentY += fontSize + 2 // Minimal spacing
      }

      const addTable = (headers, rows, options = {}) => {
        if (!rows || rows.length === 0) return
        
        const tableWidth = contentWidth
        const colWidth = tableWidth / headers.length
        const baseRowHeight = 20 // Base height for single line
        const headerHeight = 22 // Increased for 12pt font
        
        // Helper function to calculate required height for text
        const calculateTextHeight = (text, width, fontSize = 12) => {
          const textWidth = doc.widthOfString(text, { fontSize })
          const lines = Math.ceil(textWidth / (width - 6)) // 6px padding
          // Limit to maximum 3 lines to prevent excessive row height
          const maxLines = 3
          const actualLines = Math.min(lines, maxLines)
          return Math.max(baseRowHeight, actualLines * (fontSize + 4)) // 4px line spacing
        }
        
        // Helper function to truncate long text if needed
        const truncateText = (text, width, fontSize = 12) => {
          const maxWidth = width - 6 // Account for padding
          if (doc.widthOfString(text, { fontSize }) <= maxWidth * 2.5) { // Allow up to 2.5 lines
            return text
          }
          
          // Truncate and add ellipsis
          let truncated = text
          while (doc.widthOfString(truncated + '...', { fontSize }) > maxWidth * 2.5 && truncated.length > 0) {
            truncated = truncated.slice(0, -1)
          }
          return truncated + '...'
        }
        
        // Calculate dynamic row heights
        const rowHeights = rows.map(row => {
          let maxHeight = baseRowHeight
          row.forEach((cell, colIndex) => {
            const cellHeight = calculateTextHeight(cell.toString(), colWidth, 12)
            maxHeight = Math.max(maxHeight, cellHeight)
          })
          return maxHeight
        })
        
        // Calculate total table height with dynamic heights
        const totalTableHeight = headerHeight + rowHeights.reduce((sum, height) => sum + height, 0)
        
        // Check if entire table fits on current page
        if (currentY + totalTableHeight > pageHeight - margin) {
          doc.addPage()
          currentY = margin
        }
        
        // Draw table header
        doc.rect(margin, currentY, tableWidth, headerHeight)
           .fillAndStroke(colors.lightGray, colors.border)
        
        doc.fillColor(colors.text)
           .fontSize(12) // 12pt font as requested
           .font('Helvetica-Bold')
        
        headers.forEach((header, i) => {
          const x = margin + (i * colWidth) + 3
          doc.text(header, x, currentY + 5, { 
            width: colWidth - 6, 
            align: 'center' 
          })
        })
        
        currentY += headerHeight
        
        // Draw all table rows with dynamic heights
        doc.font('Helvetica')
        rows.forEach((row, rowIndex) => {
          const currentRowHeight = rowHeights[rowIndex]
          
          // If we're running out of space, move entire remaining table to next page
          if (currentY + currentRowHeight > pageHeight - margin) {
            doc.addPage()
            currentY = margin
            
            // Redraw header on new page
            doc.rect(margin, currentY, tableWidth, headerHeight)
               .fillAndStroke(colors.lightGray, colors.border)
            
            doc.fillColor(colors.text)
               .fontSize(12)
               .font('Helvetica-Bold')
            
            headers.forEach((header, i) => {
              const x = margin + (i * colWidth) + 3
              doc.text(header, x, currentY + 5, { 
                width: colWidth - 6, 
                align: 'center' 
              })
            })
            
            currentY += headerHeight
            doc.font('Helvetica')
          }
          
          // Alternate row colors
          const fillColor = rowIndex % 2 === 0 ? '#ffffff' : colors.lightGray
          
          doc.rect(margin, currentY, tableWidth, currentRowHeight)
             .fillAndStroke(fillColor, colors.border)
          
          row.forEach((cell, colIndex) => {
            const x = margin + (colIndex * colWidth) + 3
            let cellText = cell.toString()
            
            // Apply truncation for customer names (usually in column 1) if they're too long
            if (colIndex === 1) { // Customer name column
              cellText = truncateText(cellText, colWidth, 12)
            }
            
            // Determine alignment based on content
            let align = 'left'
            if (cellText.includes('Rs.') || cellText.includes('%') || !isNaN(parseFloat(cellText.replace(/[Rs.,\s%]/g, '')))) {
              align = 'right' // Numbers, currency, percentages
            } else if (colIndex === 0) {
              align = 'left' // First column (labels, names)
            }
            
            doc.fillColor(colors.text)
               .fontSize(12) // 12pt font as requested
               .text(cellText, x, currentY + 5, { 
                 width: colWidth - 6, 
                 align: align,
                 lineBreak: true // Enable line breaks for long text
               })
          })
          
          currentY += currentRowHeight
        })
        
        currentY += 30 // 2 lines space after each section
      }

      // Helper function to add bold total row
      const addBoldTotalRow = (headers, totalRow) => {
        const tableWidth = contentWidth
        const colWidth = tableWidth / headers.length
        const rowHeight = 25 // Slightly taller for bold text
        
        // Check space
        checkPageSpace(rowHeight + 5)
        
        // Draw bold total row with darker background
        doc.rect(margin, currentY, tableWidth, rowHeight)
           .fillAndStroke('#e6e6e6', colors.border)
        
        totalRow.forEach((cell, colIndex) => {
          const x = margin + (colIndex * colWidth) + 3
          let cellText = cell.toString()
          
          // Determine alignment
          let align = 'left'
          if (cellText.includes('Rs.') || cellText.includes('%') || !isNaN(parseFloat(cellText.replace(/[Rs.,\s%]/g, '')))) {
            align = 'right'
          } else if (colIndex === 0) {
            align = 'left'
          }
          
          doc.fillColor(colors.text)
             .fontSize(12)
             .font('Helvetica-Bold') // Make totals very bold
             .text(cellText, x, currentY + 6, { 
               width: colWidth - 6, 
               align: align
             })
        })
        
        currentY += rowHeight + 5 // Extra space after total row
      }

      // Document Header - Very compact
      addTitle(auditData.title)
      
      // Header information in compact format
      const headerInfo = [
        `Period: ${auditData.auditPeriod} | Location: ${auditData.location} | License: ${auditData.licenseNo}`,
        `Prepared by: ${auditData.preparedBy} | Generated: ${new Date(auditData.generatedOn).toLocaleDateString()} | By: ${auditData.generatedBy}`
      ]
      
      headerInfo.forEach(info => {
        addText(info, 12, { align: 'center' })
      })
      
      currentY += 30 // 2 lines gap as requested

      // 1. Executive Summary
      addSectionHeader('1. EXECUTIVE SUMMARY')
      
      const summaryData = [
        ['Total Loans', (auditData.executiveSummary.totalLoans || 0).toString()],
        ['Active Loans', (auditData.executiveSummary.activeLoans || 0).toString()],
        ['Repaid Loans', (auditData.executiveSummary.repaidLoans || auditData.executiveSummary.settledLoans || 0).toString()],
        ['Forfeited Loans', (auditData.executiveSummary.forfeitedLoans || 0).toString()],
        ['Total Loan Value', `Rs. ${(auditData.executiveSummary.totalLoanValue || 0).toLocaleString()}`],
        ['Total Customers', (auditData.executiveSummary.totalCustomers || 0).toString()]
      ]
      
      addTable(['Metric', 'Value'], summaryData)
      
      // Add bold total row for Executive Summary
      const summaryTotal = [
        'TOTAL BUSINESS VALUE',
        `Rs. ${(auditData.executiveSummary.totalLoanValue || 0).toLocaleString()}`
      ]
      addBoldTotalRow(['Metric', 'Value'], summaryTotal)

      // 2. Financial Statements - Combined in one table
      addSectionHeader('2. FINANCIAL STATEMENTS')
      
      const financialData = [
        // Assets Section
        ['ASSETS', ''],
        ['Cash in Hand/Bank', `Rs. ${(auditData.balanceSheet?.assets?.cashInHand || 0).toLocaleString()}`],
        ['Loan Receivables', `Rs. ${(auditData.balanceSheet?.assets?.loanReceivables || 0).toLocaleString()}`],
        ['Forfeited Inventory', `Rs. ${(auditData.balanceSheet?.assets?.forfeitedInventory || 0).toLocaleString()}`],
        ['Furniture & Fixtures', `Rs. ${(auditData.balanceSheet?.assets?.furnitureFixtures || 0).toLocaleString()}`],
        ['Total Assets', `Rs. ${(auditData.balanceSheet?.assets?.totalAssets || 0).toLocaleString()}`],
        ['', ''],
        // P&L Section
        ['REVENUE', ''],
        ['Interest Income', `Rs. ${(auditData.profitLoss?.revenue?.interestIncome || 0).toLocaleString()}`],
        ['Sale of Forfeited Items', `Rs. ${(auditData.profitLoss?.revenue?.saleOfForfeitedItems || 0).toLocaleString()}`],
        ['Total Revenue', `Rs. ${(auditData.profitLoss?.revenue?.totalRevenue || 0).toLocaleString()}`],
        ['', ''],
        ['EXPENSES', ''],
        ['Salaries', `Rs. ${(auditData.profitLoss?.expenses?.salaries || 0).toLocaleString()}`],
        ['Rent', `Rs. ${(auditData.profitLoss?.expenses?.rent || 0).toLocaleString()}`],
        ['Utilities', `Rs. ${(auditData.profitLoss?.expenses?.utilities || 0).toLocaleString()}`],
        ['Miscellaneous', `Rs. ${(auditData.profitLoss?.expenses?.miscellaneous || 0).toLocaleString()}`],
        ['Total Expenses', `Rs. ${(auditData.profitLoss?.expenses?.totalExpenses || 0).toLocaleString()}`],
        ['', ''],
        ['NET PROFIT', `Rs. ${(auditData.profitLoss?.netProfit || 0).toLocaleString()}`]
      ]
      
      addTable(['Particulars', 'Amount'], financialData)
      
      // Add bold total row for Financial Statements
      const financialTotal = [
        'NET PROFIT (BOLD)',
        `Rs. ${(auditData.profitLoss?.netProfit || 0).toLocaleString()}`
      ]
      addBoldTotalRow(['Particulars', 'Amount'], financialTotal)

      // 3. Loan Register Summary
      addSectionHeader('3. PAWN LOAN REGISTER SUMMARY')
      
      const loanRegisterData = [
        ['Gold Jewelry', 
         (auditData.loanRegister?.goldJewelry?.count || 0).toString(), 
         `Rs. ${(auditData.loanRegister?.goldJewelry?.totalValue || 0).toLocaleString()}`, 
         `${auditData.loanRegister?.goldJewelry?.avgInterestRate || 0}%`],
        ['Electronics', 
         (auditData.loanRegister?.electronics?.count || 0).toString(), 
         `Rs. ${(auditData.loanRegister?.electronics?.totalValue || 0).toLocaleString()}`, 
         `${auditData.loanRegister?.electronics?.avgInterestRate || 0}%`],
        ['Others', 
         (auditData.loanRegister?.others?.count || 0).toString(), 
         `Rs. ${(auditData.loanRegister?.others?.totalValue || 0).toLocaleString()}`, 
         `${auditData.loanRegister?.others?.avgInterestRate || 0}%`]
      ]
      
      addTable(['Category', 'Count', 'Total Value', 'Avg Interest'], loanRegisterData)
      
      // Add bold total row for Loan Register Summary
      const totalCount = (auditData.loanRegister?.goldJewelry?.count || 0) + 
                        (auditData.loanRegister?.electronics?.count || 0) + 
                        (auditData.loanRegister?.others?.count || 0)
      const totalValue = (auditData.loanRegister?.goldJewelry?.totalValue || 0) + 
                        (auditData.loanRegister?.electronics?.totalValue || 0) + 
                        (auditData.loanRegister?.others?.totalValue || 0)
      
      const loanRegisterTotal = [
        'TOTAL',
        totalCount.toString(),
        `Rs. ${totalValue.toLocaleString()}`,
        '-'
      ]
      addBoldTotalRow(['Category', 'Count', 'Total Value', 'Avg Interest'], loanRegisterTotal)

      // 4. Loan Register Details (All loans)
      addSectionHeader('4. LOAN REGISTER DETAILS')
      
      if (auditData.loanRegisterDetails && auditData.loanRegisterDetails.length > 0) {
        const loanRegisterHeaders = ['Loan ID', 'Customer', 'Amount', 'Interest %', 'Status']
        const loanRegisterTableData = auditData.loanRegisterDetails.map(loan => [
          loan.loanId || 'N/A',
          loan.customerName || 'N/A',
          `Rs. ${loan.loanAmount ? loan.loanAmount.toLocaleString() : '0'}`,
          `${loan.interestPercent || 0}%`,
          loan.status || 'N/A'
        ])
        
        addTable(loanRegisterHeaders, loanRegisterTableData)
        
        addText(`Total ${auditData.loanRegisterDetails.length} loans displayed`, 12, { align: 'center', color: colors.secondary })
      } else {
        addText('No loan register data available.', 12, { align: 'center' })
      }

      // 5. Additional Statistics (Compact Summary)
      addSectionHeader('5. ADDITIONAL STATISTICS')
      
      const additionalStatsData = []
      
      // Add loan register statistics if available
      if (auditData.loanRegisterStats) {
        additionalStatsData.push(
          ['Total Pledged Loans', auditData.loanRegisterStats.totalPledgedLoans?.toString() || '0'],
          ['Active Loans', auditData.loanRegisterStats.activeLoans?.toString() || '0'],
          ['Settled Loans', auditData.loanRegisterStats.settledLoans?.toString() || '0'],
          ['Forfeited Loans', auditData.loanRegisterStats.forfeitedLoans?.toString() || '0']
        )
      }
      
      // Add transaction summary if available
      if (auditData.transactionSummary) {
        additionalStatsData.push(
          ['Total Transactions', auditData.transactionSummary.totalTransactions?.toString() || '0'],
          ['Cash Transactions', `Rs. ${auditData.transactionSummary.cashTransactions?.toLocaleString() || '0'}`],
          ['Online Transactions', `Rs. ${auditData.transactionSummary.onlineTransactions?.toLocaleString() || '0'}`]
        )
      }
      
      if (additionalStatsData.length > 0) {
        addTable(['Metric', 'Value'], additionalStatsData)
        
        // Add bold total row for Additional Statistics
        const totalTransactions = (auditData.transactionSummary?.totalTransactions || 0)
        const totalCashOnline = (auditData.transactionSummary?.cashTransactions || 0) + 
                               (auditData.transactionSummary?.onlineTransactions || 0)
        
        const statsTotal = [
          'TOTAL TRANSACTION VALUE',
          `Rs. ${totalCashOnline.toLocaleString()}`
        ]
        addBoldTotalRow(['Metric', 'Value'], statsTotal)
      }

      // 6. Conclusion
      addSectionHeader('6. CONCLUSION')
      if (auditData.conclusion) {
        // Split long conclusion into multiple lines for better readability
        const conclusionLines = auditData.conclusion.match(/.{1,80}(\s|$)/g) || [auditData.conclusion]
        conclusionLines.forEach(line => {
          addText(line.trim(), 12)
        })
      } else {
        // Default conclusion with proper line breaks
        const defaultConclusion = [
          'GOLDEN JEWELLERY has maintained financial and operational compliance for the selected period.',
          'Proper documentation, record-keeping, and KYC procedures are in place.',
          'The detailed loan summary and customer-wise interest analysis demonstrate transparent business operations.'
        ]
        defaultConclusion.forEach(line => {
          addText(line, 12)
        })
      }

      // Footer - Add only if space available on current page
      const footerText = `Report generated on ${new Date().toLocaleDateString()} by ${auditData.generatedBy}`
      const footerHeight = 20
      
      if (currentY + footerHeight < pageHeight - margin) {
        // Add footer on current page
        doc.fontSize(12)
           .fillColor(colors.secondary)
           .font('Helvetica-Oblique')
           .text(footerText, margin, currentY + 10, { align: 'center', width: contentWidth })
      } else {
        // Add footer at bottom of current page without creating new page
        doc.fontSize(12)
           .fillColor(colors.secondary)
           .font('Helvetica-Oblique')
           .text(footerText, margin, pageHeight - 25, { align: 'center', width: contentWidth })
      }

      // Properly end the document to prevent extra pages
      doc.flushPages()
      doc.end()

      stream.on('finish', () => {
        resolve(filePath)
      })

      stream.on('error', (error) => {
        reject(error)
      })

    } catch (error) {
      reject(error)
    }
  })
}

module.exports = { generateAuditReportPDF }