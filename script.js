const menuBtn = document.getElementById("menu-btn");
const navLinks = document.getElementById("nav-links");
const menuBtnIcon = menuBtn.querySelector("i");

menuBtn.addEventListener("click", (e) => {
  navLinks.classList.toggle("open");

  const isOpen = navLinks.classList.contains("open");
  menuBtnIcon.setAttribute("class", isOpen ? "ri-close-line" : "ri-menu-line");
});

navLinks.addEventListener("click", (e) => {
  navLinks.classList.remove("open");
  menuBtnIcon.setAttribute("class", "ri-menu-line");
});

const scrollRevealOption = {
  distance: "50px",
  origin: "bottom",
  duration: 1000,
};

ScrollReveal().reveal(".header__container h1", {
  ...scrollRevealOption,
});
ScrollReveal().reveal(".header__container .section__description", {
  ...scrollRevealOption,
  delay: 500,
});
ScrollReveal().reveal(".header__link", {
  ...scrollRevealOption,
  delay: 1000,
});

ScrollReveal().reveal(".shop__card", {
  ...scrollRevealOption,
  interval: 500,
});

ScrollReveal().reveal(".about__content .section__header", {
  ...scrollRevealOption,
});
ScrollReveal().reveal(".about__content .section__description", {
  ...scrollRevealOption,
  delay: 500,
  interval: 500,
});
ScrollReveal().reveal(".about__stats", {
  ...scrollRevealOption,
  delay: 1500,
});

const swiper = new Swiper(".swiper", {
  loop: true,
  slidesPerView: "auto",
  spaceBetween: 20,
});

ScrollReveal().reveal(".banner__container p", {
  duration: 1000,
  interval: 500,
});



// ------------------------ File Upload Handling --------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const outputEl = document.getElementById('output');

  if (!fileInput) return;

  fileInput.addEventListener('change', handleFile, false);
  // Wire load example and run buttons
  const loadBtn = document.getElementById('loadExample');
  const runBtn = document.getElementById('runBtn');
  if (loadBtn) loadBtn.addEventListener('click', ()=>{
    const sample = "id,arrival,burst\nP1,0,4\nP2,1,3\nP3,2,1\nP4,3,2\n";
    const rows = parseCSVString(sample);
    processData(rows);
    alert('ตัวอย่างถูกโหลด');
  });
  if (runBtn) runBtn.addEventListener('click', ()=>{
    // if a file is selected, process it; otherwise alert
    if (fileInput.files && fileInput.files.length===1) {
      // re-use the file change handler by creating a new event
      handleFile({ target: { files: fileInput.files }});
    } else {
      alert('กรุณาเลือกไฟล์ .csv หรือ .xlsx ก่อน หรือกด Load Example');
    }
  });

  function handleFile(e) {
    // ensure single file
    if (e.target.files && e.target.files.length > 1) {
      alert('กรุณาอัปโหลดทีละไฟล์หนึ่งไฟล์เท่านั้น');
      return;
    }

    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      reader.onload = (evt) => {
        const text = evt.target.result;
        const rows = text.split('\n').map(r => r.trim()).filter(r => r).map(r => r.split(',').map(c => c.trim()));
        if (rows.length > 0) processData(rows);
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx') {
      if (typeof XLSX === 'undefined') {
        alert('ไลบรารี XLSX ไม่ถูกโหลด โปรดใช้ .csv หรือโหลดสคริปต์ XLSX ก่อน');
        return;
      }
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
        processData(json);
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('รองรับเฉพาะไฟล์ .csv หรือ .xlsx');
    }
  }

  function processData(data) {
    if (!data || data.length === 0) {
      outputEl.innerHTML = "<p style='color:red;'>ไม่พบข้อมูลในไฟล์</p>";
      return;
    }

    const headers = data[0].map(h => String(h).trim());
    const processIndex = headers.findIndex(h => h.toLowerCase().includes('process'));
    const arrivalIndex = headers.findIndex(h => h.toLowerCase().includes('arrival'));
    const burstIndex = headers.findIndex(h => h.toLowerCase().includes('burst'));

    if (processIndex === -1 || arrivalIndex === -1 || burstIndex === -1) {
      outputEl.innerHTML = "<p style='color:red;'>ต้องมีคอลัมน์ชื่อ 'Process', 'Arrival', และ 'Burst' ครบถ้วน</p>";
      return;
    }

    let processes = data.slice(1)
      .filter(r => r.length > Math.max(processIndex, arrivalIndex, burstIndex))
      .map(r => ({
        name: String(r[processIndex]).trim(),
        arrival: parseInt(r[arrivalIndex]),
        burst: parseInt(r[burstIndex]),
        done: false
      }))
      .filter(p => !isNaN(p.arrival) && !isNaN(p.burst) && p.burst > 0);

    if (processes.length === 0) {
      outputEl.innerHTML = "<p style='color:red;'>ไม่พบโปรเซสที่ถูกต้องหลังจากการกรอง</p>";
      return;
    }

    let time = 0;
    let completed = [];
    let totalBurst = processes.reduce((a,p)=>a+p.burst,0);

    while (completed.length < processes.length) {
      let available = processes.filter(p => !p.done && p.arrival <= time);

      if (available.length === 0) {
        let nextArrivalProcesses = processes.filter(p => !p.done);
        if (nextArrivalProcesses.length > 0) {
          let nextArrival = Math.min(...nextArrivalProcesses.map(p => p.arrival));
          if (nextArrival > time) { time = nextArrival; continue; }
        } else break;
        available = processes.filter(p => !p.done && p.arrival <= time);
      }

      available.sort((a,b)=>{
        if (a.arrival !== b.arrival) return b.arrival - a.arrival; // LCFS
        if (a.burst !== b.burst) return a.burst - b.burst; // shorter burst first
        return a.name.localeCompare(b.name);
      });

      let chosen = available[0];
      chosen.start = time;
      chosen.finish = time + chosen.burst;
      chosen.tat = chosen.finish - chosen.arrival;
      chosen.wait = chosen.start - chosen.arrival;
      chosen.rt = chosen.wait;
      chosen.done = true;
      completed.push(chosen);
      time = chosen.finish;
    }

    let avgTAT = completed.reduce((a,p)=>a+p.tat,0)/completed.length;
    let avgWT = completed.reduce((a,p)=>a+p.wait,0)/completed.length;
    let avgRT = completed.reduce((a,p)=>a+p.rt,0)/completed.length;
    let makespan = completed.length > 0 ? Math.max(...completed.map(p=>p.finish)) : 0;
    let cpuUtil = (makespan > 0) ? (totalBurst/makespan*100).toFixed(2) : 0.00;
    let throughput = (makespan > 0) ? (completed.length/makespan).toFixed(3) : 0.000;

    let html = "<h3>📊 ผลลัพธ์</h3><table><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Start</th><th>Finish</th><th>TAT</th><th>WT</th><th>RT</th></tr>";
    completed.sort((a,b)=>a.start-b.start).forEach(p=>{
      html += `<tr><td>${p.name}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.start}</td><td>${p.finish}</td><td>${p.tat}</td><td>${p.wait}</td><td>${p.rt}</td></tr>`;
    });
    html += '</table>';

    html += `<div class='result-box'>
      Avg TAT = ${avgTAT.toFixed(2)}<br>
      Avg WT = ${avgWT.toFixed(2)}<br>
      Avg RT = ${avgRT.toFixed(2)}<br>
      CPU Utilization = ${cpuUtil}%<br>
      Throughput = ${throughput} process/unit time
    </div>`;

    outputEl.innerHTML = html;
  }

  // small CSV parser for sample strings (returns rows array)
  function parseCSVString(text) {
    return text.trim().split('\n').map(r=>r.trim()).filter(Boolean).map(r=>r.split(',').map(c=>c.trim()));
  }
});
