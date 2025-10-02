// script.js - LCFS Non-preemptive with detailed steps and full gantt
let processes = [];
const fileInput = document.getElementById('fileInput');
const stepsDiv = document.getElementById('steps');
const runBtn = document.getElementById('runBtn');
const loadExample = document.getElementById('loadExample');

fileInput.addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ()=> {
    parseCSVText(r.result);
    alert('ไฟล์ถูกโหลดแล้ว');
  };
  r.readAsText(f);
});

loadExample.addEventListener('click', ()=>{
  const sample = "id,arrival,burst\nP1,0,4\nP2,1,3\nP3,2,1\nP4,3,2\nP5,4,7\nP6,6,3\nP7,7,2";
  parseCSVText(sample);
  alert('ตัวอย่างถูกโหลด');
});

runBtn.addEventListener('click', ()=> {
  if(processes.length===0){ alert('กรุณาอัปโหลดหรือลงตัวอย่าง CSV ก่อน'); return; }
  const res = runLCFS(processes);
  renderSteps(res.steps);
  renderTable(res.schedule);
  renderSummary(res);
  drawGantt(res.schedule, res.firstArrival, res.lastCompletion);
});

// parse CSV simple
function parseCSVText(text){
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map(s=>s.trim());
  const data = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(',').map(s=>s.trim());
    if(cols.length<3) continue;
    data.push({ id: cols[0]||('P'+i), arrival: Number(cols[1]), burst: Number(cols[2]) });
  }
  processes = data;
}

// run LCFS non-preemptive; returns schedule and steps
function runLCFS(inputProcs){
  // deep copy and sort by arrival for scanning
  const procs = inputProcs.map((p,i)=> ({...p, _idx:i}) ).sort((a,b)=>a.arrival-b.arrival || a._idx-b._idx);
  const n = procs.length;
  let time = procs.length? procs[0].arrival : 0;
  let idxNext = 0;
  const stack = [];
  const completedSet = new Set();
  const schedule = [];
  const steps = [];

  while(schedule.length < n){
    // push arrivals up to current time
    while(idxNext < n && procs[idxNext].arrival <= time){
      stack.push(procs[idxNext]);
      steps.push({type:'arrived', time, pid:procs[idxNext].id, stack: stack.map(x=>x.id).slice()});
      idxNext++;
    }

    if(stack.length===0){
      // idle to next arrival
      if(idxNext < n){
        steps.push({type:'idle', time, nextArrival:procs[idxNext].arrival});
        time = procs[idxNext].arrival;
        continue;
      } else break;
    }

    // pick top of stack (last come)
    const cur = stack.pop();
    const start = Math.max(time, cur.arrival);
    const completion = start + cur.burst;
    schedule.push({ Process: cur.id, Arrival: cur.arrival, Burst: cur.burst, Start: start, Completion: completion,
                    TAT: completion - cur.arrival, WT: (start - cur.arrival), RT: (start - cur.arrival) });
    steps.push({type:'run', timeStart:start, pid:cur.id, burst:cur.burst, start, completion, stackBefore: stack.map(x=>x.id).slice()});
    time = completion;

    // after finishing, push any arrivals that happened <= time
    while(idxNext < n && procs[idxNext].arrival <= time){
      stack.push(procs[idxNext]);
      steps.push({type:'arrived', time, pid:procs[idxNext].id, stack: stack.map(x=>x.id).slice()});
      idxNext++;
    }
  }

  const firstArrival = n? Math.min(...procs.map(p=>p.arrival)) : 0;
  const lastCompletion = schedule.length? Math.max(...schedule.map(s=>s.Completion)) : 0;
  const totalBurst = schedule.reduce((a,b)=>a+b.Burst,0);
  const makespan = lastCompletion - firstArrival;
  const avgTAT = schedule.reduce((a,b)=>a+b.TAT,0)/schedule.length;
  const avgWT = schedule.reduce((a,b)=>a+b.WT,0)/schedule.length;
  const avgRT = schedule.reduce((a,b)=>a+b.RT,0)/schedule.length;
  const cpuUtil = makespan>0? (totalBurst / makespan) * 100 : 100;
  const throughput = makespan>0? schedule.length / makespan : schedule.length;

  return { schedule, steps, firstArrival, lastCompletion, makespan, avgTAT, avgWT, avgRT, cpuUtil, throughput };
}

function renderSteps(steps){
  stepsDiv.innerHTML = '';
  steps.forEach((s,i)=>{
    const el = document.createElement('div');
    el.className = 'step';
    if(s.type==='arrived'){
      el.innerHTML = `<strong>t=${s.time}:</strong> Process <b>${s.pid}</b> มาถึง → Ready Stack = [${s.stack.join(', ')}]`;
    } else if(s.type==='idle'){
      el.innerHTML = `<strong>t=${s.time}:</strong> CPU ว่าง → กระโดดไป t=${s.nextArrival} (ไม่มี process รอ)`;
    } else if(s.type==='run'){
      el.innerHTML = `<strong>t=${s.timeStart} → ${s.completion}:</strong> เลือก <b>${s.pid}</b> (burst=${s.burst}) ขึ้นรัน. Stack ก่อนรัน = [${s.stackBefore.join(', ')}]`;
    }
    stepsDiv.appendChild(el);
  });
}

function renderTable(schedule){
  const tbody = document.querySelector('#resultTable tbody');
  tbody.innerHTML = '';
  schedule.forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.Process}</td><td>${s.Arrival}</td><td>${s.Burst}</td><td>${s.Start}</td><td>${s.Completion}</td><td>${s.TAT}</td><td>${s.WT}</td><td>${s.RT}</td>`;
    tbody.appendChild(tr);
  });
}

function renderSummary(res){
  const sum = document.getElementById('summary');
  sum.innerHTML = '';
  const items = [
    ['Avg TAT', res.avgTAT.toFixed(3)],
    ['Avg WT', res.avgWT.toFixed(3)],
    ['Avg RT', res.avgRT.toFixed(3)],
    ['CPU Util', res.cpuUtil.toFixed(2) + '%'],
    ['Throughput', res.throughput.toFixed(3)],
    ['Makespan', res.makespan]
  ];
  items.forEach(it=>{
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<strong>${it[0]}</strong><div>${it[1]}</div>`;
    sum.appendChild(d);
  });
}

// draw full gantt
function drawGantt(schedule, firstArrival, lastCompletion){
  const canvas = document.getElementById('gantt');
  const ctx = canvas.getContext('2d');
  const paddingLeft = 60;
  const paddingTop = 20;
  const height = canvas.height;
  const width = Math.max(900, (lastCompletion - firstArrival) * 60 + 160);
  canvas.width = width;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font = '14px Arial';
  // background horizontal bar
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(paddingLeft, paddingTop, width - paddingLeft - 20, 60);

  // compute scale
  const makespan = lastCompletion - firstArrival || 1;
  const scale = (width - paddingLeft - 100) / makespan;

  // draw blocks
  let colors = {};
  function colorFor(id){
    if(colors[id]) return colors[id];
    // generate pastel color
    const h = (id.split('').reduce((a,c)=>a+c.charCodeAt(0),0) * 37) % 360;
    const col = `hsl(${h},64%,45%)`;
    colors[id]=col; return col;
  }

  schedule.forEach(s=>{
    const x = paddingLeft + (s.Start - firstArrival) * scale;
    const w = (s.Completion - s.Start) * scale;
    ctx.fillStyle = colorFor(s.Process);
    ctx.fillRect(x, paddingTop, w, 60);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(x, paddingTop, w, 60);
    // text
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(s.Process, x + w/2, paddingTop + 36);
  });

  // time ticks
  ctx.fillStyle='#111';
  ctx.textAlign='center';
  for(let t=firstArrival; t<=lastCompletion; t++){
    const x = paddingLeft + (t - firstArrival) * scale;
    ctx.beginPath(); ctx.moveTo(x, paddingTop+60); ctx.lineTo(x, paddingTop+66); ctx.stroke();
    ctx.fillText(t, x, paddingTop+84);
  }

  // left axis label
  ctx.textAlign='left';
  ctx.fillText('Time →', 8, paddingTop+36);
}
