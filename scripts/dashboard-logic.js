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