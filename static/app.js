(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ic = n => `<i data-lucide="${n}"></i>`;
const icons = () => { if (window.lucide) lucide.createIcons(); };

/* ---------- form schema (all 30 dataset features) ---------- */
const EDU = [[0,'None'],[1,'Primary'],[2,'5–9th'],[3,'Secondary'],[4,'Higher']];
const JOBS = [['teacher','Teacher'],['health','Health'],['services','Services'],['at_home','At home'],['other','Other']];
const S = (k,label,opts,def,full) => ({k,label,type:'seg',opts,def,full});
const R = (k,label,min,max,def,lo,hi) => ({k,label,type:'slider',min,max,def,lo,hi});
const T = (k,label,def) => ({k,label,type:'toggle',def});

const SECTIONS = [
 {title:'Student background', icon:'user-round', sub:'Who the student is', fields:[
   S('sex','Sex',[['F','Female'],['M','Male']],'F'),
   R('age','Age',15,22,17),
   S('address','Home area',[['U','Urban'],['R','Rural']],'U'),
 ]},
 {title:'Family', icon:'users', sub:'Home environment and parental background', fields:[
   S('famsize','Family size',[['LE3','3 or fewer'],['GT3','More than 3']],'GT3'),
   S('Pstatus','Parents live',[['T','Together'],['A','Apart']],'T'),
   S('Medu',"Mother's education",EDU,3,true),
   S('Fedu',"Father's education",EDU,2,true),
   S('Mjob',"Mother's job",JOBS,'other',true),
   S('Fjob',"Father's job",JOBS,'other',true),
   S('guardian','Guardian',[['mother','Mother'],['father','Father'],['other','Other']],'mother'),
   R('famrel','Family relationship',1,5,4,'Very bad','Excellent'),
   T('famsup','Family educational support','yes'),
 ]},
 {title:'Study & school', icon:'book-open', sub:'Habits, attendance and support', fields:[
   S('studytime','Weekly study time',[[1,'<2 h'],[2,'2–5 h'],[3,'5–10 h'],[4,'>10 h']],2),
   S('traveltime','Travel to school',[[1,'<15 min'],[2,'15–30'],[3,'30–60'],[4,'>1 h']],1),
   R('failures','Past class failures',0,3,0,'None','3 or more'),
   R('absences','Absences',0,75,4,'0','75'),
   S('reason','Reason for choosing school',[['home','Close to home'],['reputation','Reputation'],['course','Course'],['other','Other']],'course',true),
   T('schoolsup','Extra school support','no'),
   T('paid','Paid extra classes','no'),
   T('nursery','Attended nursery','yes'),
   T('higher','Wants higher education','yes'),
   T('internet','Internet at home','yes'),
 ]},
 {title:'Lifestyle & wellbeing', icon:'heart-pulse', sub:'Free time, social life and health', fields:[
   T('activities','Extra-curricular activities','no'),
   T('romantic','In a relationship','no'),
   R('freetime','Free time after school',1,5,3,'Very low','Very high'),
   R('goout','Going out with friends',1,5,3,'Rarely','Very often'),
   R('health','Current health',1,5,4,'Very bad','Very good'),
   R('Dalc','Alcohol · weekdays',1,5,1,'Very low','Very high'),
   R('Walc','Alcohol · weekends',1,5,2,'Very low','Very high'),
 ]},
];
const GRADES = {title:'Previous grades', icon:'award', sub:'Period 1 and period 2 results', fields:[
   R('G1','Period 1 grade (G1)',0,20,10),R('G2','Period 2 grade (G2)',0,20,10)]};

let META = {use_g1_g2:false, pass_mark:10, good_mark:14, scale:20, model_name:'Random Forest'}, RES = null;
const state = {};
const allSections = () => META.sections || (META.use_g1_g2 ? [GRADES, ...SECTIONS] : SECTIONS);
const LABEL = {};
const buildLabels = () => allSections().forEach(s => s.fields.forEach(f => LABEL[f.k] = f.label));

/* ---------- field renderers ---------- */
function renderField(f) {
  state[f.k] = f.def;
  if (f.type === 'slider') {
    const pct = (f.def - f.min) / (f.max - f.min) * 100;
    return `<div class="field"><div class="lbl"><label>${f.label}</label><b class="val" id="v-${f.k}">${f.def}</b></div>
      <input class="range" type="range" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${f.def}" style="--pct:${pct}%">
      <div class="hint"><span>${f.lo ?? f.min}</span><span>${f.hi ?? f.max}</span></div></div>`;
  }
  if (f.type === 'seg') {
    const num = typeof f.opts[0][0] === 'number' ? 1 : 0;
    return `<div class="field ${f.full ? 'full' : ''}"><div class="lbl"><label>${f.label}</label></div>
      <div class="seg" data-k="${f.k}" data-num="${num}">${f.opts.map(([v,t]) =>
        `<button type="button" data-v="${v}" class="${String(v) === String(f.def) ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
  }
  if (f.type === 'select') {
    return `<div class="field ${f.full ? 'full' : ''}"><div class="lbl"><label>${f.label}</label></div>
      <div class="sel"><select data-k="${f.k}">${f.opts.map(([v,t]) =>
        `<option value="${v}" ${String(v) === String(f.def) ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>`;
  }
  const [on, off] = f.vals || ['yes', 'no'];
  return `<div class="field tog"><label>${f.label}</label>
    <label class="switch"><input type="checkbox" data-k="${f.k}" data-on="${on}" data-off="${off}" ${f.def === on ? 'checked' : ''}><i></i></label></div>`;
}
function buildForm() {
  $('#form').innerHTML = allSections().map(s =>
    `<section class="glass card"><h2><span class="ibox">${ic(s.icon)}</span>${s.title}</h2><p class="sub">${s.sub}</p>
     <div class="grid">${s.fields.map(renderField).join('')}</div></section>`).join('');
  icons();
}

/* ---------- events ---------- */
$('#form').addEventListener('input', e => {
  const t = e.target; if (!t.matches('.range')) return;
  state[t.dataset.k] = +t.value;
  t.style.setProperty('--pct', ((t.value - t.min) / (t.max - t.min) * 100) + '%');
  $('#v-' + t.dataset.k).textContent = t.value; schedule();
});
$('#form').addEventListener('change', e => {
  const t = e.target;
  if (t.matches('.switch input')) { state[t.dataset.k] = t.checked ? t.dataset.on : t.dataset.off; schedule(); }
  else if (t.matches('select')) { state[t.dataset.k] = t.value; schedule(); }
});
$('#form').addEventListener('click', e => {
  const b = e.target.closest('.seg button'); if (!b) return;
  const seg = b.parentElement;
  $$('button', seg).forEach(x => x.classList.remove('on')); b.classList.add('on');
  state[seg.dataset.k] = seg.dataset.num === '1' ? +b.dataset.v : b.dataset.v; schedule();
});
$('#reset').addEventListener('click', () => { buildForm(); run(); });

/* ---------- prediction ---------- */
const lvl = g => g < META.pass_mark ? {n:'At risk', c:'#f87171', i:'triangle-alert'}
              : g < META.good_mark ? {n:'Average', c:'#fbbf24', i:'circle-minus'} : {n:'Good', c:'#34d399', i:'circle-check'};
let timer, seq = 0;
function schedule() { clearTimeout(timer); timer = setTimeout(run, 110); }
async function run() {
  const my = ++seq;
  try {
    const r = await fetch('/api/predict', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(state)});
    const j = await r.json(); if (my !== seq) return; show(j.grade);
  } catch (e) { $('#gstatus').textContent = 'Server not reachable'; }
}
const OPS = {'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'==':(a,b)=>a==b};
function insights(s) {
  const o = [], add = (t, k) => o.push({t, k});
  if (META.rules) {
    META.rules.forEach(r => { if (OPS[r.op](s[r.f], r.v)) add(r.t, r.k); });
    if (!o.length) add('No major risk signals in the current inputs.', 'ok');
    return o;
  }
  if (s.absences > 10) add('High absences. Attendance is one of the strongest grade drivers.', 'bad');
  if (s.failures > 0) add(`${s.failures} past failure(s). Consider remedial support or tutoring.`, 'bad');
  if (s.studytime <= 1) add('Very low weekly study time. Even 2–5 hours makes a difference.', 'warn');
  if (s.Dalc >= 3 || s.Walc >= 4) add('High alcohol use is linked to lower grades.', 'warn');
  if (s.higher === 'no') add('No plan for higher education. Mentoring may raise motivation.', 'warn');
  if (s.goout >= 4 && s.studytime <= 2) add('Frequent going out combined with little study time.', 'warn');
  if (s.absences <= 3 && s.failures === 0 && s.studytime >= 3) add('Strong habits: low absences, no failures, solid study time.', 'ok');
  if (!o.length) add('No major risk factors in the current inputs.', 'ok');
  return o;
}
function show(g) {
  const L = lvl(g), mae = RES?.results?.[META.model_name]?.MAE ?? 3;
  const res = $('#result'); res.style.setProperty('--c', L.c);
  $('#gnum').textContent = g.toFixed(1);
  $('#ringfg').style.strokeDasharray = `${g / META.scale * 364.4} 364.4`;
  $('#gstatus').innerHTML = `${ic(L.i)}${L.n}`;
  $('#gest').textContent = `Likely between ${Math.max(0, g - mae).toFixed(1)} and ${Math.min(META.scale, g + mae).toFixed(1)}  ·  pass mark ${META.pass_mark}`;
  $('#gmark').style.left = (g / META.scale * 100) + '%';
  const icn = {bad:'triangle-alert', warn:'lightbulb', ok:'circle-check'};
  $('#ins').innerHTML = insights(state).map(x => `<li class="${x.k}">${ic(icn[x.k])}<span>${x.t}</span></li>`).join('');
  icons();
}

/* ---------- batch ---------- */
const dz = $('#drop'), fi = $('#file');
dz.addEventListener('click', () => fi.click());
['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => { if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
fi.addEventListener('change', () => { if (fi.files[0]) upload(fi.files[0]); });
$('#sample').addEventListener('click', () => upload(null));
async function upload(file) {
  $('#bmsg').textContent = 'Predicting…';
  let r;
  if (file) { const fd = new FormData(); fd.append('file', file); r = await fetch('/api/batch', {method:'POST', body:fd}); }
  else r = await fetch('/api/batch?sample=1', {method:'POST'});
  const j = await r.json();
  if (!r.ok) { $('#bmsg').textContent = j.error || 'Failed'; return; }
  $('#bmsg').textContent = `${j.rows.length} students processed`; renderBatch(j.rows);
}
const chip = s => { const c = {'At risk':'#f87171','Average':'#fbbf24','Good':'#34d399'}[s]; return `<span class="chip" style="--c:${c}">${s}</span>`; };
function renderBatch(rows) {
  const n = k => rows.filter(r => r.Status === k).length;
  const cols = (META.batch_cols || ['sex','age','studytime','failures','absences','Predicted_G3','Status']).filter(c => c in rows[0]);
  $('#bout').innerHTML = `
   <div class="stats">
     <div class="glass stat"><span>Students</span><b>${rows.length}</b></div>
     <div class="glass stat"><span>At risk</span><b style="color:#f87171">${n('At risk')}</b></div>
     <div class="glass stat"><span>Average</span><b style="color:#fbbf24">${n('Average')}</b></div>
     <div class="glass stat"><span>Good</span><b style="color:#34d399">${n('Good')}</b></div></div>
   <div class="glass card"><div class="tablewrap"><table><thead><tr>${cols.map(c => `<th>${c === 'Predicted_G3' ? 'Predicted' : (LABEL[c] || c.replace('_',' '))}</th>`).join('')}</tr></thead>
   <tbody>${rows.slice(0, 300).map(r => `<tr>${cols.map(c => `<td>${c === 'Status' ? chip(r[c]) : r[c]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="row"><button class="btn" id="dl">${ic('download')}Download full results (CSV)</button></div></div>`;
  icons();
  $('#dl').onclick = () => {
    const keys = Object.keys(rows[0]), esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download = 'predictions.csv'; a.click();
  };
}

/* ---------- performance ---------- */
async function loadPerf() {
  if (!RES) { const r = await fetch('/api/results'); if (!r.ok) { $('#perf').innerHTML = '<p class="muted">Run train.py first.</p>'; return; } RES = await r.json(); }
  const names = Object.keys(RES.results);
  const all = Object.entries(RES.importance).sort((a, b) => b[1] - a[1]);
  const negs = all.filter(x => x[1] < 0).slice(-3);
  const imp = [...all.slice(0, negs.length ? 8 : 10), ...negs.filter(x => !all.slice(0, 8).includes(x))];
  const posMax = Math.max(...imp.map(x => x[1]), 0), negMax = Math.max(...imp.map(x => -x[1]), 0), span = (posMax + negMax) || 1;
  const zero = negMax / span * 100;
  const fmt = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
  const imgs = {'pred_vs_actual.png':'Predicted vs actual','eda_g3_dist.png':'Grade distribution','eda_corr.png':'Correlation heatmap'};
  $('#perf').innerHTML = `
   <div class="models">${names.map(n => { const m = RES.results[n];
     return `<div class="glass model ${n === META.model_name ? 'hl' : ''}"><div class="nm">${n}</div><div class="big">${m.R2.toFixed(2)}</div>
     <div class="sm">R² score · MAE ${m.MAE.toFixed(2)} · RMSE ${m.RMSE.toFixed(2)}</div></div>`; }).join('')}</div>
   <div class="two">
     <div class="glass card"><h2><span class="ibox">${ic('bar-chart-3')}</span>Model comparison</h2><p class="sub">R² on the test set (higher is better)</p>
       <div class="bars">${names.map(n => `<div class="bar"><div class="t"><span>${n}</span><span>${RES.results[n].R2.toFixed(3)}</span></div>
       <div class="trk"><div class="fill" style="width:${Math.max(0, RES.results[n].R2) * 100}%"></div></div></div>`).join('')}</div></div>
     <div class="glass card"><h2><span class="ibox">${ic('trending-up')}</span>What drives grades</h2><p class="sub">Right of the line = matters for predictions. Red, left = no useful signal.</p>
       <div class="bars">${imp.map(([k, v]) => { const w = Math.abs(v) / span * 100, left = v < 0 ? zero - w : zero;
         return `<div class="bar"><div class="t"><span>${LABEL[k] || k}</span><span class="${v < 0 ? 'neg' : 'pos'}">${fmt(v)}</span></div>
         <div class="trk div"><i class="zero" style="left:${zero}%"></i><div class="fill ${v < 0 ? 'neg' : ''}" style="left:${left}%;width:${w}%"></div></div></div>`; }).join('')}</div></div>
   </div>
   <div class="two">${RES.images.filter(f => imgs[f]).map(f => `<div class="glass card imgcard"><h2>${imgs[f]}</h2><img src="/outputs/${f}" alt="${imgs[f]}"></div>`).join('')}</div>`;
  icons();
}

/* ---------- navigation ---------- */
function nav() {
  let v = location.hash.slice(1); if (!['predict','batch','performance','about'].includes(v)) v = 'predict';
  $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
  if (v === 'performance') loadPerf();
  window.scrollTo({top:0});
}
window.addEventListener('hashchange', nav);

/* ---------- apply dataset settings to the page ---------- */
function applyMeta() {
  const sc = META.scale, p = META.pass_mark / sc * 100, gd = META.good_mark / sc * 100;
  $('.band .s1').style.width = p + '%'; $('.band .s2').style.width = (gd - p) + '%'; $('.band .s3').style.width = (100 - gd) + '%';
  $('.center span').textContent = `out of ${sc}`;
  if (META.title) $('#ph1').textContent = META.title;
  if (META.lead) $('#plead').textContent = META.lead;
  if (META.target_label) $('#rlabel').textContent = META.target_label;
  if (META.about_data) $('#about-data').textContent = META.about_data;
  if (META.about_model) $('#about-model').textContent = META.about_model;
}

/* ---------- init ---------- */
(async () => {
  try { META = await (await fetch('/api/meta')).json(); } catch (e) {}
  try { const r = await fetch('/api/results'); if (r.ok) RES = await r.json(); } catch (e) {}
  buildLabels(); applyMeta(); buildForm(); nav(); run(); icons();
})();
})();
