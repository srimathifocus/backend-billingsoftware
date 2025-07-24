const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Light and Clean Color Scheme for Compact Invoice
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

/**
 * Generates a compact invoice PDF optimized for jewelry shops with dark blue theme
 * Size: 10cm x 8cm (approximately 283x227 points)
 */
const generateCompactInvoice = (data, filePath) => {
  return new Promise((resolve, reject) => {
    // Create PDF with A4 size optimized for single page
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 20, left: 20, right: 20, bottom: 20 },
      bufferPages: false,
      autoFirstPage: true,
      layout: 'portrait',
      info: {
        Title: 'Compact Invoice',
        Author: 'Pawn Shop'
      }
    });
    
    // CRITICAL FIX: Override addPage to prevent additional pages
    const originalAddPage = doc.addPage;
    doc.addPage = function(options) {
      // Block any additional page creation to ensure single page
      return this;
    };

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Track page creation for monitoring
    let pageCount = 0;
    doc.on('pageAdded', () => {
      pageCount++;
    });

    let yPosition = 30;
    const pageWidth = doc.page.width;
    const leftMargin = 30;
    const rightMargin = 30;
    const contentWidth = pageWidth - leftMargin - rightMargin;

    // Shop Header with light background - Optimized
    doc.rect(0, 0, pageWidth, 60)
       .fill(colors.primary);

    doc.fillColor(colors.white)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text(data.shopDetails.name.toUpperCase(), leftMargin, yPosition, { 
         width: contentWidth, 
         align: 'center' 
       });
    yPosition += 18;

    doc.fontSize(9)
       .font('Helvetica')
       .text(data.shopDetails.address, leftMargin, yPosition, { 
         width: contentWidth, 
         align: 'center' 
       });
    yPosition += 12;

    doc.text(`Ph: ${data.shopDetails.phone}${data.shopDetails.email ? ` | ${data.shopDetails.email}` : ''}`, 
      leftMargin, yPosition, { width: contentWidth, align: 'center' });

    if (data.shopDetails.gstNo) {
      yPosition += 10;
      doc.text(`GST: ${data.shopDetails.gstNo} | License: ${data.shopDetails.licenseNo || 'N/A'}`, 
        leftMargin, yPosition, { 
          width: contentWidth, 
          align: 'center' 
        });
    }

    // Reset position and color
    yPosition = 75;
    doc.fillColor(colors.black);

    // Invoice title with clean background - Compact
    doc.rect(leftMargin, yPosition, contentWidth, 20)
       .fill(colors.secondary);

    doc.fillColor(colors.white)
       .fontSize(12)
       .font('Helvetica-Bold');
    const invoiceTitle = data.type === 'repayment' ? 'REPAYMENT RECEIPT' : 'LOAN INVOICE';
    doc.text(invoiceTitle, leftMargin, yPosition + 6, { 
      width: contentWidth, 
      align: 'center' 
    });
    yPosition += 30;

    // Invoice details - Compact
    doc.fillColor(colors.black)
       .fontSize(9)
       .font('Helvetica')
       .text(`ID: ${data.invoiceId} | Date: ${new Date(data.date).toLocaleDateString('en-IN')}`, 
         leftMargin, yPosition, { width: contentWidth, align: 'center' });
    yPosition += 15;

    // Customer Details with clean background - Optimized
    doc.rect(leftMargin, yPosition, contentWidth, 12)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('CUSTOMER DETAILS', leftMargin + 5, yPosition + 3);
    yPosition += 18;

    doc.fillColor(colors.black)
       .fontSize(8)
       .font('Helvetica')
       .text(`Name: ${data.customerName}`, leftMargin, yPosition);
    doc.text(`Phone: ${data.customerPhone}`, leftMargin + 250, yPosition);
    yPosition += 12;

    if (data.customerAddress) {
      doc.text(`Address: ${data.customerAddress}`, leftMargin, yPosition, { width: contentWidth });
      yPosition += 12;
    }

    // Loan Details with clean background - Optimized
    yPosition += 5;
    doc.rect(leftMargin, yPosition, contentWidth, 12)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('LOAN DETAILS', leftMargin + 5, yPosition + 3);
    yPosition += 18;

    doc.fillColor(colors.black)
       .fontSize(8)
       .font('Helvetica')
       .text(`Amount: ₹${data.loanAmount.toLocaleString()}`, leftMargin, yPosition);
    doc.text(`Interest: ${data.interestRate}%/month`, leftMargin + 250, yPosition);
    yPosition += 12;

    doc.text(`Validity: ${data.validity} months`, leftMargin, yPosition);
    doc.text(`Due: ${new Date(data.dueDate).toLocaleDateString('en-IN')}`, leftMargin + 250, yPosition);
    yPosition += 12;

    if (data.type === 'repayment') {
      doc.text(`Days: ${data.daysDifference}`, leftMargin, yPosition);
      doc.text(`Interest: ₹${data.interestAmount.toLocaleString()}`, leftMargin + 250, yPosition);
      yPosition += 12;

      // Highlight total paid amount - Compact
      doc.rect(leftMargin, yPosition, contentWidth, 15)
         .fill(colors.secondary);

      doc.fillColor(colors.white)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(`TOTAL PAID: ₹${data.totalAmount.toLocaleString()}`, leftMargin, yPosition + 4, { 
           width: contentWidth, 
           align: 'center' 
         });
      yPosition += 20;
    }

    // Items section with clean background - Optimized
    yPosition += 5;
    doc.rect(leftMargin, yPosition, contentWidth, 12)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('PLEDGED ITEMS', leftMargin + 5, yPosition + 3);
    yPosition += 18;

    doc.fillColor(colors.black)
       .fontSize(7)
       .font('Helvetica');
    let totalValue = 0;
    data.items.forEach((item, index) => {
      const itemText = `${index + 1}. ${item.name} - ${item.category} - ${item.carat} - ${item.weight}g`;
      const valueText = `₹${item.estimatedValue.toLocaleString()}`;
      
      doc.text(itemText, leftMargin, yPosition, { width: contentWidth - 80 });
      doc.text(valueText, leftMargin + contentWidth - 80, yPosition, { width: 80, align: 'right' });
      yPosition += 10;
      totalValue += item.estimatedValue;
    });

    // Total Value with clean background - Compact
    doc.rect(leftMargin, yPosition, contentWidth, 12)
       .fill(colors.secondary);

    doc.fillColor(colors.white)
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('Total Value:', leftMargin + 5, yPosition + 3);
    doc.text(`₹${totalValue.toLocaleString()}`, leftMargin + contentWidth - 85, yPosition + 3, { 
      width: 80, 
      align: 'right' 
    });
    yPosition += 18;

    // Payment Details with clean background - Optimized
    doc.rect(leftMargin, yPosition, contentWidth, 12)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('PAYMENT DETAILS', leftMargin + 5, yPosition + 3);
    yPosition += 18;

    doc.fillColor(colors.black)
       .fontSize(8)
       .font('Helvetica')
       .text(`Cash: ₹${data.payment.cash.toLocaleString()}`, leftMargin, yPosition);
    doc.text(`Online: ₹${data.payment.online.toLocaleString()}`, leftMargin + 250, yPosition);
    yPosition += 12;

    const totalPayment = data.payment.cash + data.payment.online;
    
    // Total payment with clean background - Compact
    doc.rect(leftMargin, yPosition, contentWidth, 12)
       .fill(colors.secondary);

    doc.fillColor(colors.white)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text(`TOTAL: ₹${totalPayment.toLocaleString()}`, leftMargin, yPosition + 3, { 
         width: contentWidth, 
         align: 'center' 
       });
    yPosition += 18;

    if (data.type === 'repayment') {
      doc.rect(leftMargin, yPosition, contentWidth, 15)
         .fill(colors.light);
      
      doc.fillColor(colors.primary)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('STATUS: FULLY REPAID', leftMargin, yPosition + 4, { 
           width: contentWidth, 
           align: 'center' 
         });
      yPosition += 20;
    }

    // Terms & Conditions - Compact
    yPosition += 5;
    doc.rect(leftMargin, yPosition, contentWidth, 12)
       .fill(colors.lightBlue);
    
    doc.fillColor(colors.primary)
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('TERMS & CONDITIONS', leftMargin + 5, yPosition + 3);
    yPosition += 18;

    doc.fillColor(colors.black)
       .fontSize(6)
       .font('Helvetica');
    const terms = [
      '• Interest calculated monthly from loan date',
      '• Items returned upon full repayment only',
      '• Default may result in auction as per law',
      '• Computer generated invoice'
    ];

    terms.forEach(term => {
      doc.text(term, leftMargin, yPosition, { width: contentWidth });
      yPosition += 8;
    });

    // Footer with clean background - Optimized
    yPosition += 10;
    const footerHeight = 30;
    const footerY = doc.page.height - footerHeight;
    
    doc.rect(0, footerY, pageWidth, footerHeight)
       .fill(colors.primary);

    doc.fillColor(colors.white)
       .fontSize(8)
       .font('Helvetica')
       .text('Thank you!', 0, footerY + 8, { 
         width: pageWidth, 
         align: 'center' 
       });

    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 0, footerY + 18, { 
      width: pageWidth, 
      align: 'center' 
    });

    // CRITICAL: End document immediately to prevent extra pages
    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

module.exports = { generateCompactInvoice };