// --- 1. MULTI-STEP NAVIGATION LOGIC ---
function showNextStep() { // Step 1 to 2
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROJECTED TIMELINE";
    document.getElementById('progress-fill').style.width = "45%";
    window.scrollTo(0,0);
}

function showStep3() { // Step 2 to 3
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');
    document.getElementById('page-title').innerText = "FUNDING DETAILS";
    document.getElementById('progress-fill').style.width = "85%";
    window.scrollTo(0,0);
}

function showStep1() { // Back to 1
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROCUREMENT PROJECT DETAILS";
    document.getElementById('progress-fill').style.width = "15%";
    window.scrollTo(0,0);
}

function showStep2() { // Back to 2
    document.getElementById('step-3').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROJECTED TIMELINE";
    document.getElementById('progress-fill').style.width = "45%";
    window.scrollTo(0,0);
}

// --- 2. CUSTOM MULTI-SELECT LOGIC ---
let selectedStrategies = []; // Global array to track choices

document.addEventListener('DOMContentLoaded', function() {
    const trigger = document.getElementById('strategiesTrigger');
    const menu = document.getElementById('strategiesMenu');
    const options = document.querySelectorAll('.option');
    const tagsContainer = document.getElementById('selectedTags');

    if (trigger) {
        // Toggle Menu
        trigger.addEventListener('click', (e) => {
            menu.classList.toggle('hidden');
            e.stopPropagation();
        });

        // Toggle Selection
        options.forEach(opt => {
            opt.addEventListener('click', function(e) {
                const val = this.getAttribute('data-value');
                const text = this.innerText;
                
                this.classList.toggle('selected');

                if (this.classList.contains('selected')) {
                    selectedStrategies.push({ val, text });
                } else {
                    selectedStrategies = selectedStrategies.filter(item => item.val !== val);
                }
                
                renderTags(tagsContainer);
                e.stopPropagation();
            });
        });

        // Close menu if clicked outside
        document.addEventListener('click', () => menu.classList.add('hidden'));
    }

    // --- 3. MODE OF PROCUREMENT ERROR HANDLING ---
    const modeSelect = document.getElementById('modeOfProcurement');
    if (modeSelect) {
        modeSelect.addEventListener('change', function() {
            if (this.value !== "") {
                document.getElementById('modeWrapper').classList.remove('error-state');
                document.getElementById('modeErrorMsg').classList.add('hidden');
            }
        });
    }
});

function renderTags(container) {
    if (selectedStrategies.length === 0) {
        container.innerHTML = '<span class="placeholder">Select strategies...</span>';
        return;
    }
    container.innerHTML = selectedStrategies.map(s => `<span class="tag">${s.text}</span>`).join('');
}

// --- 4. DATA SAVING LOGIC (JSON + LOCALSTORAGE) ---
function saveProcurementRequest() {
    // Collect every ID from the forms
    const newEntry = {
        id: Date.now(),
        ppmp_no: document.getElementById('ppmp_no').value || "N/A",
        is_indicative: document.getElementById('is_indicative').value,
        end_user: document.getElementById('end_user').value || "N/A",
        fiscal_year: document.getElementById('fiscal_year').value || "N/A",
        project_type: document.getElementById('project_type').value,
        unit: document.getElementById('end_user_unit').value,
        mode: document.getElementById('modeOfProcurement').options[document.getElementById('modeOfProcurement').selectedIndex].text || "TBD",
        pre_conference: document.getElementById('pre_procurement_conference').value,
        
        // Step 2 Data
        start_date: document.getElementById('procurement_start').value || "N/A",
        end_date: document.getElementById('procurement_end').value || "N/A",
        delivery: document.getElementById('delivery_period').value || "N/A",
        funds_source: document.getElementById('source_of_funds').value || "N/A",
        budget: document.getElementById('budget_input').value || "0.00",
        
        // Step 3 Data
        strategies: selectedStrategies.map(s => s.text), // Array of strings
        remarks: document.getElementById('remarks')?.value || "",
        
        status: "Pending", // Default status
        date_filed: new Date().toLocaleDateString()
    };

    // Get existing data from storage
    const database = JSON.parse(localStorage.getItem('procurement_records')) || [];
    database.push(newEntry);
    
    // Save back to storage
    localStorage.setItem('procurement_records', JSON.stringify(database));

    alert("Success! Your procurement request has been recorded.");
    window.location.href = "index.html"; // Redirect to dashboard
}