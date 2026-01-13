function $(id){ return document.getElementById(id); }

function showFatal(msg){
  const box = document.createElement("div");
  box.style.cssText = "max-width:980px;margin:16px auto;padding:12px 14px;border-radius:12px;border:2px solid #991b1b;background:#fff;color:#111827;font-family:system-ui";
  box.innerHTML = `<b style="color:#991b1b">Fehler:</b> ${msg}<br><span style="color:#6b7280">Tipp: Prüfe Dateinamen (Gross-/Klein), Pfade und IDs im HTML.</span>`;
  document.body.prepend(box);
}

function storageKey(sectionId){ return `lv_3ddruck_${sectionId}_v1`; }

function safeGetLocalStorage(){
  try{ return window.localStorage; } catch(e){ return null; }
}

function loadState(sectionId){
  const ls = safeGetLocalStorage();
  if(!ls) return { answers:{}, solved:false, sent:false };
  try{
    const raw = ls.getItem(storageKey(sectionId));
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { answers:{}, solved:false, sent:false };
}

function saveState(sectionId, state){
  const ls = safeGetLocalStorage();
  if(!ls) return;
  try{ ls.setItem(storageKey(sectionId), JSON.stringify(state)); } catch(e){}
}

function postAppSolvedOnce(sectionId, state){
  if(state.sent) return;
  state.sent = true;
  saveState(sectionId, state);
  try{ window.parent?.postMessage("AppSolved","*"); } catch(e){}
}

function mustHaveIds(ids){
  const missing = ids.filter(id => !$(id));
  if(missing.length){
    showFatal("Im HTML fehlen diese Elemente/IDs: <code>"+missing.join(", ")+"</code>");
    return false;
  }
  return true;
}

function checkAll(cfg, state){
  const ansM = state.answers.match || [];
  const okMatch =
    ansM.length === cfg.match.left.length &&
    cfg.match.solution.every((sol,i)=>String(ansM[i])===String(sol));

  const okMC = state.answers.mc === cfg.mc.correctIndex;

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

function renderSectionApp(cfg){
  if(!cfg){
    showFatal("SECTION_CONFIG ist nicht gesetzt. In der HTML-Datei muss <code>window.SECTION_CONFIG = {...}</code> stehen.");
    return;
  }

  const requiredIds = [
    "title","subtitle",
    "progressPill","detailPill",
    "matchTitle","matchTable",
    "mcTitle","mcQuestion","mcWrap",
    "clozeTitle","clozeText","wordbank",
    "msg","resetBtn","checkBtn"
  ];
  if(!mustHaveIds(requiredIds)) return;

  const state = loadState(cfg.sectionId);

  // Titel
  $("title").textContent = cfg.title;
  $("subtitle").textContent = cfg.subtitle;

  // MATCH
  $("matchTitle").textContent = cfg.match.title;
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
      updateStatus(cfg, state);
    };

    td2.appendChild(sel);
    tr.appendChild(td1);
    tr.appendChild(td2);
    matchTable.appendChild(tr);
  });

  // MC
  $("mcTitle").textContent = cfg.mc.title;
  $("mcQuestion").textContent = cfg.mc.question;
  const mcWrap = $("mcWrap");
  mcWrap.innerHTML = "";
  const savedMC = state.answers.mc ?? null;

  cfg.mc.options.forEach((opt,idx)=>{
    const lab = document.createElement("label");
    const inp = document.createElement("input");
    inp.type="radio";
    inp.name="mc";
    inp.value=idx;
    if(savedMC!==null && String(savedMC)===String(idx)) inp.checked = true;

    inp.onchange = ()=>{
      state.answers.mc = idx;
      saveState(cfg.sectionId, state);
      updateStatus(cfg, state);
    };

    lab.appendChild(inp);
    lab.appendChild(document.createTextNode(opt));
    mcWrap.appendChild(lab);
  });

  // CLOZE
  $("clozeTitle").textContent = cfg.cloze.title;
  const p = $("clozeText");
  p.innerHTML = "";

  const blanks = cfg.cloze.solution.length;
  const savedCloze = state.answers.cloze || Array(blanks).fill("");

  // WICHTIG: textParts muss blanks+1 sein — sonst zeigen wir eine klare Fehlermeldung
  if(cfg.cloze.textParts.length !== blanks+1){
    showFatal(`Cloze-Fehler: textParts hat ${cfg.cloze.textParts.length} Teile, erwartet sind ${blanks+1} (Lücken=${blanks}).`);
    return;
  }

  for(let i=0;i<blanks;i++){
    p.appendChild(document.createTextNode(cfg.cloze.textParts[i]));
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="">– Wort –</option>` +
      cfg.cloze.wordbank.map(w=>`<option value="${w}">${w}</option>`).join("");
    sel.value = savedCloze[i] ?? "";
    sel.onchange = ()=>{
      state.answers.cloze = state.answers.cloze || Array(blanks).fill("");
      state.answers.cloze[i] = sel.value;
      saveState(cfg.sectionId, state);
      updateStatus(cfg, state);
    };
    p.appendChild(sel);
  }
  p.appendChild(document.createTextNode(cfg.cloze.textParts[blanks]));

  const wb = $("wordbank");
  wb.innerHTML = "";
  cfg.cloze.wordbank.forEach(w=>{
    const c = document.createElement("span");
    c.className="chip";
    c.textContent = w;
    wb.appendChild(c);
  });

  // Buttons
  $("checkBtn").onclick = ()=>{
    const result = checkAll(cfg, state);
    state.solved = result.solved;
    saveState(cfg.sectionId, state);
    updateStatus(cfg, state);
    if(result.solved) postAppSolvedOnce(cfg.sectionId, state);
  };

  $("resetBtn").onclick = ()=>{
    const ls = safeGetLocalStorage();
    if(ls) try{ ls.removeItem(storageKey(cfg.sectionId)); }catch(e){}
    location.reload();
  };

  updateStatus(cfg, state);
}

window.renderSectionApp = renderSectionApp;
