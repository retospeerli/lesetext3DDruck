function $(id){ return document.getElementById(id); }

function storageKey(sectionId){
  return `lv_3ddruck_${sectionId}_v1`;
}

function loadState(sectionId){
  try{
    const raw = localStorage.getItem(storageKey(sectionId));
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { answers:{}, solved:false, sent:false };
}

function saveState(sectionId, state){
  localStorage.setItem(storageKey(sectionId), JSON.stringify(state));
}

function postAppSolvedOnce(sectionId, state){
  if(state.sent) return;
  state.sent = true;
  saveState(sectionId, state);
  try{
    window.parent?.postMessage("AppSolved","*");
  }catch(e){}
}

function renderSectionApp(cfg){
  const state = loadState(cfg.sectionId);

  $("title").textContent = cfg.title;
  $("subtitle").textContent = cfg.subtitle;

  // Match render
  const matchCard = $("matchCard");
  matchCard.querySelector("h2").textContent = cfg.match.title;
  const matchTable = $("matchTable");
  matchTable.innerHTML = "";
  const savedMatch = state.answers.match || Array(cfg.match.left.length).fill("");

  cfg.match.left.forEach((l,i)=>{
    const tr = document.createElement("tr");
    tr.className = "pair";
    const td1 = document.createElement("td");
    td1.textContent = l;
    const td2 = document.createElement("td");
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="">– wählen –</option>` +
      cfg.match.right.map((r,ri)=>`<option value="${ri}">${r}</option>`).join("");
    sel.value = savedMatch[i] ?? "";
    sel.onchange = ()=>{
      state.answers.match = state.answers.match || Array(cfg.match.left.length).fill("");
      state.answers.match[i] = sel.value;
      saveState(cfg.sectionId, state);
    };
    td2.appendChild(sel);
    tr.appendChild(td1); tr.appendChild(td2);
    matchTable.appendChild(tr);
  });

  // MC render
  $("mcTitle").textContent = cfg.mc.title;
  $("mcQuestion").textContent = cfg.mc.question;
  const mcWrap = $("mcWrap");
  mcWrap.innerHTML = "";
  const savedMC = state.answers.mc ?? null;

  cfg.mc.options.forEach((opt,idx)=>{
    const lab = document.createElement("label");
    const inp = document.createElement("input");
    inp.type = "radio";
    inp.name = "mc";
    inp.value = idx;
    if(savedMC !== null && String(savedMC)===String(idx)) inp.checked = true;
    inp.onchange = ()=>{
      state.answers.mc = idx;
      saveState(cfg.sectionId, state);
    };
    lab.appendChild(inp);
    lab.appendChild(document.createTextNode(opt));
    mcWrap.appendChild(lab);
  });

  // Cloze render
  $("clozeTitle").textContent = cfg.cloze.title;
  const p = $("clozeText");
  p.innerHTML = "";
  const savedCloze = state.answers.cloze || Array(cfg.cloze.solution.length).fill("");

  let bi = 0;
  cfg.cloze.textParts.forEach((part,pi)=>{
    p.appendChild(document.createTextNode(part));
    if(pi < cfg.cloze.solution.length){
      const sel = document.createElement("select");
      sel.innerHTML = `<option value="">– Wort –</option>` +
        cfg.cloze.wordbank.map(w=>`<option value="${w}">${w}</option>`).join("");
      sel.value = savedCloze[bi] ?? "";
      sel.onchange = ()=>{
        state.answers.cloze = state.answers.cloze || Array(cfg.cloze.solution.length).fill("");
        state.answers.cloze[bi] = sel.value;
        saveState(cfg.sectionId, state);
      };
      p.appendChild(sel);
      bi++;
    }
  });

  const wb = $("wordbank");
  wb.innerHTML = "";
  cfg.cloze.wordbank.forEach(w=>{
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = w;
    wb.appendChild(c);
  });

  // Status
  updateStatus(cfg, state);

  // Buttons
  $("checkBtn").onclick = ()=>{
    const result = checkAll(cfg, state);
    state.solved = result.solved;
    saveState(cfg.sectionId, state);
    updateStatus(cfg, state);

    if(result.solved){
      postAppSolvedOnce(cfg.sectionId, state);
    }
  };

  $("resetBtn").onclick = ()=>{
    localStorage.removeItem(storageKey(cfg.sectionId));
    location.reload();
  };
}

function checkAll(cfg, state){
  // Match
  const ansM = state.answers.match || [];
  const okMatch = ansM.length===cfg.match.left.length &&
    cfg.match.solution.every((sol,i)=>String(ansM[i])===String(sol));

  // MC
  const okMC = state.answers.mc === cfg.mc.correctIndex;

  // Cloze
  const ansC = state.answers.cloze || [];
  const okCloze = cfg.cloze.solution.every((sol,i)=>String(ansC[i])===String(sol));

  return { okMatch, okMC, okCloze, solved: okMatch && okMC && okCloze };
}

function updateStatus(cfg, state){
  const r = checkAll(cfg, state);
  $("progressPill").textContent = `Status: ${state.solved ? "gelöst" : "offen"}`;
  $("detailPill").textContent = `Zuordnung: ${r.okMatch?"✓":"✗"}  MC: ${r.okMC?"✓":"✗"}  Lücken: ${r.okCloze?"✓":"✗"}`;
  $("msg").innerHTML = state.solved
    ? `<span class="ok">Gelöst ✅</span> – AppSolved wird gesendet.`
    : `<span class="bad">Noch nicht gelöst ❌</span> – bitte alles korrekt lösen.`;
}
