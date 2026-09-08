document.addEventListener('DOMContentLoaded', function() {
    const records = JSON.parse(localStorage.getItem('procurement_records')) || [];
    document.getElementById('stat-total').innerText = records.length;
    document.getElementById('stat-pending').innerText = records.filter(r => r.status === "Pending").length;
    document.getElementById('stat-completed').innerText = records.filter(r => r.status === "Completed").length;

    const tableBody = document.getElementById('dashboard-table-body');
    tableBody.innerHTML = records.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No records.</td></tr>' : '';

    [...records].reverse().forEach(req => {
        const row = `<tr><td>${req.ppmp_no}</td><td>${req.end_user}</td><td>PHP ${req.budget}</td><td><span class="badge pending">${req.status}</span></td><td><button class="view-btn" onclick="openView(${req.id})">View Details</button></td></tr>`;
        tableBody.innerHTML += row;
    });
});

function openView(id) { sessionStorage.setItem('view_record_id', id); window.location.href = 'page1.html'; }

document.addEventListener('DOMContentLoaded', function() {
    renderDashboard();
});

function renderDashboard() {
    const tableBody = document.getElementById('dashboard-table-body');
    const records = JSON.parse(localStorage.getItem('procurement_records')) || [];

    // Update stats
    document.getElementById('stat-total').innerText = records.length;
    document.getElementById('stat-pending').innerText = records.filter(r => r.status === "Pending").length;
    document.getElementById('stat-completed').innerText = records.filter(r => r.status === "Approved").length;

    tableBody.innerHTML = '';

    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#94a3b8;">No records found.</td></tr>';
        return;
    }

    [...records].reverse().forEach(req => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding:15px; border-bottom:1px solid #f1f5f9;">${req.ppmp_no}</td>
            <td style="border-bottom:1px solid #f1f5f9;"><b>${req.end_user}</b></td>
            <td style="border-bottom:1px solid #f1f5f9;">PHP ${req.budget}</td>
            <td style="border-bottom:1px solid #f1f5f9;"><span class="badge pending">${req.status}</span></td>
            <td style="border-bottom:1px solid #f1f5f9; text-align:right;">
                <button class="view-btn" onclick="openView(${req.id})">View Details</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openView(id) {
    const records = JSON.parse(localStorage.getItem('procurement_records')) || [];
    const data = records.find(r => r.id == id);
    if (!data) return;

    const modalContent = document.getElementById('modalContent');
    document.getElementById('modalTitle').innerText = "Request: " + data.ppmp_no;

    // 1. Handle Procurement Strategies Tags
    const strategyTags = data.strategies && data.strategies.length > 0 
        ? data.strategies.map(s => `<span class="view-tag">${s}</span>`).join('')
        : '<span style="color:#94a3b8; font-style:italic;">None selected</span>';

    // 2. Handle Uploaded Files (THE FIX)
    let filesHtml = '<span style="color:#94a3b8; font-style:italic;">No files attached</span>';
    
    if (data.supporting_documents && data.supporting_documents.length > 0) {
        filesHtml = '<div class="view-file-list">';
        data.supporting_documents.forEach(doc => {
            // We use the stored DataURL (Base64) as the href
            filesHtml += `
                <a href="${doc.dataUrl}" download="${doc.name}" class="view-file-link">
                    <span class="file-icon">📄</span>
                    <div class="file-info">
                        <span class="file-name">${doc.name}</span>
                        <span class="file-size">${(doc.size / 1024).toFixed(1)} KB</span>
                    </div>
                </a>`;
        });
        filesHtml += '</div>';
    }

    // 3. Injected HTML Template
    modalContent.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div class="view-item"><label>PPMP Number</label><p>${data.ppmp_no}</p></div>
            <div class="view-item"><label>Status</label><p>${data.status}</p></div>
            <div class="view-item"><label>Indicative/Final</label><p>${data.is_indicative}</p></div>
            <div class="view-item"><label>Implementing Unit</label><p>${data.end_user}</p></div>
            <div class="view-item"><label>Fiscal Year</label><p>${data.fiscal_year}</p></div>
            <div class="view-item"><label>Type of Project</label><p>${data.project_type}</p></div>
            <div class="view-item"><label>Mode of Procurement</label><p>${data.mode}</p></div>
            <div class="view-item"><label>Pre-Procurement Conference</label><p>${data.pre_procurement}</p></div>
            <div class="view-item view-full-width"><label>Quantity and Size</label><p>${data.quantity_size || 'N/A'}</p></div>
            <hr class="view-full-width" style="border:0; border-top:1px solid #f1f5f9;">
            <div class="view-item"><label>Start Date</label><p>${data.start_date || 'N/A'}</p></div>
            <div class="view-item"><label>End Date</label><p>${data.end_date || 'N/A'}</p></div>
            <div class="view-item"><label>Source of Funds</label><p>${data.fund_source || 'N/A'}</p></div>
            <div class="view-item"><label>Total Budget</label><p>PHP ${data.budget}</p></div>
            <div class="view-item view-full-width"><label>Procurement Strategies</label><div>${strategyTags}</div></div>

            <div style="grid-column: span 2; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                <label style="color:#94a3b8; font-size:10px; font-weight:700; text-transform:uppercase;">Attached Supporting Documents</label>
                <div style="margin-top:10px;">${filesHtml}</div>
            </div>

            <div style="grid-column: span 2; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                <label style="color:#94a3b8; font-size:10px; font-weight:700; text-transform:uppercase;">Remarks</label>
                <p style="font-size: 14px; margin-top:5px; line-height:1.5; color:#475569;">${data.remarks || 'No remarks provided.'}</p>
            </div>
        </div>
    `;

    document.getElementById('viewModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('viewModal').classList.add('hidden');
}

// Close on escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});