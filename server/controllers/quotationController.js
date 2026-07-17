const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Quotation = require("../models/Quotation");

async function getQuotations(req, res) {
  try {
    const quotations = await Quotation.find().sort({ createdAt: -1 });
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch quotations" });
  }
}

async function saveQuotation(req, res) {
  try {
    const { _id, refNo, date, to, companyName, address, isGstApplied, manpower } = req.body;
    let quotation;
    if (_id) {
      quotation = await Quotation.findByIdAndUpdate(_id, { refNo, date, to, companyName, address, isGstApplied, manpower }, { new: true });
    } else {
      quotation = new Quotation({ refNo, date, to, companyName, address, isGstApplied, manpower });
      await quotation.save();
    }
    res.json(quotation);
  } catch (error) {
    res.status(500).json({ message: "Failed to save quotation" });
  }
}

function drawTick(doc, x, y) {
  doc.save()
     .moveTo(x, y + 4)
     .lineTo(x + 3, y + 8)
     .lineTo(x + 8, y + 1)
     .strokeColor('#000000') 
     .lineWidth(1.5)
     .stroke()
     .restore();
}

async function downloadQuotationPdf(req, res) {
  try {
    const { id } = req.params;
    const quote = await Quotation.findById(id);
    if (!quote) return res.status(404).json({ message: "Quotation not found" });

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      const safeName = quote.companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Quotation_${safeName}.pdf"`);
      res.send(pdfBuffer);
    });

    const possibleLetterheads = [
      "Security Letterhead_final_CMYK-01.jpg.jpg", 
      "Security Letterhead_final_CMYK-01.jpg", 
      "letterhead.jpeg",
      "letterhead.jpg"
    ];
    const possibleStamps = [
      "WhatsApp Image 2026-07-16 at 1.34.19 PM.png", 
      "stamp.png"
    ];

    let letterheadPath = null;
    for (let name of possibleLetterheads) {
      let p = path.join(__dirname, "../assets", name);
      if (fs.existsSync(p)) { letterheadPath = p; break; }
    }

    let stampPath = null;
    for (let name of possibleStamps) {
      let p = path.join(__dirname, "../assets", name);
      if (fs.existsSync(p)) { stampPath = p; break; }
    }
    
    doc.on('pageAdded', () => {
      if (letterheadPath) {
        doc.image(letterheadPath, 0, 0, { width: 595.28, height: 841.89 });
      }
    });

    if (letterheadPath) {
      doc.image(letterheadPath, 0, 0, { width: 595.28, height: 841.89 });
    }

    // --- PAGE 1: COVER & TERMS ---
    doc.y = 150; 
    
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`REF NO: ${quote.refNo}`, 50, doc.y);
    doc.text(`Date: ${quote.date}`, 50, doc.y - 14, { align: 'right' });
    
    doc.moveDown(1.5);
    doc.text("TO,");
    doc.text(quote.to.toUpperCase());
    doc.text(quote.companyName.toUpperCase());
    doc.font('Helvetica').text(quote.address);
    
    doc.moveDown(2);
    doc.font('Helvetica-Bold').text("Dear Sir/Madam,", { underline: true });
    doc.moveDown(0.5);
    
    doc.font('Helvetica').fontSize(10);
    doc.text("We provide professional security personnel and services to various societies and corporate establishments all over West Bengal. Our terms and conditions are as follows:", { align: 'justify' });
    doc.moveDown(1);
    
    doc.font('Helvetica-Bold').text("A. CHARTER OF RESPONSIBILITIES", { underline: true });
    doc.moveDown(0.8);
    
    const terms = [
      "The Officers/Guards provided to you by us shall remain our employees, and we shall be exclusively responsible for their salary, uniform, and other statutory benefits.",
      "Our guards will diligently carry out all duties assigned to them as per your management's instructions.",
      "Our guards will carry proper identity cards and will always be in full uniform while on duty.",
      "The allocation and rotation of security personnel will be our responsibility.",
      "Our security personnel possess basic knowledge of firefighting and are trained in handling standard firefighting equipment available at your establishment.",
      "Our guards will man the entrance gates and strictly control all movements of visitors and materials.",
      "Our trained supervisors will conduct surprise checks round the clock to ensure the effective performance of the guards posted at your premises.",
      "Our guards will perform 8-hour shift duties round the clock at your premises.",
      "For all administrative and practical purposes, the guards will remain under our operational control.",
      "If authorized, our guards shall open and close the office premises strictly as per the requirements of your company.",
      "We shall ensure that your premises are securely guarded round the clock.",
      "Please note that you shall not employ, directly or indirectly, any of our security personnel in your organization without our prior written consent.",
      "Personnel are entitled to one weekly off. If security coverage is required on their weekly off, we will provide a reliever guard without any extra administrative charge."
    ];

    doc.font('Helvetica').fontSize(10);
    terms.forEach(term => {
      drawTick(doc, 50, doc.y);
      doc.text(term, 65, doc.y, { align: 'justify', width: 480 });
      doc.moveDown(0.7);
    });

    // --- PAGE 2: ANNEXURE & PRICING ---
    doc.addPage();
    doc.y = 150; 

    doc.font('Helvetica-Bold').fontSize(12).text("ANNEXURE 'II'", { align: 'center', underline: true });
    doc.moveDown(0.5);
    doc.text("Price Bid Schedule", { align: 'center' });
    doc.moveDown(1.5);

    const isGst = quote.isGstApplied !== false; 
    const tableTop = doc.y;
    let colX, colW, headers;

    if (isGst) {
      colX = [50, 145, 210, 265, 320, 380, 460]; 
      colW = [95, 65, 55, 55, 60, 80, 85];
      headers = ["CATEGORY", "RATE (RS)", "PERSONS", "DAYS", "HOURS", "TOTAL (RS)", "GST 18%"];
    } else {
      colX = [50, 180, 260, 325, 390, 465];
      colW = [130, 80, 65, 65, 75, 80];
      headers = ["CATEGORY", "RATE (RS)", "PERSONS", "DAYS", "HOURS", "TOTAL (RS)"];
    }

    doc.moveTo(50, tableTop).lineTo(545, tableTop).stroke();
    
    doc.font('Helvetica-Bold').fontSize(9);
    headers.forEach((h, i) => doc.text(h, colX[i], tableTop + 6, { width: colW[i], align: 'center' }));
    
    doc.moveTo(50, tableTop + 22).lineTo(545, tableTop + 22).stroke();

    let currY = tableTop + 30;
    doc.font('Helvetica').fontSize(9);

    let grandTotal = 0;

    quote.manpower.forEach((item) => {
        const rowTotal = item.rate * item.persons;
        
        doc.text(item.category.toUpperCase(), colX[0] + 5, currY, { width: colW[0] - 10, align: 'left' });
        doc.text(item.rate.toLocaleString('en-IN'), colX[1], currY, { width: colW[1], align: 'center' });
        doc.text(item.persons.toString(), colX[2], currY, { width: colW[2], align: 'center' });
        doc.text(item.dutyDays, colX[3], currY, { width: colW[3], align: 'center' });
        doc.text(item.dutyHours, colX[4], currY, { width: colW[4], align: 'center' });
        
        if (isGst) {
            const gstAmt = Math.round(rowTotal * ((item.gstPercent || 18) / 100));
            grandTotal += (rowTotal + gstAmt);
            doc.text(rowTotal.toLocaleString('en-IN'), colX[5], currY, { width: colW[5], align: 'center' });
            doc.text(gstAmt.toLocaleString('en-IN'), colX[6], currY, { width: colW[6], align: 'center' });
        } else {
            grandTotal += rowTotal;
            doc.text(rowTotal.toLocaleString('en-IN'), colX[5], currY, { width: colW[5], align: 'center' });
        }
        
        currY += 22;
    });

    doc.moveTo(50, currY).lineTo(545, currY).stroke();

    colX.forEach(x => { doc.moveTo(x, tableTop).lineTo(x, currY).stroke(); });
    doc.moveTo(545, tableTop).lineTo(545, currY).stroke(); 

    doc.font('Helvetica-Bold').fontSize(10);
    const footerText = isGst ? "GRAND TOTAL (Incl. GST):" : "GRAND TOTAL:";
    const footerLabelW = colX[5] - colX[0] - 10;
    const totalW = isGst ? colW[5] + colW[6] : colW[5];

    doc.text(footerText, colX[0] + 5, currY + 6, { width: footerLabelW, align: 'right' });
    doc.text(`Rs. ${grandTotal.toLocaleString('en-IN')}`, colX[5], currY + 6, { width: totalW, align: 'center' });
    
    doc.moveTo(50, currY + 22).lineTo(545, currY + 22).stroke();

    doc.moveDown(3);
    
    doc.font('Helvetica-Bold').fontSize(11).text("B. TERMS OF PAYMENT", 50, doc.y, { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text("1. Our bill will be submitted on the first day of the following month. Payment by cheque or bank transfer in settlement thereof is expected to be received by us within seven days. Cheques should be drawn in favor of 'DYNAMIC SECURITY AND MANPOWER SERVICES PVT. LTD.' and payable at any bank in West Bengal.", { align: 'justify' });
    doc.moveDown(0.5);
    doc.text("2. In case of default or delay in payment, interest at the rate of 18% per annum will be charged.", { align: 'justify' });
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(11).text("C. ABOUT CONTRACT", 50, doc.y, { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text("The contract shall initially be for a period of one year from the date of signing. Thereafter, it can be terminated by either party by giving one month's notice in writing. If no written notice is received fifteen days prior to the expiry of the contract, the contract shall automatically stand renewed for a further period of one year, subject to a standard rate increase of 10% per annum. Upon expiry of the notice period, we shall withdraw our security personnel from your site only after the full and final settlement of all pending dues.", { align: 'justify' });
    doc.moveDown(1);
    doc.text("We hope the above-quoted terms will suit your requirements and give us an opportunity to serve you.", { align: 'justify' });
    
    // STAMP ONLY APPEARS HERE ON THE FINAL PAGE
    doc.moveDown(2);
    if (stampPath) {
        doc.image(stampPath, 420, doc.y, { width: 100 });
    } else {
        doc.moveDown(3);
        doc.font('Helvetica-Bold').text("For DYNAMIC SECURITY AND MANPOWER SERVICES PVT. LTD.", 250, doc.y, { align: 'right', width: 295 });
        doc.moveDown(3);
        doc.text("Authorized Signatory", 300, doc.y, { align: 'right', width: 245 });
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Failed to generate PDF" });
  }
}

module.exports = { getQuotations, saveQuotation, downloadQuotationPdf };