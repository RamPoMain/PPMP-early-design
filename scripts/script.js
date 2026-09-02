function showNextStep() {
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROJECTED TIMELINE";
    document.getElementById('progress-fill').style.width = "45%";
    window.scrollTo(0,0);
}

function showStep3() {
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');
    document.getElementById('page-title').innerText = "FUNDING DETAILS";
    document.getElementById('progress-fill').style.width = "85%";
    window.scrollTo(0,0);
}

function showStep1() {
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROCUREMENT PROJECT DETAILS";
    document.getElementById('progress-fill').style.width = "15%";
    window.scrollTo(0,0);
}

function showStep2() {
    document.getElementById('step-3').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('page-title').innerText = "PROJECTED TIMELINE";
    document.getElementById('progress-fill').style.width = "45%";
    window.scrollTo(0,0);
}

document.addEventListener('DOMContentLoaded', function() {
    const modeSelect = document.getElementById('modeOfProcurement');
    const modeWrapper = document.getElementById('modeWrapper');
    const modeErrorMsg = document.getElementById('modeErrorMsg');

    if (modeSelect) {
        modeSelect.addEventListener('change', function() {
            // If the user selected anything other than the empty placeholder
            if (this.value !== "") {
                // Remove the red border class
                modeWrapper.classList.remove('error-state');
                // Hide the error message using the 'hidden' class you already have in CSS
                modeErrorMsg.classList.add('hidden');
            }
        });
    }
});

let selectedStrategies = [];

document.addEventListener('DOMContentLoaded', function() {
    const trigger = document.getElementById('strategiesTrigger');
    const menu = document.getElementById('strategiesMenu');
    const tagsContainer = document.getElementById('selectedTags');
    const options = document.querySelectorAll('.option');

    // 1. Toggle Menu
    if (trigger) {
        trigger.onclick = function(e) {
            e.stopPropagation(); // Prevents the document click listener from closing it instantly
            menu.classList.toggle('hidden');
        };
    }

    // 2. Handle Option Clicks
    options.forEach(opt => {
        opt.onclick = function(e) {
            e.stopPropagation(); // Keep menu open when selecting
            const val = this.getAttribute('data-value');
            const text = this.innerText;

            this.classList.toggle('selected');

            if (this.classList.contains('selected')) {
                selectedStrategies.push({ val, text });
            } else {
                selectedStrategies = selectedStrategies.filter(item => item.val !== val);
            }

            // Update the display tags
            if (selectedStrategies.length === 0) {
                tagsContainer.innerHTML = '<span class="placeholder">Select strategies...</span>';
            } else {
                tagsContainer.innerHTML = selectedStrategies.map(s => `<span class="tag">${s.text}</span>`).join('');
            }
        };
    });

    // 3. Close menu if clicked anywhere else
    document.addEventListener('click', function() {
        if (menu) menu.classList.add('hidden');
    });

    // 4. Mode of Procurement Disappearing Error
    const modeSelect = document.getElementById('modeOfProcurement');
    if (modeSelect) {
        modeSelect.onchange = function() {
            if(this.value !== "") {
                document.getElementById('modeWrapper').classList.remove('error-state');
                document.getElementById('modeErrorMsg').classList.add('hidden');
            }
        };
    }
});

function saveProcurementRequest() {
    const newRequest = {
        id: Date.now(),
        ppmp_no: document.getElementById('ppmp_no').value || "N/A",
        unit: document.getElementById('end_user_unit').value,
        budget: document.getElementById('budget_input').value || "0.00",
        mode: document.getElementById('modeOfProcurement').options[document.getElementById('modeOfProcurement').selectedIndex].text,
        strategies: selectedStrategies.map(s => s.text),
        status: "Pending",
        date: new Date().toLocaleDateString()
    };

    const records = JSON.parse(localStorage.getItem('procurement_records')) || [];
    records.push(newRequest);
    localStorage.setItem('procurement_records', JSON.stringify(records));

    alert("Procurement Request Saved!");
    window.location.href = "index.html"; // Go back to dashboard
}