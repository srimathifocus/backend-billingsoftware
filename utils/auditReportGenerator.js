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
        margin: 50,
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
      
      // Page dimensions
      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = doc.page.margins.left
      const contentWidth = pageWidth - (margin * 2)
      
      let currentY = margin

      // Helper functions
      const addTitle = (text, fontSize = 18, color = colors.primary) => {
        doc.fillColor(color)
           .fontSize(fontSize)
           .font('Helvetica-Bold')
           .text(text, margin, currentY, { align: 'center', width: contentWidth })
        currentY += fontSize + 10
      }

      const addSectionHeader = (text, fontSize = 14) => {
        if (currentY > pageHeight - 100) {
          doc.addPage()
          currentY = margin
        }
        
        doc.fillColor(colors.primary)
           .fontSize(fontSize)
           .font('Helvetica-Bold')
           .text(text, margin, currentY)
        
        // Add underline
        doc.moveTo(margin, currentY + fontSize + 2)
           .lineTo(pageWidth - margin, currentY + fontSize + 2)
           .strokeColor(colors.border)
           .stroke()
        
        currentY += fontSize + 15
      }

      const addText = (text, fontSize = 10, options = {}) => {
        const font = options.bold ? 'Helvetica-Bold' : 'Helvetica'
        const color = options.color || colors.text
        const indent = options.indent || 0
        
        doc.fillColor(color)
           .fontSize(fontSize)
           .font(font)
           .text(text, margin + indent, currentY, { 
             width: contentWidth - indent,
             align: options.align || 'left'
           })
        
        currentY += fontSize + 5
      }

      const addTable = (headers, rows, options = {}) => {
        const startY = currentY
        const tableWidth = contentWidth
        const colWidth = tableWidth / headers.length
        const rowHeight = 25
        
        // Check if table fits on current page
        if (currentY + (rows.length + 2) * rowHeight > pageHeight - margin) {
          doc.addPage()
          currentY = margin
        }
        
        // Draw table header
        doc.rect(margin, currentY, tableWidth, rowHeight)
           .fillAndStroke(colors.lightGray, colors.border)
        
        doc.fillColor(colors.text)
           .fontSize(10)
           .font('Helvetica-Bold')
        
        headers.forEach((header, i) => {
          const x = margin + (i * colWidth) + 5
          doc.text(header, x, currentY + 7, { 
            width: colWidth - 10, 
            align: 'center' 
          })
        })
        
        currentY += rowHeight
        
        // Draw table rows
        doc.font('Helvetica')
        rows.forEach((row, rowIndex) => {
          // Alternate row colors
          const fillColor = rowIndex % 2 === 0 ? '#ffffff' : colors.lightGray
          
          doc.rect(margin, currentY, tableWidth, rowHeight)
             .fillAndStroke(fillColor, colors.border)
          
          row.forEach((cell, colIndex) => {
            const x = margin + (colIndex * colWidth) + 5
            const isNumber = !isNaN(parseFloat(cell.toString().replace(/[₹,\s]/g, '')))
            const align = (colIndex > 0 && isNumber) ? 'right' : 'left'
            
            doc.fillColor(colors.text)
               .text(cell.toString(), x, currentY + 7, { 
                 width: colWidth - 10, 
                 align: align 
               })
          })
          
          currentY += rowHeight
        })
        
        currentY += 10
      }

      // Document Header
      addTitle(auditData.title, 20)
      
      // Header information
      const headerInfo = [
        `Audit Period: ${auditData.auditPeriod}`,
        `Location: ${auditData.location}`,
        `License No: ${auditData.licenseNo}`,
        `Prepared by: ${auditData.preparedBy}`,
        `Generated on: ${new Date(auditData.generatedOn).toLocaleDateString()}`,
        `Generated by: ${auditData.generatedBy}`
      ]
      
      headerInfo.forEach(info => {
        addText(info, 10, { align: 'center' })
      })
      
      currentY += 20

      // 1. Executive Summary
      addSectionHeader('1. EXECUTIVE SUMMARY')
      
      const summaryData = [
        ['Total Loans', (auditData.executiveSummary.totalLoans || 0).toString()],
        ['Active Loans', (auditData.executiveSummary.activeLoans || 0).toString()],
        ['Repaid Loans', (auditData.executiveSummary.repaidLoans || auditData.executiveSummary.settledLoans || 0).toString()],
        ['Forfeited Loans', (auditData.executiveSummary.forfeitedLoans || 0).toString()],
        ['Total Loan Value', `₹ ${(auditData.executiveSummary.totalLoanValue || 0).toLocaleString()}`],
        ['Total Customers', (auditData.executiveSummary.totalCustomers || 0).toString()]
      ]
      
      addTable(['Metric', 'Value'], summaryData)

      // 2. Financial Statements
      addSectionHeader('2. FINANCIAL STATEMENTS')
      
      // Balance Sheet - Assets
      addText('Balance Sheet - Assets', 12, { bold: true })
      currentY += 5
      
      const assetsData = [
        ['Cash in Hand/Bank', `₹ ${(auditData.balanceSheet?.assets?.cashInHand || 0).toLocaleString()}`],
        ['Loan Receivables', `₹ ${(auditData.balanceSheet?.assets?.loanReceivables || 0).toLocaleString()}`],
        ['Forfeited Inventory', `₹ ${(auditData.balanceSheet?.assets?.forfeitedInventory || 0).toLocaleString()}`],
        ['Furniture & Fixtures', `₹ ${(auditData.balanceSheet?.assets?.furnitureFixtures || 0).toLocaleString()}`],
        ['TOTAL ASSETS', `₹ ${(auditData.balanceSheet?.assets?.totalAssets || 0).toLocaleString()}`]
      ]
      
      addTable(['Asset Type', 'Amount'], assetsData)
      
      // Profit & Loss
      addText('Profit & Loss Account', 12, { bold: true })
      currentY += 5
      
      const plData = [
        ['REVENUE', ''],
        ['Interest Income', `₹ ${(auditData.profitLoss?.revenue?.interestIncome || 0).toLocaleString()}`],
        ['Sale of Forfeited Items', `₹ ${(auditData.profitLoss?.revenue?.saleOfForfeitedItems || 0).toLocaleString()}`],
        ['Total Revenue', `₹ ${(auditData.profitLoss?.revenue?.totalRevenue || 0).toLocaleString()}`],
        ['', ''],
        ['EXPENSES', ''],
        ['Salaries', `₹ ${(auditData.profitLoss?.expenses?.salaries || 0).toLocaleString()}`],
        ['Rent', `₹ ${(auditData.profitLoss?.expenses?.rent || 0).toLocaleString()}`],
        ['Utilities', `₹ ${(auditData.profitLoss?.expenses?.utilities || 0).toLocaleString()}`],
        ['Miscellaneous', `₹ ${(auditData.profitLoss?.expenses?.miscellaneous || 0).toLocaleString()}`],
        ['Total Expenses', `₹ ${(auditData.profitLoss?.expenses?.totalExpenses || 0).toLocaleString()}`],
        ['', ''],
        ['NET PROFIT', `₹ ${(auditData.profitLoss?.netProfit || 0).toLocaleString()}`]
      ]
      
      addTable(['Particulars', 'Amount'], plData)

      // 3. Loan Register Summary
      addSectionHeader('3. PAWN LOAN REGISTER SUMMARY')
      
      const loanRegisterData = [
        ['Gold Jewelry', 
         (auditData.loanRegister?.goldJewelry?.count || 0).toString(), 
         `₹ ${(auditData.loanRegister?.goldJewelry?.totalValue || 0).toLocaleString()}`, 
         `${auditData.loanRegister?.goldJewelry?.avgInterestRate || 0}%`],
        ['Electronics', 
         (auditData.loanRegister?.electronics?.count || 0).toString(), 
         `₹ ${(auditData.loanRegister?.electronics?.totalValue || 0).toLocaleString()}`, 
         `${auditData.loanRegister?.electronics?.avgInterestRate || 0}%`],
        ['Others', 
         (auditData.loanRegister?.others?.count || 0).toString(), 
         `₹ ${(auditData.loanRegister?.others?.totalValue || 0).toLocaleString()}`, 
         `${auditData.loanRegister?.others?.avgInterestRate || 0}%`]
      ]
      
      addTable(['Category', 'Count', 'Total Value', 'Avg Interest'], loanRegisterData)

      // 4. Loan Register Summary
      addSectionHeader('4. LOAN REGISTER SUMMARY')
      
      if (auditData.loanRegisterDetails && auditData.loanRegisterDetails.length > 0) {
        const loanRegisterHeaders = ['Loan ID', 'Customer', 'Item Weight (gm)', 'Loan Amt (INR)', 'Interest %', 'Status']
        const loanRegisterTableData = auditData.loanRegisterDetails.slice(0, 20).map(loan => [
          loan.loanId || 'N/A',
          loan.customerName || 'N/A',
          loan.itemDescription || 'N/A',
          `₹ ${loan.loanAmount ? loan.loanAmount.toLocaleString() : '0'}`,
          `${loan.interestPercent || 0}%`,
          loan.status || 'N/A'
        ])
        
        addTable(loanRegisterHeaders, loanRegisterTableData)
        
        if (auditData.loanRegisterDetails.length > 20) {
          addText(`... and ${auditData.loanRegisterDetails.length - 20} more loans`, 10, { align: 'center', color: colors.secondary })
        }
        
        // Add summary statistics
        currentY += 10
        addText('LOAN REGISTER STATISTICS', 12, { bold: true })
        currentY += 5
        
        const statsData = []
        if (auditData.loanRegisterStats) {
          statsData.push(
            ['Total Pledged Loans:', auditData.loanRegisterStats.totalPledgedLoans.toString()],
            ['Active Loans:', auditData.loanRegisterStats.activeLoans.toString()],
            ['Settled Loans:', auditData.loanRegisterStats.settledLoans.toString()],
            ['Forfeited Loans:', auditData.loanRegisterStats.forfeitedLoans.toString()],
            ['Total Loan Value:', `Rs. ${auditData.loanRegisterStats.totalLoanValue.toLocaleString()}`]
          )
        }
        
        addTable(['Metric', 'Count'], statsData)
      } else {
        addText('No loan register data available for the selected period.', 10, { align: 'center' })
      }

      // 5. Detailed Loan Summary
      addSectionHeader('5. DETAILED LOAN SUMMARY')
      
      if (auditData.loanSummary && auditData.loanSummary.length > 0) {
        const loanSummaryHeaders = ['Loan ID', 'Customer Name', 'Amount', 'Status', 'Loan Date', 'Due Date', 'Extended Date']
        const loanSummaryData = auditData.loanSummary.map(loan => [
          loan.loanId || 'N/A',
          loan.customerName || 'N/A',
          `₹ ${loan.amount ? loan.amount.toLocaleString() : '0'}`,
          loan.status || 'N/A',
          loan.loanDate ? moment(loan.loanDate).format('DD/MM/YYYY') : 'N/A',
          loan.dueDate ? moment(loan.dueDate).format('DD/MM/YYYY') : 'N/A',
          loan.extendedDate ? moment(loan.extendedDate).format('DD/MM/YYYY') : 'N/A'
        ])
        
        addTable(loanSummaryHeaders, loanSummaryData.slice(0, 15)) // Show first 15 loans
        
        if (loanSummaryData.length > 15) {
          addText(`... and ${loanSummaryData.length - 15} more loans`, 10, { align: 'center', color: colors.secondary })
        }
      } else {
        addText('No loan data available for the selected period.', 10, { align: 'center' })
      }

      // 6. Customer-wise Interest Analysis
      addSectionHeader('6. CUSTOMER-WISE INTEREST ANALYSIS')
      
      if (auditData.customerInterestAnalysis && auditData.customerInterestAnalysis.length > 0) {
        const interestHeaders = ['Customer Name', 'Total Loans Given', 'Total Repaid', 'Interest Earned', 'Outstanding']
        const interestData = auditData.customerInterestAnalysis.map(customer => [
          customer.customerName || 'N/A',
          `₹ ${customer.totalLoansGiven ? customer.totalLoansGiven.toLocaleString() : '0'}`,
          `₹ ${customer.totalRepaid ? customer.totalRepaid.toLocaleString() : '0'}`,
          `₹ ${customer.interestEarned ? customer.interestEarned.toLocaleString() : '0'}`,
          `₹ ${customer.outstanding ? customer.outstanding.toLocaleString() : '0'}`
        ])
        
        addTable(interestHeaders, interestData.slice(0, 10)) // Show first 10 customers
        
        if (interestData.length > 10) {
          addText(`... and ${interestData.length - 10} more customers`, 10, { align: 'center', color: colors.secondary })
        }
      } else {
        addText('No customer interest data available for the selected period.', 10, { align: 'center' })
      }

      // 7. Monthly Profit & Loss Summary
      addSectionHeader('7. MONTHLY PROFIT & LOSS SUMMARY')
      
      if (auditData.monthlyProfitLoss && auditData.monthlyProfitLoss.length > 0) {
        const monthlyHeaders = ['Month', 'Loans Given', 'Repayments', 'Interest Income', 'Expenses', 'Net Profit']
        const monthlyData = auditData.monthlyProfitLoss.map(monthly => [
          monthly.month || 'N/A',
          `₹ ${monthly.loansGiven ? monthly.loansGiven.toLocaleString() : '0'}`,
          `₹ ${monthly.repayments ? monthly.repayments.toLocaleString() : '0'}`,
          `₹ ${monthly.interestIncome ? monthly.interestIncome.toLocaleString() : '0'}`,
          `₹ ${monthly.expenses ? monthly.expenses.toLocaleString() : '0'}`,
          `₹ ${monthly.netProfit ? monthly.netProfit.toLocaleString() : '0'}`
        ])
        
        addTable(monthlyHeaders, monthlyData)
        
        // Add total row
        const totalRow = [
          'TOTAL',
          `₹ ${auditData.monthlyTotals?.totalLoansGiven ? auditData.monthlyTotals.totalLoansGiven.toLocaleString() : '0'}`,
          `₹ ${auditData.monthlyTotals?.totalRepayments ? auditData.monthlyTotals.totalRepayments.toLocaleString() : '0'}`,
          `₹ ${auditData.monthlyTotals?.totalInterestIncome ? auditData.monthlyTotals.totalInterestIncome.toLocaleString() : '0'}`,
          `₹ ${auditData.monthlyTotals?.totalExpenses ? auditData.monthlyTotals.totalExpenses.toLocaleString() : '0'}`,
          `₹ ${auditData.monthlyTotals?.totalNetProfit ? auditData.monthlyTotals.totalNetProfit.toLocaleString() : '0'}`
        ]
        
        addTable(['', '', '', '', '', ''], [totalRow])
      } else {
        addText('No monthly profit & loss data available for the selected period.', 10, { align: 'center' })
      }

      // 7. Transaction Summary
      addSectionHeader('7. TRANSACTION SUMMARY')
      
      if (auditData.transactionSummary) {
        const transactionSummaryData = [
          ['Total Transactions', auditData.transactionSummary.totalTransactions?.toString() || '0'],
          ['Cash Transactions', `₹ ${auditData.transactionSummary.cashTransactions ? auditData.transactionSummary.cashTransactions.toLocaleString() : '0'}`],
          ['Online Transactions', `₹ ${auditData.transactionSummary.onlineTransactions ? auditData.transactionSummary.onlineTransactions.toLocaleString() : '0'}`],
          ['Average Transaction Value', `₹ ${auditData.transactionSummary.avgTransactionValue ? auditData.transactionSummary.avgTransactionValue.toLocaleString() : '0'}`],
          ['Loan Transactions', auditData.transactionSummary.loanTransactions?.toString() || '0'],
          ['Repayment Transactions', auditData.transactionSummary.repaymentTransactions?.toString() || '0']
        ]
        
        addTable(['Metric', 'Value'], transactionSummaryData)
      } else {
        addText('No transaction summary data available for the selected period.', 10, { align: 'center' })
      }

      // 8. Auditor Observations
      addSectionHeader('8. AUDITOR OBSERVATIONS')
      
      auditData.observations.forEach(observation => {
        addText(`• ${observation}`, 10, { indent: 10 })
      })
      
      currentY += 10

      // 9. Conclusion
      addSectionHeader('9. CONCLUSION')
      addText(auditData.conclusion, 10)

      // Footer
      doc.fontSize(8)
         .fillColor(colors.secondary)
         .font('Helvetica-Oblique')
         .text(
           `Report generated on ${new Date().toLocaleDateString()} by ${auditData.generatedBy}`,
           margin,
           pageHeight - 30,
           { align: 'center', width: contentWidth }
         )

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