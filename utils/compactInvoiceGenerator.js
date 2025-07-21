const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Dark Blue and White Color Scheme for Compact Invoice
const colors = {
  primary: '#00008B',      // Dark Blue
  secondary: '#1E3A8A',    // Medium Dark Blue
  light: '#3B82F6',        // Light Blue
  white: '#FFFFFF',        // White
  black: '#000000',        // Black
  lightBlue: '#EBF8FF',    // Very light blue
  gray: '#64748B'          // Blue-gray
}

/**
 * Generates a compact invoice PDF optimized for jewelry shops with dark blue theme
 * Size: 10cm x 8cm (approximately 283x227 points)
 */
const generateCompactInvoice = (data, filePath) => {
  return new Promise((resolve, reject) => {
    // Create PDF with custom page size (10cm x 8cm)
    const doc = new PDFDocument({ 
      size: [283, 227], // 10cm x 8cm in points
      margins: { top: 5, left: 5, right: 5, bottom: 5 }
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    let yPosition = 10;
    const pageWidth = 283;
    const leftMargin = 5;
    const rightMargin = 5;
    const contentWidth = pageWidth - leftMargin - rightMargin;

    // Shop Header with dark blue background
    doc.rect(0, 0, pageWidth, 45)
       .fill(colors.primary);

    doc.fillColor(colors.white)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(data.shopDetails.name.toUpperCase(), leftMargin, yPosition, { 
         width: contentWidth, 
         align: 'center' 
       });
    yPosition += 12;

    doc.fontSize(7)
       .font('Helvetica')
       .text(data.shopDetails.address, leftMargin, yPosition, { 
         width: contentWidth, 
         align: 'center' 
       });
    yPosition += 10;

    doc.text(`Ph: ${data.shopDetails.phone}${data.shopDetails.email ? ` | ${data.shopDetails.email}` : ''}`, 
      leftMargin, yPosition, { width: contentWidth, align: 'center' });
    yPosition += 8;

    if (data.shopDetails.gstNo) {
      doc.text(`GST: ${data.shopDetails.gstNo} | License: ${data.shopDetails.licenseNo || 'N/A'}`, 
        leftMargin, yPosition, { 
          width: contentWidth, 
          align: 'center' 
        });
    }

    // Reset position and color
    yPosition = 50;
    doc.fillColor(colors.black);

    // Invoice title with light blue background
    doc.rect(leftMargin, yPosition, contentWidth, 15)
       .fill(colors.light);

    doc.fillColor(colors.white)
       .fontSize(9)
       .font('Helvetica-Bold');
    const invoiceTitle = data.type === 'repayment' ? 'REPAYMENT RECEIPT' : 'LOAN INVOICE';
    doc.text(invoiceTitle, leftMargin, yPosition + 4, { 
      width: contentWidth, 
      align: 'center' 
    });
    yPosition += 20;

    // Invoice details
    doc.fillColor(colors.black)
       .fontSize(7)
       .font('Helvetica')
       .text(`ID: ${data.invoiceId} | Date: ${new Date(data.date).toLocaleDateString('en-IN')}`, 
         leftMargin, yPosition, { width: contentWidth, align: 'center' });
    yPosition += 12;

    // Customer Details with light blue background
    doc.rect(leftMargin, yPosition, contentWidth, 8)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(7)
       .font('Helvetica-Bold')
       .text('CUSTOMER DETAILS', leftMargin + 2, yPosition + 2);
    yPosition += 12;

    doc.fillColor(colors.black)
       .fontSize(6)
       .font('Helvetica')
       .text(`Name: ${data.customerName}`, leftMargin, yPosition);
    doc.text(`Phone: ${data.customerPhone}`, leftMargin + 130, yPosition);
    yPosition += 8;

    if (data.customerAddress) {
      doc.text(`Address: ${data.customerAddress}`, leftMargin, yPosition, { width: contentWidth });
      yPosition += 8;
    }

    // Loan Details with light blue background  
    yPosition += 2;
    doc.rect(leftMargin, yPosition, contentWidth, 8)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(7)
       .font('Helvetica-Bold')
       .text('LOAN DETAILS', leftMargin + 2, yPosition + 2);
    yPosition += 12;

    doc.fillColor(colors.black)
       .fontSize(6)
       .font('Helvetica')
       .text(`Amount: ₹${data.loanAmount.toLocaleString()}`, leftMargin, yPosition);
    doc.text(`Interest: ${data.interestRate}%/month`, leftMargin + 130, yPosition);
    yPosition += 8;

    doc.text(`Validity: ${data.validity} months`, leftMargin, yPosition);
    doc.text(`Due: ${new Date(data.dueDate).toLocaleDateString('en-IN')}`, leftMargin + 130, yPosition);
    yPosition += 8;

    if (data.type === 'repayment') {
      doc.text(`Days: ${data.daysDifference}`, leftMargin, yPosition);
      doc.text(`Interest: ₹${data.interestAmount.toLocaleString()}`, leftMargin + 130, yPosition);
      yPosition += 8;

      // Highlight total paid amount
      doc.rect(leftMargin, yPosition, contentWidth, 12)
         .fill(colors.secondary);

      doc.fillColor(colors.white)
         .fontSize(7)
         .font('Helvetica-Bold')
         .text(`TOTAL PAID: ₹${data.totalAmount.toLocaleString()}`, leftMargin, yPosition + 3, { 
           width: contentWidth, 
           align: 'center' 
         });
      yPosition += 16;
    }

    // Items section with light blue background
    yPosition += 2;
    doc.rect(leftMargin, yPosition, contentWidth, 8)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(7)
       .font('Helvetica-Bold')
       .text('PLEDGED ITEMS', leftMargin + 2, yPosition + 2);
    yPosition += 12;

    doc.fillColor(colors.black)
       .fontSize(6)
       .font('Helvetica');
    let totalValue = 0;
    data.items.forEach((item, index) => {
      const itemText = `${index + 1}. ${item.name} - ${item.category} - ${item.carat} - ${item.weight}g`;
      const valueText = `₹${item.estimatedValue.toLocaleString()}`;
      
      doc.text(itemText, leftMargin, yPosition, { width: contentWidth - 45 });
      doc.text(valueText, leftMargin + contentWidth - 45, yPosition, { width: 45, align: 'right' });
      yPosition += 8;
      totalValue += item.estimatedValue;
    });

    // Total Value with dark blue background
    doc.rect(leftMargin, yPosition, contentWidth, 10)
       .fill(colors.primary);

    doc.fillColor(colors.white)
       .fontSize(7)
       .font('Helvetica-Bold')
       .text('Total Value:', leftMargin + 2, yPosition + 2);
    doc.text(`₹${totalValue.toLocaleString()}`, leftMargin + contentWidth - 47, yPosition + 2, { 
      width: 45, 
      align: 'right' 
    });
    yPosition += 15;

    // Payment Details with light blue background
    doc.rect(leftMargin, yPosition, contentWidth, 8)
       .fill(colors.lightBlue);

    doc.fillColor(colors.primary)
       .fontSize(7)
       .font('Helvetica-Bold')
       .text('PAYMENT DETAILS', leftMargin + 2, yPosition + 2);
    yPosition += 12;

    doc.fillColor(colors.black)
       .fontSize(6)
       .font('Helvetica')
       .text(`Cash: ₹${data.payment.cash.toLocaleString()}`, leftMargin, yPosition);
    doc.text(`Online: ₹${data.payment.online.toLocaleString()}`, leftMargin + 130, yPosition);
    yPosition += 8;

    const totalPayment = data.payment.cash + data.payment.online;
    
    // Total payment with secondary blue background
    doc.rect(leftMargin, yPosition, contentWidth, 10)
       .fill(colors.secondary);

    doc.fillColor(colors.white)
       .fontSize(7)
       .font('Helvetica-Bold')
       .text(`TOTAL: ₹${totalPayment.toLocaleString()}`, leftMargin, yPosition + 2, { 
         width: contentWidth, 
         align: 'center' 
       });
    yPosition += 15;

    if (data.type === 'repayment') {
      doc.rect(leftMargin, yPosition, contentWidth, 12)
         .fill(colors.primary);
      
      doc.fillColor(colors.white)
         .fontSize(7)
         .font('Helvetica-Bold')
         .text('STATUS: FULLY REPAID', leftMargin, yPosition + 3, { 
           width: contentWidth, 
           align: 'center' 
         });
      yPosition += 15;
    }

    // Terms & Conditions
    yPosition += 2;
    doc.strokeColor(colors.primary)
       .moveTo(leftMargin, yPosition)
       .lineTo(pageWidth - rightMargin, yPosition)
       .stroke();
    yPosition += 3;
    
    doc.fillColor(colors.primary)
       .fontSize(6)
       .font('Helvetica-Bold')
       .text('TERMS & CONDITIONS', leftMargin, yPosition);
    yPosition += 8;

    doc.fillColor(colors.black)
       .fontSize(5)
       .font('Helvetica');
    const terms = [
      '• Interest calculated monthly from loan date',
      '• Items returned upon full repayment only',
      '• Default may result in auction as per law',
      '• Computer generated invoice'
    ];

    terms.forEach(term => {
      doc.text(term, leftMargin, yPosition, { width: contentWidth });
      yPosition += 6;
    });

    // Footer with dark blue background
    const footerHeight = 15;
    doc.rect(0, 227 - footerHeight, pageWidth, footerHeight)
       .fill(colors.primary);

    doc.fillColor(colors.white)
       .fontSize(6)
       .font('Helvetica')
       .text('Thank you for your business!', 0, 227 - footerHeight + 3, { 
         width: pageWidth, 
         align: 'center' 
       });

    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 0, 227 - footerHeight + 9, { 
      width: pageWidth, 
      align: 'center' 
    });

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

module.exports = { generateCompactInvoice };