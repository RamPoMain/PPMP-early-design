// ============================================================
// PROCUREMENT REQUEST FORM SCRIPT
// ============================================================
// Features:
// - Step navigation
// - Required field validation
// - Inline validation errors (NO browser alerts)
// - PPMP number auto-increment
// - Number-only restrictions
// - Fiscal year validation
// - Budget validation
// - Date validation
// - Procurement strategy multi-select
// - Supporting document upload
// - File size validation
// - File preview
// - View existing procurement records
// - LocalStorage saving
// ============================================================


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let selectedStrategies = [];
let uploadedFiles = [];
let uploadIdCounter = 0;

let isViewMode = false;

const MAX_FILE_SIZE = 2 * 1024 * 1024;   // 2MB per file
const MAX_TOTAL_SIZE = 8 * 1024 * 1024;  // 8MB total


// ============================================================
// NAVIGATION LOGIC
// ============================================================

function showNextStep() {

    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');

    document.getElementById('page-title').innerText =
        "PROJECTED TIMELINE";

    document.getElementById('progress-fill').style.width =
        "45%";
}


function showStep3() {

    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');

    document.getElementById('page-title').innerText =
        "FUNDING DETAILS";

    document.getElementById('progress-fill').style.width =
        "85%";
}


function showStep1() {

    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');

    document.getElementById('page-title').innerText =
        "PROCUREMENT PROJECT DETAILS";

    document.getElementById('progress-fill').style.width =
        "15%";
}


function showStep2() {

    document.getElementById('step-3').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');

    document.getElementById('page-title').innerText =
        "PROJECTED TIMELINE";

    document.getElementById('progress-fill').style.width =
        "45%";
}


// ============================================================
// FIELD HELPERS
// ============================================================

function getFieldGroup(fieldName) {

    return document.querySelector(
        `.field-group[data-field="${fieldName}"]`
    );
}


// ============================================================
// INLINE ERROR MESSAGE
// ============================================================

function showFieldError(fieldName, message) {

    const group = getFieldGroup(fieldName);

    if (!group) return;

    group.classList.add('error-state');

    // Reuse the .field-error-msg element that's already in the HTML for
    // this field-group instead of creating a second, separate message.
    let errorMessage =
        group.querySelector('.field-error-msg');

    if (!errorMessage) {

        errorMessage =
            document.createElement('p');

        errorMessage.className =
            'field-error-msg';

        group.appendChild(errorMessage);
    }

    // Remember the default markup text the first time so it can be
    // restored later instead of permanently overwriting it.
    if (errorMessage.dataset.defaultText === undefined) {
        errorMessage.dataset.defaultText = errorMessage.textContent;
    }

    errorMessage.textContent = message;
}


function clearFieldError(fieldName) {

    const group = getFieldGroup(fieldName);

    if (!group) return;

    group.classList.remove('error-state');

    const errorMessage =
        group.querySelector('.field-error-msg');

    if (errorMessage && errorMessage.dataset.defaultText !== undefined) {
        errorMessage.textContent = errorMessage.dataset.defaultText;
    }
}


function clearAllFieldErrors() {

    document
        .querySelectorAll('.field-group')
        .forEach(group => {

            group.classList.remove('error-state');

            const errorMessage =
                group.querySelector('.field-error-msg');

            if (errorMessage && errorMessage.dataset.defaultText !== undefined) {
                errorMessage.textContent = errorMessage.dataset.defaultText;
            }
        });
}


// ============================================================
// PPMP NUMBER AUTO-INCREMENT
// ============================================================

function getNextPpmpNumber() {

    const records =
        JSON.parse(
            localStorage.getItem('procurement_records')
        ) || [];

    let highestNumber = 0;

    records.forEach(record => {

        const number =
            parseInt(record.ppmp_no, 10);

        if (
            !isNaN(number) &&
            number > highestNumber
        ) {
            highestNumber = number;
        }
    });

    return highestNumber + 1;
}


function initializePpmpNumber() {

    const ppmpField =
        document.getElementById('ppmp_no');

    if (!ppmpField) return;

    // Do not change PPMP number when viewing a record
    if (isViewMode) return;

    const viewId =
        sessionStorage.getItem('view_record_id');

    if (viewId) return;

    ppmpField.value =
        getNextPpmpNumber();

    // User should not manually change the generated number
    ppmpField.readOnly = true;
}


// ============================================================
// NUMBER-ONLY INPUT RESTRICTIONS
// ============================================================

function restrictNumberOnly(fieldId) {

    const field =
        document.getElementById(fieldId);

    if (!field) return;

    field.addEventListener('input', function () {

        const originalValue =
            this.value;

        const cleanedValue =
            originalValue.replace(/\D/g, '');

        if (originalValue !== cleanedValue) {
            this.value = cleanedValue;
        }
    });
}


function restrictDecimalNumber(fieldId) {

    const field =
        document.getElementById(fieldId);

    if (!field) return;

    field.addEventListener('input', function () {

        let value =
            this.value;

        // Allow numbers and decimal point only
        value =
            value.replace(/[^0-9.]/g, '');

        // Only allow one decimal point
        const parts =
            value.split('.');

        if (parts.length > 2) {

            value =
                parts[0] + '.' + parts.slice(1).join('');
        }

        this.value = value;
    });
}


// ============================================================
// PROCUREMENT STRATEGY MULTI-SELECT
// ============================================================

function renderTags(container) {

    if (!container) return;

    if (selectedStrategies.length === 0) {

        container.innerHTML =
            '<span class="placeholder">Select strategies...</span>';

    } else {

        container.innerHTML =
            selectedStrategies
                .map(strategy =>
                    `<span class="tag">${strategy}</span>`
                )
                .join('');
    }
}


function removeStrategy(strategy) {

    selectedStrategies =
        selectedStrategies.filter(
            item => item !== strategy
        );

    renderTags(
        document.getElementById('selectedTags')
    );

    if (selectedStrategies.length > 0) {
        clearFieldError('procurement_strategies');
    }
}


function initializeStrategies() {

    const trigger =
        document.getElementById('strategiesTrigger');

    const menu =
        document.getElementById('strategiesMenu');

    const tagsContainer =
        document.getElementById('selectedTags');

    if (!trigger || !menu) return;

    const options =
        document.querySelectorAll('.option');


    // Open / close menu
    trigger.onclick = function (event) {

        event.stopPropagation();

        menu.classList.toggle('hidden');
    };


    // Strategy options
    options.forEach(option => {

        option.onclick = function (event) {

            event.stopPropagation();

            const text =
                this.innerText.trim();

            this.classList.toggle('selected');


            if (this.classList.contains('selected')) {

                if (
                    !selectedStrategies.includes(text)
                ) {
                    selectedStrategies.push(text);
                }

            } else {

                selectedStrategies =
                    selectedStrategies.filter(
                        item => item !== text
                    );
            }


            renderTags(tagsContainer);


            if (selectedStrategies.length > 0) {

                clearFieldError(
                    'procurement_strategies'
                );
            }
        };
    });


    // Close menu when clicking outside
    document.addEventListener('click', function () {

        menu.classList.add('hidden');
    });
}


// ============================================================
// VIEW MODE
// ============================================================

function loadRecordForViewing(id) {

    const records =
        JSON.parse(
            localStorage.getItem('procurement_records')
        ) || [];

    const data =
        records.find(
            record => record.id == id
        );

    if (!data) return;

    isViewMode = true;


    // --------------------------------------------------------
    // Fill all fields
    // --------------------------------------------------------

    const fields = {

        'ppmp_no':
            data.ppmp_no,

        'is_indicative':
            data.is_indicative,

        'end_user':
            data.end_user,

        'fiscal_year':
            data.fiscal_year,

        'project_type':
            data.project_type,

        'modeOfProcurement':
            data.mode,

        'pre_procurement':
            data.pre_procurement,

        'quantity_size':
            data.quantity_size,

        'start_date':
            data.start_date,

        'end_date':
            data.end_date,

        'delivery_period':
            data.delivery_period,

        'fund_source':
            data.fund_source,

        'budget':
            data.budget,

        'remarks':
            data.remarks
    };


    Object.keys(fields).forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {

            element.value =
                fields[id] || '';
        }
    });


    // --------------------------------------------------------
    // Restore procurement strategies
    // --------------------------------------------------------

    selectedStrategies =
        data.strategies || [];

    renderTags(
        document.getElementById('selectedTags')
    );


    // --------------------------------------------------------
    // Restore uploaded documents
    // --------------------------------------------------------

    if (
        data.supporting_documents &&
        data.supporting_documents.length
    ) {

        const listEl =
            document.getElementById(
                'uploadedFileList'
            );

        if (listEl) {

            listEl.innerHTML =
                data.supporting_documents
                    .map(doc => {

                        const isLegacy =
                            typeof doc === 'string';

                        const name =
                            isLegacy
                                ? doc
                                : doc.name;

                        const size =
                            isLegacy
                                ? null
                                : doc.size;

                        const url =
                            (
                                !isLegacy &&
                                doc.dataUrl
                            )
                                ? base64DataUrlToObjectUrl(
                                    doc.dataUrl
                                )
                                : null;


                        const nameHtml =
                            url
                                ? `
                                    <a
                                        class="uploaded-file-name"
                                        href="${url}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Click to view ${name}"
                                    >
                                        ${name}
                                    </a>
                                  `
                                : `
                                    <span
                                        class="uploaded-file-name"
                                    >
                                        ${name}
                                    </span>
                                  `;


                        const sizeHtml =
                            size
                                ? `
                                    <span
                                        class="uploaded-file-size"
                                    >
                                        ${formatFileSize(size)}
                                    </span>
                                  `
                                : '';


                        return `
                            <li class="uploaded-file-item">
                                <div class="uploaded-file-info">
                                    ${nameHtml}
                                    ${sizeHtml}
                                </div>
                            </li>
                        `;
                    })
                    .join('');
        }


        const zoneForDisplay =
            document.getElementById(
                'uploadZone'
            );

        if (zoneForDisplay) {

            zoneForDisplay.classList.add(
                'has-file'
            );
        }
    }


    // --------------------------------------------------------
    // Lock all form fields
    // --------------------------------------------------------

    document
        .querySelectorAll(
            'input, select, textarea'
        )
        .forEach(element => {

            element.disabled = true;

            element.style.background = '#eee';
        });


    const strategyElement =
        document.getElementById(
            'procurement_strategies'
        );

    if (strategyElement) {

        strategyElement.classList.add(
            'hidden-pointer'
        );
    }


    const modeWrapper =
        document.getElementById(
            'modeWrapper'
        );

    if (modeWrapper) {

        modeWrapper.classList.remove(
            'error-state'
        );
    }


    const modeErrorMsg =
        document.getElementById(
            'modeErrorMsg'
        );

    if (modeErrorMsg) {

        modeErrorMsg.classList.add(
            'hidden'
        );
    }


    // --------------------------------------------------------
    // Update page title
    // --------------------------------------------------------

    const pageTitle =
        document.getElementById(
            'page-title'
        );

    if (pageTitle) {

        pageTitle.innerText =
            'VIEWING REQUEST: ' +
            data.ppmp_no;
    }


    // --------------------------------------------------------
    // Disable upload zone
    // --------------------------------------------------------

    const zone =
        document.getElementById(
            'uploadZone'
        );

    if (zone) {

        zone.style.pointerEvents =
            'none';
    }


    // --------------------------------------------------------
    // Clear validation errors
    // --------------------------------------------------------

    clearAllFieldErrors();


    // --------------------------------------------------------
    // Change Finish button
    // --------------------------------------------------------

    const finishBtn =
        document.getElementById(
            'finishBtn'
        );

    if (finishBtn) {

        finishBtn.innerText =
            'Back to Dashboard';

        finishBtn.onclick =
            function () {

                window.location.href =
                    'index.html';
            };
    }
}


// ============================================================
// SAVE PROCUREMENT REQUEST
// ============================================================

function saveProcurementRequest() {

    // Final validation before saving
    if (!validateStep('form-step-3')) {
        return;
    }

    // Belt-and-suspenders: re-verify mode/budget compliance in case the
    // form was reached without passing through the normal step flow.
    if (!validateModeBudgetMatch()) {
        return;
    }


    const entry = {

        id:
            Date.now(),

        ppmp_no:
            document.getElementById(
                'ppmp_no'
            ).value || 'N/A',

        is_indicative:
            document.getElementById(
                'is_indicative'
            ).value,

        end_user:
            document.getElementById(
                'end_user'
            ).value || 'N/A',

        fiscal_year:
            document.getElementById(
                'fiscal_year'
            ).value,

        project_type:
            document.getElementById(
                'project_type'
            ).value,

        mode:
            document.getElementById(
                'modeOfProcurement'
            ).value,

        pre_procurement:
            document.getElementById(
                'pre_procurement'
            ).value,

        quantity_size:
            document.getElementById(
                'quantity_size'
            ).value,

        start_date:
            document.getElementById(
                'start_date'
            ).value,

        end_date:
            document.getElementById(
                'end_date'
            ).value,

        delivery_period:
            document.getElementById(
                'delivery_period'
            ).value,

        fund_source:
            document.getElementById(
                'fund_source'
            ).value,

        budget:
            document.getElementById(
                'budget'
            ).value,

        strategies:
            [...selectedStrategies],

        remarks:
            document.getElementById(
                'remarks'
            ).value,

        supporting_documents:
            uploadedFiles.map(entry => ({

                name:
                    entry.file.name,

                size:
                    entry.file.size,

                dataUrl:
                    entry.dataUrl
            })),

        status:
            'Pending',

        date:
            new Date().toLocaleDateString()
    };


    const db =
        JSON.parse(
            localStorage.getItem(
                'procurement_records'
            )
        ) || [];


    db.push(entry);


    try {

        localStorage.setItem(
            'procurement_records',
            JSON.stringify(db)
        );

        // No alert.
        // Redirect directly after successful save.
        window.location.href =
            'index.html';

    } catch (err) {

        showFieldError(
            'supporting_docs',
            'This request could not be saved because the attached files are too large for browser storage. Please remove or shrink an attachment and try again.'
        );
    }
}


// ============================================================
// REQUIRED FIELD CHECK
// ============================================================

function isFieldFilled(fieldGroup) {

    const fieldName =
        fieldGroup.dataset.field;


    // Procurement strategies
    if (
        fieldName ===
        'procurement_strategies'
    ) {

        return selectedStrategies.length > 0;
    }


    // Supporting documents
    if (
        fieldName ===
        'supporting_docs'
    ) {

        return (
            uploadedFiles &&
            uploadedFiles.length > 0
        );
    }


    // Select fields
    const select =
        fieldGroup.querySelector(
            'select'
        );

    if (select) {

        return (
            select.value !== '' &&
            select.value !== null
        );
    }


    // Input / textarea
    const input =
        fieldGroup.querySelector(
            'input, textarea'
        );

    if (input) {

        return (
            input.value.trim() !== ''
        );
    }


    return true;
}


// ============================================================
// FIELD-SPECIFIC VALIDATION
// ============================================================

function validateIndividualField(fieldGroup) {

    const fieldName =
        fieldGroup.dataset.field;


    // --------------------------------------------------------
    // Required check
    // --------------------------------------------------------

    if (!isFieldFilled(fieldGroup)) {

        let message =
            'This field is required.';


        if (
            fieldName ===
            'procurement_strategies'
        ) {

            message =
                'Please select at least one procurement strategy.';
        }


        if (
            fieldName ===
            'supporting_docs'
        ) {

            message =
                'Please upload at least one supporting document.';
        }


        showFieldError(
            fieldName,
            message
        );

        return false;
    }


    // --------------------------------------------------------
    // Get input
    // --------------------------------------------------------

    const input =
        fieldGroup.querySelector(
            'input, textarea, select'
        );


    if (!input) {

        clearFieldError(fieldName);

        return true;
    }


    const value =
        input.value.trim();


    // --------------------------------------------------------
    // PPMP NUMBER
    // --------------------------------------------------------

    if (
        fieldName ===
        'ppmp_no'
    ) {

        if (!/^\d+$/.test(value)) {

            showFieldError(
                fieldName,
                'PPMP Number must contain numbers only.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // FISCAL YEAR
    // --------------------------------------------------------

    if (
        fieldName ===
        'fiscal_year'
    ) {

        if (!/^\d{4}$/.test(value)) {

            showFieldError(
                fieldName,
                'Fiscal Year must contain exactly 4 numbers.'
            );

            return false;
        }


        const year =
            parseInt(
                value,
                10
            );


        if (
            year < 2000 ||
            year > 2100
        ) {

            showFieldError(
                fieldName,
                'Fiscal Year must be between 2000 and 2100.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // END USER
    // --------------------------------------------------------

    if (
        fieldName ===
        'end_user'
    ) {

        if (value.length < 2) {

            showFieldError(
                fieldName,
                'End User must contain at least 2 characters.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // QUANTITY / SIZE
    // --------------------------------------------------------

    if (
        fieldName ===
        'quantity_size'
    ) {

        if (value.length < 3) {

            showFieldError(
                fieldName,
                'Please provide a more detailed quantity or size.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // FUND SOURCE
    // --------------------------------------------------------

    if (
        fieldName ===
        'fund_source'
    ) {

        if (value.length < 2) {

            showFieldError(
                fieldName,
                'Please provide a valid fund source.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // REMARKS
    // --------------------------------------------------------

    if (
        fieldName ===
        'remarks'
    ) {

        if (value.length < 3) {

            showFieldError(
                fieldName,
                'Remarks must contain at least 3 characters.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // BUDGET
    // --------------------------------------------------------

    if (
        fieldName ===
        'budget'
    ) {

        const numericValue =
            parseFloat(
                value.replace(/,/g, '')
            );


        if (
            isNaN(numericValue)
        ) {

            showFieldError(
                fieldName,
                'Budget must contain a valid number.'
            );

            return false;
        }


        if (
            numericValue <= 0
        ) {

            showFieldError(
                fieldName,
                'Budget must be greater than 0.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // Delivery period
    // --------------------------------------------------------

    if (
        fieldName ===
        'delivery_period'
    ) {

        if (value.length < 1) {

            showFieldError(
                fieldName,
                'Please specify the delivery period.'
            );

            return false;
        }
    }


    // --------------------------------------------------------
    // Everything passed
    // --------------------------------------------------------

    clearFieldError(fieldName);

    return true;
}


// ============================================================
// RECOMMENDED MODE OF PROCUREMENT (BUDGET-BASED)
// ============================================================

const MODE_BUDGET_BRACKETS = [
    { max: 200000, mode: 'Direct Acquisition', label: '₱0 – ₱200,000' },
    { max: 2000000, mode: 'Small Value Procurement (SVP)', label: '₱200,001 – ₱2,000,000' },
    { max: Infinity, mode: 'Competitive Bidding', label: 'Above ₱2,000,000' }
];


function getRecommendedMode(budgetNumber) {

    const bracket =
        MODE_BUDGET_BRACKETS.find(
            tier => budgetNumber <= tier.max
        );

    return bracket
        ? bracket
        : MODE_BUDGET_BRACKETS[MODE_BUDGET_BRACKETS.length - 1];
}


function formatPeso(amount) {

    return '₱' +
        amount.toLocaleString('en-PH', {
            maximumFractionDigits: 2
        });
}


// Cross-checks the selected Mode of Procurement (Step 1) against the
// Estimated Budget (Step 2). Only runs once BOTH fields have a value —
// each field's own required/format validation is left to handle empties
// and malformed input. Returns true when there's nothing to block on.
function validateModeBudgetMatch() {

    const modeSelect =
        document.getElementById('modeOfProcurement');

    const budgetInput =
        document.getElementById('budget');

    if (!modeSelect || !budgetInput) {
        return true;
    }

    const modeValue =
        modeSelect.value;

    const budgetRaw =
        budgetInput.value.trim();

    if (!modeValue || !budgetRaw) {
        return true;
    }

    const budgetNumber =
        parseFloat(budgetRaw.replace(/,/g, ''));

    // Malformed/non-positive budget is already flagged by the field's own
    // validation — don't pile a second, conflicting message on top of it.
    if (isNaN(budgetNumber) || budgetNumber <= 0) {
        return true;
    }

    const recommended =
        getRecommendedMode(budgetNumber);

    if (modeValue !== recommended.mode) {

        const message =
            `Budget of ${formatPeso(budgetNumber)} falls in the ${recommended.label} bracket, ` +
            `which requires "${recommended.mode}". Please change the Mode of ` +
            `Procurement or adjust the Estimated Budget so they match.`;

        showFieldError('modeOfProcurement', message);
        showFieldError('budget', message);

        return false;
    }

    clearFieldError('modeOfProcurement');
    clearFieldError('budget');

    return true;
}


// ============================================================
// DATE VALIDATION
// ============================================================

function validateDates(container) {

    const startGroup =
        getFieldGroup(
            'start_date'
        );

    const endGroup =
        getFieldGroup(
            'end_date'
        );


    if (!startGroup || !endGroup) {
        return true;
    }


    const startInput =
        startGroup.querySelector(
            'input'
        );

    const endInput =
        endGroup.querySelector(
            'input'
        );


    if (!startInput || !endInput) {
        return true;
    }


    const startDate =
        startInput.value;

    const endDate =
        endInput.value;


    let valid = true;


    // Start date
    if (!startDate) {

        showFieldError(
            'start_date',
            'Please select a start date.'
        );

        valid = false;

    } else {

        clearFieldError(
            'start_date'
        );
    }


    // End date
    if (!endDate) {

        showFieldError(
            'end_date',
            'Please select an end date.'
        );

        valid = false;

    } else {

        clearFieldError(
            'end_date'
        );
    }


    // Compare dates
    if (
        startDate &&
        endDate
    ) {

        const start =
            new Date(
                startDate
            );

        const end =
            new Date(
                endDate
            );


        if (
            end < start
        ) {

            showFieldError(
                'end_date',
                'End date cannot be earlier than the start date.'
            );

            valid = false;
        }
    }


    return valid;
}


// ============================================================
// STEP VALIDATION
// ============================================================

function validateStep(containerId) {

    // Do not validate while viewing
    if (isViewMode) {
        return true;
    }


    const container =
        document.getElementById(
            containerId
        );


    if (!container) {
        return true;
    }


    let allValid = true;


    const fieldGroups =
        container.querySelectorAll(
            '.field-group[data-field]'
        );


    fieldGroups.forEach(
        fieldGroup => {

            const fieldValid =
                validateIndividualField(
                    fieldGroup
                );


            if (!fieldValid) {
                allValid = false;
            }
        }
    );


    // Date validation for Step 2
    if (
        containerId ===
        'form-step-2'
    ) {

        if (!validateDates(container)) {
            allValid = false;
        }
    }


    // Mode of Procurement vs. Budget cross-check.
    // Relevant whenever either field's step is being validated, since a
    // mismatch can be introduced by editing either one after the other
    // was already filled in.
    if (
        containerId === 'form-step-1' ||
        containerId === 'form-step-2'
    ) {

        if (!validateModeBudgetMatch()) {
            allValid = false;
        }
    }


    return allValid;
}


// ============================================================
// VALIDATE AND PROCEED
// ============================================================

function validateAndProceed(
    stepNumber,
    nextFn
) {

    const containerId =
        'form-step-' +
        stepNumber;


    const valid =
        validateStep(
            containerId
        );


    if (valid) {

        if (
            typeof nextFn ===
            'function'
        ) {

            nextFn();
        }

        return;
    }


    // Find first error
    const container =
        document.getElementById(
            containerId
        );


    if (!container) return;


    const firstError =
        container.querySelector(
            '.field-group.error-state'
        );


    if (firstError) {

        firstError.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}


// ============================================================
// LIVE REQUIRED FIELD VALIDATION
// ============================================================

function initRequiredFieldValidation() {

    // Input event
    document.addEventListener(
        'input',
        function (event) {

            const group =
                event.target.closest(
                    '.field-group[data-field]'
                );


            if (!group) return;


            const fieldName =
                group.dataset.field;


            // Don't clear errors blindly.
            // Re-check the field so specific errors remain.
            const fieldValid =
                validateIndividualField(
                    group
                );


            // Only re-run the cross-check once the field's own
            // validation is satisfied, so a mismatch message doesn't
            // override a more fundamental "required"/format error.
            if (
                fieldValid &&
                (
                    fieldName === 'modeOfProcurement' ||
                    fieldName === 'budget'
                )
            ) {

                validateModeBudgetMatch();
            }
        }
    );


    // Change event
    document.addEventListener(
        'change',
        function (event) {

            const group =
                event.target.closest(
                    '.field-group[data-field]'
                );


            if (!group) return;


            const fieldName =
                group.dataset.field;


            const fieldValid =
                validateIndividualField(
                    group
                );


            if (
                fieldValid &&
                (
                    fieldName === 'modeOfProcurement' ||
                    fieldName === 'budget'
                )
            ) {

                validateModeBudgetMatch();
            }
        }
    );
}


// ============================================================
// MODE OF PROCUREMENT ERROR HANDLING
// ============================================================

function initializeModeValidation() {

    const modeSelect =
        document.getElementById(
            'modeOfProcurement'
        );


    if (!modeSelect) return;


    modeSelect.onchange =
        function () {

            if (
                this.value !== ''
            ) {

                const wrapper =
                    document.getElementById(
                        'modeWrapper'
                    );

                if (wrapper) {

                    wrapper.classList.remove(
                        'error-state'
                    );
                }


                const errorMessage =
                    document.getElementById(
                        'modeErrorMsg'
                    );

                if (errorMessage) {

                    errorMessage.classList.add(
                        'hidden'
                    );
                }


                clearFieldError(
                    'modeOfProcurement'
                );
            }
        };
}


// ============================================================
// FILE SIZE FORMATTING
// ============================================================

function formatFileSize(bytes) {

    if (
        bytes <
        1024
    ) {

        return bytes +
            ' B';
    }


    if (
        bytes <
        1024 * 1024
    ) {

        return (
            bytes / 1024
        ).toFixed(1) +
            ' KB';
    }


    if (
        bytes <
        1024 * 1024 * 1024
    ) {

        return (
            bytes /
            (1024 * 1024)
        ).toFixed(1) +
            ' MB';
    }


    return (
        bytes /
        (1024 * 1024 * 1024)
    ).toFixed(2) +
        ' GB';
}


// ============================================================
// TOTAL UPLOAD SIZE
// ============================================================

function getTotalUploadedSize() {

    return uploadedFiles.reduce(
        (
            total,
            entry
        ) =>
            total +
            entry.file.size,
        0
    );
}


// ============================================================
// RENDER UPLOADED FILES
// ============================================================

function renderUploadedFiles() {

    const listEl =
        document.getElementById(
            'uploadedFileList'
        );


    if (!listEl) return;


    listEl.innerHTML = '';


    uploadedFiles.forEach(
        entry => {

            const li =
                document.createElement(
                    'li'
                );


            li.className =
                'uploaded-file-item';


            li.dataset.uploadId =
                entry.id;


            // File information
            const info =
                document.createElement(
                    'div'
                );


            info.className =
                'uploaded-file-info';


            // File link
            const link =
                document.createElement(
                    'a'
                );


            link.className =
                'uploaded-file-name';


            link.textContent =
                entry.file.name;


            link.title =
                'Click to view ' +
                entry.file.name;


            link.href =
                entry.objectUrl ||
                '#';


            link.target =
                '_blank';


            link.rel =
                'noopener noreferrer';


            // File size
            const size =
                document.createElement(
                    'span'
                );


            size.className =
                'uploaded-file-size';


            size.textContent =
                formatFileSize(
                    entry.file.size
                );


            info.appendChild(
                link
            );


            info.appendChild(
                size
            );


            // Remove button
            const removeBtn =
                document.createElement(
                    'button'
                );


            removeBtn.type =
                'button';


            removeBtn.className =
                'uploaded-file-remove';


            removeBtn.textContent =
                'Remove';


            removeBtn.onclick =
                function () {

                    removeUploadedFile(
                        entry.id
                    );
                };


            li.appendChild(
                info
            );


            li.appendChild(
                removeBtn
            );


            listEl.appendChild(
                li
            );
        }
    );


    updateUploadFieldState();
}


// ============================================================
// UPLOAD FIELD STATE
// ============================================================

function updateUploadFieldState() {

    const zone =
        document.getElementById(
            'uploadZone'
        );


    if (!zone) return;


    const group =
        zone.closest(
            '.field-group[data-field]'
        );


    if (
        uploadedFiles.length > 0
    ) {

        zone.classList.add(
            'has-file'
        );


        if (group) {

            group.classList.remove(
                'error-state'
            );
        }


        clearFieldError(
            'supporting_docs'
        );

    } else {

        zone.classList.remove(
            'has-file'
        );
    }
}


// ============================================================
// ADD FILES
// ============================================================

function addFiles(fileList) {

    Array.from(fileList)
        .forEach(file => {


            // ------------------------------------------------
            // Per-file size
            // ------------------------------------------------

            if (
                file.size >
                MAX_FILE_SIZE
            ) {

                showFieldError(
                    'supporting_docs',
                    `"${file.name}" is ${formatFileSize(file.size)}, which is over the ${formatFileSize(MAX_FILE_SIZE)} per-file limit. Please attach a smaller file.`
                );

                return;
            }


            // ------------------------------------------------
            // Total size
            // ------------------------------------------------

            if (
                getTotalUploadedSize() +
                file.size >
                MAX_TOTAL_SIZE
            ) {

                showFieldError(
                    'supporting_docs',
                    `Adding "${file.name}" would exceed the ${formatFileSize(MAX_TOTAL_SIZE)} total attachment limit for this request.`
                );

                return;
            }


            // ------------------------------------------------
            // Create upload entry
            // ------------------------------------------------

            const id =
                ++uploadIdCounter;


            const objectUrl =
                URL.createObjectURL(
                    file
                );


            const entry = {

                file,

                id,

                objectUrl,

                dataUrl:
                    null
            };


            uploadedFiles.push(
                entry
            );


            renderUploadedFiles();


            // ------------------------------------------------
            // Read file as Base64
            // ------------------------------------------------

            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    entry.dataUrl =
                        event.target.result;
                };


            reader.onerror =
                function () {

                    showFieldError(
                        'supporting_docs',
                        `The file "${file.name}" could not be read. Please try uploading it again.`
                    );
                };


            reader.readAsDataURL(
                file
            );
        });
}


// ============================================================
// REMOVE UPLOADED FILE
// ============================================================

function removeUploadedFile(id) {

    const entry =
        uploadedFiles.find(
            item =>
                item.id === id
        );


    if (
        entry &&
        entry.objectUrl
    ) {

        URL.revokeObjectURL(
            entry.objectUrl
        );
    }


    uploadedFiles =
        uploadedFiles.filter(
            item =>
                item.id !== id
        );


    renderUploadedFiles();


    if (
        uploadedFiles.length === 0
    ) {

        showFieldError(
            'supporting_docs',
            'Please upload at least one supporting document.'
        );
    }
}


// ============================================================
// BASE64 DATA URL → BLOB URL
// ============================================================

function base64DataUrlToObjectUrl(
    dataUrl
) {

    try {

        const [
            header,
            base64
        ] =
            dataUrl.split(',');


        const mimeMatch =
            header.match(
                /data:(.*?);base64/
            );


        const mime =
            mimeMatch
                ? mimeMatch[1]
                : 'application/octet-stream';


        const byteString =
            atob(base64);


        const bytes =
            new Uint8Array(
                byteString.length
            );


        for (
            let i = 0;
            i < byteString.length;
            i++
        ) {

            bytes[i] =
                byteString.charCodeAt(i);
        }


        return URL.createObjectURL(
            new Blob(
                [bytes],
                {
                    type: mime
                }
            )
        );

    } catch (err) {

        return null;
    }
}


// ============================================================
// FILE UPLOAD INITIALIZATION
// ============================================================

function initFileUpload() {

    const uploadZoneEl =
        document.getElementById(
            'uploadZone'
        );


    const fileInputEl =
        document.getElementById(
            'fileInput'
        );


    const uploadLinkEl =
        document.getElementById(
            'uploadLink'
        );


    if (
        !uploadZoneEl ||
        !fileInputEl
    ) {
        return;
    }


    // --------------------------------------------------------
    // Click upload zone
    // --------------------------------------------------------

    uploadZoneEl.addEventListener(
        'click',
        function () {

            if (isViewMode) return;

            fileInputEl.click();
        }
    );


    // --------------------------------------------------------
    // Upload link
    // --------------------------------------------------------

    if (uploadLinkEl) {

        uploadLinkEl.addEventListener(
            'click',
            function (event) {

                event.stopPropagation();

                if (isViewMode) return;

                fileInputEl.click();
            }
        );
    }


    // --------------------------------------------------------
    // File input change
    // --------------------------------------------------------

    fileInputEl.addEventListener(
        'change',
        function (event) {

            if (
                event.target.files &&
                event.target.files.length
            ) {

                addFiles(
                    event.target.files
                );
            }


            // Reset input so same file can
            // be selected again if necessary
            fileInputEl.value = '';
        }
    );


    // --------------------------------------------------------
    // Drag enter / drag over
    // --------------------------------------------------------

    [
        'dragenter',
        'dragover'
    ].forEach(
        eventName => {

            uploadZoneEl.addEventListener(
                eventName,
                function (event) {

                    if (isViewMode) return;

                    event.preventDefault();
                    event.stopPropagation();

                    uploadZoneEl.classList.add(
                        'drag-over'
                    );
                }
            );
        }
    );


    // --------------------------------------------------------
    // Drag leave
    // --------------------------------------------------------

    [
        'dragleave',
        'dragend'
    ].forEach(
        eventName => {

            uploadZoneEl.addEventListener(
                eventName,
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    uploadZoneEl.classList.remove(
                        'drag-over'
                    );
                }
            );
        }
    );


    // --------------------------------------------------------
    // Drop
    // --------------------------------------------------------

    uploadZoneEl.addEventListener(
        'drop',
        function (event) {

            if (isViewMode) return;

            event.preventDefault();
            event.stopPropagation();

            uploadZoneEl.classList.remove(
                'drag-over'
            );


            if (
                event.dataTransfer.files &&
                event.dataTransfer.files.length
            ) {

                addFiles(
                    event.dataTransfer.files
                );
            }
        }
    );
}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    function () {


        // ----------------------------------------------------
        // Check View Mode FIRST
        // ----------------------------------------------------

        const viewId =
            sessionStorage.getItem(
                'view_record_id'
            );


        if (viewId) {

            // Load existing record
            loadRecordForViewing(
                viewId
            );

            // Do not initialize a new PPMP number
            // when viewing
        }


        // ----------------------------------------------------
        // New request PPMP number
        // ----------------------------------------------------

        else {

            initializePpmpNumber();
        }


        // ----------------------------------------------------
        // Strategies
        // ----------------------------------------------------

        initializeStrategies();


        // ----------------------------------------------------
        // Mode validation
        // ----------------------------------------------------

        initializeModeValidation();


        // ----------------------------------------------------
        // Required validation
        // ----------------------------------------------------

        initRequiredFieldValidation();


        // ----------------------------------------------------
        // File upload
        // ----------------------------------------------------

        initFileUpload();


        // ----------------------------------------------------
        // Number-only fields
        // ----------------------------------------------------

        restrictNumberOnly(
            'ppmp_no'
        );


        restrictNumberOnly(
            'fiscal_year'
        );


        // ----------------------------------------------------
        // Budget decimal restriction
        // ----------------------------------------------------

        restrictDecimalNumber(
            'budget'
        );


        // ----------------------------------------------------
        // Initial strategy rendering
        // ----------------------------------------------------

        renderTags(
            document.getElementById(
                'selectedTags'
            )
        );
    }
);