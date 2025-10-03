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

document.getElementById("fileInput").addEventListener("change", handleFile, false);

    function handleFile(e) {
      const file = e.target.files[0];
      const reader = new FileReader();
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "csv") {
        reader.onload = (evt) => {
          const text = evt.target.result;
          const rows = text.split("\n").map(r => r.trim()).filter(r => r).map(r => r.split(",").map(c => c.trim()));
          if (rows.length > 0) {
            processData(rows);
          }
        };
        reader.readAsText(file);
      } else if (ext === "xlsx") {
        reader.onload = (evt) => {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }); 
          processData(json);
        };
        reader.readAsArrayBuffer(file);
      } else {
        alert("รองรับเฉพาะไฟล์ .csv หรือ .xlsx");
      }
    }

    function processData(data) {
      if (data.length === 0) {
        document.getElementById("output").innerHTML = "<p style='color:red;'>ไม่พบข้อมูลในไฟล์</p>";
        return;
      }
      
      const headers = data[0].map(h => String(h).trim());
      const processIndex = headers.findIndex(h => h.toLowerCase().includes("process"));
      const arrivalIndex = headers.findIndex(h => h.toLowerCase().includes("arrival"));
      const burstIndex = headers.findIndex(h => h.toLowerCase().includes("burst"));
      
      if (processIndex === -1 || arrivalIndex === -1 || burstIndex === -1) {
        document.getElementById("output").innerHTML = "<p style='color:red;'>ต้องมีคอลัมน์ชื่อ 'Process', 'Arrival', และ 'Burst' ครบถ้วน</p>";
        return;
      }

      // โคลนข้อมูลเพื่อไม่ให้กระทบกับข้อมูลต้นฉบับและง่ายต่อการคำนวณ
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
        document.getElementById("output").innerHTML = "<p style='color:red;'>ไม่พบโปรเซสที่ถูกต้องหลังจากการกรอง</p>";
        return;
      }

      let time = 0;
      let completed = [];
      let totalBurst = processes.reduce((a,p)=>a+p.burst,0);

      while (completed.length < processes.length) {
        
        // 1. หาโปรเซสที่ "มาถึงแล้ว" ณ เวลาปัจจุบัน
        let available = processes.filter(p => !p.done && p.arrival <= time);

        if (available.length === 0) {
            // **จัดการ Idle Time (เวลาว่าง)**
            let nextArrivalProcesses = processes.filter(p => !p.done);
            if (nextArrivalProcesses.length > 0) {
                // ข้ามเวลาไปที่ arrival time ของโปรเซสที่มาถึงถัดไปที่เร็วที่สุด
                let nextArrival = Math.min(...nextArrivalProcesses.map(p => p.arrival));
                if(nextArrival > time) {
                    time = nextArrival;
                    continue; // กลับไปเช็ค available process ใหม่
                }
            } else {
                break; // ไม่มีโปรเซสเหลือแล้ว
            }
            
            // Re-check available processes at the new time (ถ้า time ถูกอัปเดต)
            available = processes.filter(p => !p.done && p.arrival <= time);
        }
        
        // 2. **LCFS Selection: เรียงลำดับและเลือกโปรเซส**
        available.sort((a, b) => {
            // 1. Primary: LCFS (Arrival Time มากไปน้อย - มาล่าสุดก่อน)
            if (a.arrival !== b.arrival) {
                return b.arrival - a.arrival; 
            }
            
            // 2. Secondary (Tie-breaker): Burst Time น้อยไปมาก
            return b.name.localeCompare(a.name);
            
            // 3. Tertiary (Final Tie-breaker): ชื่อ Process 
            return a.name.localeCompare(b.name);
        });

        let chosen = available[0]; // เลือกโปรเซสแรกสุด (มาล่าสุด/Burst น้อยสุด)

        // 3. **Non-preemptive Execution**
        chosen.start = time; 
        chosen.finish = time + chosen.burst;
        chosen.tat = chosen.finish - chosen.arrival;
        chosen.wait = chosen.start - chosen.arrival;
        chosen.rt = chosen.wait;
        chosen.done = true;
        completed.push(chosen);
        time = chosen.finish; // อัปเดตเวลาปัจจุบัน
      }

      // การคำนวณค่าเฉลี่ย
      let avgTAT = completed.reduce((a,p)=>a+p.tat,0)/completed.length;
      let avgWT  = completed.reduce((a,p)=>a+p.wait,0)/completed.length;
      let avgRT  = completed.reduce((a,p)=>a+p.rt,0)/completed.length;
      let makespan = completed.length > 0 ? Math.max(...completed.map(p=>p.finish)) : 0;
      
      // การคำนวณ Utilization และ Throughput
      let cpuUtil = (makespan > 0) ? (totalBurst/makespan*100).toFixed(2) : 0.00;
      let throughput = (makespan > 0) ? (completed.length/makespan).toFixed(3) : 0.000;

      // การสร้างตารางผลลัพธ์
      let html = "<h3>📊 ผลลัพธ์</h3><table><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Start</th><th>Finish</th><th>TAT</th><th>WT</th><th>RT</th></tr>";
      // เรียงตามเวลาเริ่มต้นเพื่อแสดง Gantt Chart แบบตาราง
      completed.sort((a,b)=>a.start-b.start).forEach(p=>{
        html += `<tr><td>${p.name}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.start}</td><td>${p.finish}</td><td>${p.tat}</td><td>${p.wait}</td><td>${p.rt}</td></tr>`;
      });
      html += "</table>";

      // การแสดงค่าเฉลี่ย
      html += `<div class='result-box'>
        Avg TAT = ${avgTAT.toFixed(2)}<br>
        Avg WT = ${avgWT.toFixed(2)}<br>
        Avg RT = ${avgRT.toFixed(2)}<br>
        CPU Utilization = ${cpuUtil}%<br>
        Throughput = ${throughput} process/unit time
      </div>`;

      document.getElementById("output").innerHTML = html;
    }
// ------------------------ End of File Upload Handling -------------------------
