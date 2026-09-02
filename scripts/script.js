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

document.addEventListener('DOMContentLoaded', function() {
    const trigger = document.getElementById('strategiesTrigger');
    const menu = document.getElementById('strategiesMenu');
    const options = document.querySelectorAll('.option');
    const tagsContainer = document.getElementById('selectedTags');
    
    let selectedData = []; // To store { value, text } objects

    // Toggle menu
    trigger.addEventListener('click', function(e) {
        menu.classList.toggle('hidden');
        e.stopPropagation();
    });

    // Handle Option Clicks
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            const val = this.getAttribute('data-value');
            const text = this.innerText;
            
            // Check if already selected
            const index = selectedData.findIndex(item => item.value === val);

            if (index > -1) {
                // Remove if already there
                this.classList.remove('selected');
                selectedData.splice(index, 1);
            } else {
                // Add if new
                this.classList.add('selected');
                selectedData.push({ value: val, text: text });
            }

            renderTags();
            e.stopPropagation();
        });
    });

    // Function to draw the tags in the box
    function renderTags() {
        if (selectedData.length === 0) {
            tagsContainer.innerHTML = '<span class="placeholder">Select strategies...</span>';
        } else {
            tagsContainer.innerHTML = ''; // Clear container
            selectedData.forEach(item => {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.innerText = item.text;
                tagsContainer.appendChild(tag);
            });
        }
    }

    // Close menu when clicking outside
    document.addEventListener('click', function() {
        menu.classList.add('hidden');
    });
});

function saveProcurementRequest() {
    // 1. Collect the data from all steps
    const newRequest = {
        id: Date.now(), // Unique ID for tracking
        ppmp_no: document.getElementById('ppmp_no').value || "N/A",
        project_title: "New Procurement Activity", // You can add a Title input to Step 1
        end_user: document.getElementById('end_user').value || "N/A",
        mode: document.getElementById('modeOfProcurement').value || "TBD",
        budget: document.getElementById('budget_input')?.value || "0.00",
        status: "Pending", // Default status
        date_created: new Date().toLocaleDateString()
    };

    // 2. Get existing data from localStorage or start a new array
    const existingRequests = JSON.parse(localStorage.getItem('procurement_records')) || [];

    // 3. Add the new request to the list
    existingRequests.push(newRequest);

    // 4. Save back to localStorage
    localStorage.setItem('procurement_records', JSON.stringify(existingRequests));

    // 5. Redirect to Dashboard
    alert("Request Saved Successfully!");
    window.location.href = "dashboard.html";
}