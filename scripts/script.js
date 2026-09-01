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