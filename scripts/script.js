// NAVIGATION LOGIC
function showNextStep() {
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROJECTED TIMELINE";
    document.getElementById('progress-fill').style.width = "45%";
}
function showStep3() {
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');
    document.getElementById('page-title').innerText = "FUNDING DETAILS";
    document.getElementById('progress-fill').style.width = "85%";
}
function showStep1() {
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROCUREMENT PROJECT DETAILS";
    document.getElementById('progress-fill').style.width = "15%";
}
function showStep2() {
    document.getElementById('step-3').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROJECTED TIMELINE";
    document.getElementById('progress-fill').style.width = "45%";
}

// MULTI-SELECT LOGIC
let selectedStrategies = [];
document.addEventListener('DOMContentLoaded', function() {
    const trigger = document.getElementById('strategiesTrigger');
    const menu = document.getElementById('strategiesMenu');
    const options = document.querySelectorAll('.option');
    const tagsContainer = document.getElementById('selectedTags');

    if (trigger) {
        trigger.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); };
        options.forEach(opt => {
            opt.onclick = function(e) {
                e.stopPropagation();
                const text = this.innerText;
                this.classList.toggle('selected');
                if (this.classList.contains('selected')) {
                    selectedStrategies.push(text);
                } else {
                    selectedStrategies = selectedStrategies.filter(i => i !== text);
                }
                renderTags(tagsContainer);
            };
        });
        document.addEventListener('click', () => menu.classList.add('hidden'));
    }

    // CHECK FOR VIEW MODE
    const viewId = sessionStorage.getItem('view_record_id');
    if (viewId) loadRecordForViewing(viewId);

    // MODE ERROR DISAPPEAR
    const modeSelect = document.getElementById('modeOfProcurement');
    if (modeSelect) {
        modeSelect.onchange = function() {
            if (this.value !== "") {
                document.getElementById('modeWrapper').classList.remove('error-state');
                document.getElementById('modeErrorMsg').classList.add('hidden');
            }
        };
    }
});

function renderTags(container) {
    if (selectedStrategies.length === 0) {
        container.innerHTML = '<span class="placeholder">Select strategies...</span>';
    } else {
        container.innerHTML = selectedStrategies.map(s => `<span class="tag">${s}</span>`).join('');
    }
}

// VIEW MODE: LOAD AND LOCK
function loadRecordForViewing(id) {
    const records = JSON.parse(localStorage.getItem('procurement_records')) || [];
    const data = records.find(r => r.id == id);
    if (!data) return;

    // Fill all fields
    const fields = {
        'ppmp_no': data.ppmp_no, 'is_indicative': data.is_indicative, 'end_user': data.end_user,
        'fiscal_year': data.fiscal_year, 'project_type': data.project_type, 'modeOfProcurement': data.mode,
        'pre_procurement': data.pre_procurement, 'quantity_size': data.quantity_size,
        'start_date': data.start_date, 'end_date': data.end_date, 'delivery_period': data.delivery_period,
        'fund_source': data.fund_source, 'budget': data.budget, 'remarks': data.remarks
    };

    Object.keys(fields).forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = fields[id]; });

    selectedStrategies = data.strategies;
    renderTags(document.getElementById('selectedTags'));

    // Lock UI
    document.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = true; el.style.background = "#eee"; });
    document.getElementById('procurement_strategies').classList.add('hidden-pointer');
    document.getElementById('modeWrapper').classList.remove('error-state');
    document.getElementById('modeErrorMsg').classList.add('hidden');
    document.getElementById('page-title').innerText = "VIEWING REQUEST: " + data.ppmp_no;
    
    const finishBtn = document.getElementById('finishBtn');
    finishBtn.innerText = "Back to Dashboard";
    finishBtn.onclick = () => window.location.href = "index.html";
}

// SAVE DATA
function saveProcurementRequest() {
    const entry = {
        id: Date.now(),
        ppmp_no: document.getElementById('ppmp_no').value || "N/A",
        is_indicative: document.getElementById('is_indicative').value,
        end_user: document.getElementById('end_user').value || "N/A",
        fiscal_year: document.getElementById('fiscal_year').value,
        project_type: document.getElementById('project_type').value,
        mode: document.getElementById('modeOfProcurement').value,
        pre_procurement: document.getElementById('pre_procurement').value,
        quantity_size: document.getElementById('quantity_size').value,
        start_date: document.getElementById('start_date').value,
        end_date: document.getElementById('end_date').value,
        delivery_period: document.getElementById('delivery_period').value,
        fund_source: document.getElementById('fund_source').value,
        budget: document.getElementById('budget').value,
        strategies: selectedStrategies, // From the multi-select logic
        remarks: document.getElementById('remarks').value,
        status: "Pending",
        date: new Date().toLocaleDateString()
    };

    const db = JSON.parse(localStorage.getItem('procurement_records')) || [];
    db.push(entry);
    localStorage.setItem('procurement_records', JSON.stringify(db));
    window.location.href = "index.html";
}