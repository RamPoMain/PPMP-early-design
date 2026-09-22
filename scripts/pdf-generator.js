async function generatePPMP_PDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // 1. COLLECT DATA (Safely)
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "N/A";

    const data = {
        ppmp: getVal('ppmp_no'),
        type: getVal('is_indicative'),
        year: getVal('fiscal_year'),
        unit: getVal('end_user')
    };

    // The Export PDF button only ever appears once a saved PPMP is open in
    // the modal (see loadRecordIntoModal), so pull every line item that
    // belongs to it from storage — not just whichever single item happens
    // to be on screen — so the export matches the real, multi-item PPMP.
    let items = [];
    if (typeof currentEditingId !== 'undefined' && currentEditingId && typeof getRecords === 'function') {
        const record = getRecords().find(r => r.id == currentEditingId);
        if (record) {
            items = typeof getRecordItems === 'function' ? getRecordItems(record) : [record];
        }
    }
    if (items.length === 0) {
        // Fallback (shouldn't normally happen): use whatever is currently
        // on screen as a single-item PDF.
        items = [{
            project_description: getVal('project_description'),
            project_type: getVal('project_type'),
            quantity_size: getVal('quantity_size'),
            mode: getVal('modeOfProcurement'),
            pre_procurement: getVal('pre_procurement'),
            start_date: getVal('start_date'),
            end_date: getVal('end_date'),
            delivery_period: getVal('delivery_period'),
            fund_source: getVal('fund_source'),
            budget: getVal('budget'),
            strategies: typeof selectedStrategies !== 'undefined' ? selectedStrategies : [],
            remarks: getVal('remarks')
        }];
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;

    // 2. LOAD HEADER IMAGE
    let currentY = 25;
    try {
        // We fetch the image from your local folder as a "Blob"
        const response = await fetch('images/header-banner.png');
        const blob = await response.blob();
        
        // We convert that Blob into a temporary URL the PDF generator can use
        const imgData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        const imgWidth = pageWidth - 20;
        const imgHeight = 28; // Adjust height to match your banner ratio
        
        doc.addImage(imgData, 'PNG', margin, 5, imgWidth, imgHeight);
        currentY = imgHeight + 15;
    } catch (e) {
        console.error("Image loading failed:", e);
        // If it fails, start lower so the text doesn't overlap a missing image
        currentY = 30; 
    }
    
    // 3. LOGOS AND HEADERS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. ${data.ppmp}`, pageWidth / 2, currentY, { align: "center" });

    currentY += 6;
    doc.setFontSize(9);
    doc.rect(130, currentY - 3, 4, 4); 
    if(data.type === "Indicative") doc.text("X", 131, currentY);
    doc.text("INDICATIVE", 136, currentY);

    doc.rect(165, currentY - 3, 4, 4);
    if(data.type === "Final") doc.text("X", 166, currentY);
    doc.text("FINAL", 171, currentY);

    currentY += 10;
    doc.setFontSize(10);
    doc.text(`Fiscal Year : ${data.year}`, margin, currentY);
    doc.text(`End-User or Implementing Unit:  ${data.unit}`, margin, currentY + 5);

    // 4. PREPARE TABLE DATA
    // Clean each item's budget string (remove commas/spaces) so toLocaleString works
    const parseBudget = (raw) => parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
    const totalBudget = items.reduce((sum, item) => sum + parseBudget(item.budget), 0);
    const formattedTotal = totalBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 });

    const headers = [
        [
            { content: 'PROCUREMENT PROJECT DETAILS', colSpan: 5, styles: { halign: 'center' } },
            { content: 'PROJECTED TIMELINE (MM/YYYY)', colSpan: 3, styles: { halign: 'center' } },
            { content: 'FUNDING DETAILS', colSpan: 2, styles: { halign: 'center' } },
            { content: 'ATTACHED SUPPORTING DOCUMENTS', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'REMARKS', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
        ],
        [
            'General Description and Objective of the Project to be Procured', // Col 1
            'Type of the Project to be Procured', // Col 2
            'Quantity and Size of the Project to be Procured', // Col 3
            'Recommended Mode of Procurement', // Col 4
            'Pre-Procurement Conference (Yes/No)', // Col 5
            'Start of Procurement Activity', // Col 6
            'End of Procurement Activity', // Col 7
            'Expected Delivery/ Implementation Period', // Col 8
            'Source of Funds', // Col 9
            'Estimated Budget / Authorized Budgetary Allocation (PhP)' // Col 10
        ],
        ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5', 'Column 6', 'Column 7', 'Column 8', 'Column 9', 'Column 10', 'Column 11', 'Column 12']
    ];

    const itemRows = items.map(item => {
        const formattedBudget = parseBudget(item.budget).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        const strategiesStr = Array.isArray(item.strategies) ? item.strategies.join(", ") : (item.strategies || "");

        return [
            item.project_description || '',   // Col 1
            item.project_type || '',          // Col 2
            item.quantity_size || '',         // Col 3
            item.mode || '',                  // Col 4
            item.pre_procurement || '',       // Col 5
            item.start_date || '',            // Col 6
            item.end_date || '',              // Col 7
            item.delivery_period || '',       // Col 8
            item.fund_source || '',           // Col 9
            `P ${formattedBudget}`,           // Col 10
            strategiesStr,                    // Col 11
            item.remarks || ''                // Col 12
        ];
    });

    const rows = [
        ...itemRows,
        // Summary Total Row
        [
            { content: 'TOTAL BUDGET:', colSpan: 9, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: `P ${formattedTotal}`, styles: { fontStyle: 'bold' } },
            '',
            ''
        ]
    ];

    doc.autoTable({
        startY: currentY + 10,
        head: headers,
        body: rows,
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 2, textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.1 },
        headStyles: { fillColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 40 }, 
            2: { cellWidth: 35 }, 
            9: { cellWidth: 25 }, 
            10: { cellWidth: 30 } 
        }
    });

    // 5. SIGNATORIES
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(7);
    
    // Left: Prepared By
    doc.text("Prepared by / Submitted by:", margin, finalY);
    doc.line(margin, finalY + 10, margin + 60, finalY + 10);
    doc.setFont("helvetica", "bold");
    doc.text("JAYMARK D. DUMIO", margin + 30, finalY + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Signature over Printed Name", margin + 30, finalY + 18, { align: "center" });
    doc.text("Focal, ICT Literacy Competency and Development Bureau X", margin + 30, finalY + 22, { align: "center" });
    doc.text("Date: " + new Date().toLocaleDateString(), margin + 30, finalY + 30, { align: "center" });

    // Center: Certified Funds
    doc.text("Certified Funds Available:", pageWidth / 2 - 30, finalY);
    doc.line(pageWidth / 2 - 35, finalY + 10, pageWidth / 2 + 25, finalY + 10);
    doc.setFont("helvetica", "bold");
    doc.text("BRYAN JOHN M. SABLAS", pageWidth / 2 - 5, finalY + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Signature over Printed Name", pageWidth / 2 - 5, finalY + 18, { align: "center" });
    doc.text("Budget Officer II", pageWidth / 2 - 5, finalY + 22, { align: "center" });

    // Right: Approved By
    doc.text("Approved by:", pageWidth - 70, finalY);
    doc.line(pageWidth - 70, finalY + 10, pageWidth - margin, finalY + 10);
    doc.setFont("helvetica", "bold");
    doc.text("SITTIE RAHMA V. ALAWI, MTM, CSSGB", pageWidth - 35, finalY + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Signature over Printed Name", pageWidth - 35, finalY + 18, { align: "center" });
    doc.text("Regional Director, DICT X", pageWidth - 35, finalY + 22, { align: "center" });

    // Bottom Left: Endorsed By
    const endorseY = finalY + 45;
    doc.text("Endorsed by:", margin, endorseY);
    doc.line(margin, endorseY + 10, margin + 60, endorseY + 10);
    doc.setFont("helvetica", "bold");
    doc.text("EUGENE C. RAPOSALA III", margin + 30, endorseY + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Signature over Printed Name", margin + 30, endorseY + 18, { align: "center" });
    doc.text("Chief, Technical Operations Division", margin + 30, endorseY + 22, { align: "center" });

    doc.save(`PPMP_${data.ppmp}_${data.unit}.pdf`);
}