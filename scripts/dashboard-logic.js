document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.getElementById('dashboard-table-body');
    // Load from LocalStorage
    const records = JSON.parse(localStorage.getItem('procurement_records')) || [];

    // 1. UPDATE SUMMARY CARDS
    if (document.getElementById('stat-total')) {
        document.getElementById('stat-total').innerText = records.length;
        document.getElementById('stat-pending').innerText = records.filter(r => r.status === "Pending").length;
        document.getElementById('stat-completed').innerText = records.filter(r => r.status === "Completed").length;
    }

    // 2. CLEAR PLACEHOLDER CONTENT
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // 3. HANDLE EMPTY STATE
    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #666;">No procurement records found.</td></tr>';
        return;
    }

    // 4. BUILD TABLE ROWS (Newest on top)
    records.reverse().forEach(item => {
        const row = document.createElement('tr');
        
        // We use .join(', ') to turn the strategies array into a readable string
        const strategyString = item.strategies.length > 0 ? item.strategies.join(', ') : 'None';

        row.innerHTML = `
            <td>${item.ppmp_no}</td>
            <td title="${strategyString}"><b>${item.unit}</b><br><small style="color: #888">${item.mode}</small></td>
            <td>${item.date_filed}</td>
            <td>PHP ${parseFloat(item.budget).toLocaleString()}</td>
            <td><span class="badge pending">${item.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
});s