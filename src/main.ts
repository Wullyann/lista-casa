import { db, ensureAnon } from "./firebase";
import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc
} from "firebase/firestore";

type Item = {
  id: string;
  texto: string;
  prioridade: number; // 1–10
  grupo: string;
  valor: number;      // R$
  feito: boolean;
  criadoEm?: any;
};

const form = document.getElementById("form-add") as HTMLFormElement;
const inpTexto = document.getElementById("inp-texto") as HTMLInputElement;
const inpPrio = document.getElementById("inp-prio") as HTMLInputElement;
const inpGrupo = document.getElementById("inp-grupo") as HTMLSelectElement;
const inpValor = document.getElementById("inp-valor") as HTMLInputElement;

const filtroSel = document.getElementById("sel-filtro") as HTMLSelectElement;
const filtroGrupo = document.getElementById("sel-grupo") as HTMLSelectElement;

const prioOp = document.getElementById("prio-op") as HTMLSelectElement | null;
const prioVal = document.getElementById("prio-val") as HTMLInputElement | null;
const btnPrioClear = document.getElementById("btn-prio-clear") as HTMLButtonElement | null;

const table = document.getElementById("lista") as HTMLTableElement;
const theadRow = table.querySelector("thead tr") as HTMLTableRowElement;
const tbody = document.getElementById("tbody") as HTMLTableSectionElement;

const contadores = document.getElementById("contadores") as HTMLDivElement;
const btnLimpar = document.getElementById("btn-limpar") as HTMLButtonElement;
const btnGrupo = document.getElementById("btn-grupo") as HTMLButtonElement;

const btnDelMode = document.getElementById("btn-del-mode") as HTMLButtonElement;
const btnDelCancel = document.getElementById("btn-del-cancel") as HTMLButtonElement;
const btnDelConfirm = document.getElementById("btn-del-confirm") as HTMLButtonElement;

const errorBox = document.getElementById("error") as HTMLDivElement | null;

let lista: Item[] = [];
let grupos: string[] = [];
let deleteMode = false;
const selectedToDelete = new Set<string>();

// sala via URL (?room=...), ou padrão:
const url = new URL(window.location.href);
const roomId = (url.searchParams.get("room") || "wullyann-pamela").trim();

// refs
const colItems = collection(db, "rooms", roomId, "items");
const docMeta  = doc(db, "rooms", roomId, "meta", "groups");

// ---------- helpers ----------
function showError(msg: string | null) {
  if (!errorBox) { if (msg) console.error(msg); return; }
  if (!msg) { errorBox.style.display = "none"; errorBox.textContent = ""; return; }
  errorBox.style.display = ""; errorBox.textContent = msg;
}
function clampPrio(n: number) { return Math.max(1, Math.min(10, Number(n || 5))); }
function fmtBRL(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function refillSelectOptions(sel: HTMLSelectElement, opts: string[], addTodos = false) {
  sel.innerHTML = "";
  if (addTodos) { const o = document.createElement("option"); o.value = ""; o.textContent = "Todos"; sel.appendChild(o); }
  for (const g of opts) { const o = document.createElement("option"); o.value = g; o.textContent = g; sel.appendChild(o); }
}
function syncGroupSelects() {
  refillSelectOptions(inpGrupo, grupos, false);
  refillSelectOptions(filtroGrupo, grupos, true);
}
function ensureDeleteHeader() {
  const exists = theadRow.querySelector("#th-select");
  if (deleteMode && !exists) {
    const th = document.createElement("th"); th.id = "th-select"; th.textContent = "Sel.";
    theadRow.insertBefore(th, theadRow.firstChild);
  } else if (!deleteMode && exists) {
    exists.remove();
  }
}
function applyFilters(base: Item[]) {
  let data = [...base];
  if (filtroSel.value === "pendentes") data = data.filter(i => !i.feito);
  if (filtroSel.value === "realizados") data = data.filter(i => i.feito);
  if (filtroGrupo.value) data = data.filter(i => i.grupo === filtroGrupo.value);
  if (prioVal && prioOp && prioVal.value.trim() !== "") {
    const val = clampPrio(Number(prioVal.value));
    if (!Number.isNaN(val)) {
      data = data.filter(i => prioOp.value === "gte" ? i.prioridade >= val
        : prioOp.value === "lte" ? i.prioridade <= val
        : i.prioridade === val);
    }
  }
  return data;
}

// ---------- render ----------
function render() {
  syncGroupSelects();
  ensureDeleteHeader();

  btnDelMode.style.display = deleteMode ? "none" : "";
  btnDelCancel.style.display = deleteMode ? "" : "none";
  btnDelConfirm.style.display = deleteMode ? "" : "none";
  btnDelConfirm.textContent = `Apagar selecionados (${selectedToDelete.size})`;

  let data = applyFilters(lista);
  data.sort((a, b) =>
    Number(a.feito) - Number(b.feito) ||
    b.prioridade - a.prioridade ||
    a.grupo.localeCompare(b.grupo)
  );

  const pend = data.filter(i => !i.feito).length;
  const real = data.length - pend;
  const totalValor = data.reduce((s, i) => s + (i.valor || 0), 0);
  const totalPend = data.filter(i => !i.feito).reduce((s, i) => s + (i.valor || 0), 0);
  contadores.textContent = `${data.length} itens • ${pend} pendentes • ${real} realizados • Total ${fmtBRL(totalValor)} • Falta ${fmtBRL(totalPend)}`;

  tbody.innerHTML = "";
  if (data.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    const colCount = deleteMode ? 6 : 5;
    td.colSpan = colCount; td.className = "empty";
    td.textContent = "Nada por aqui ainda.";
    tr.appendChild(td); tbody.appendChild(tr);
    return;
  }

  for (const i of data) {
    const tr = document.createElement("tr");
    if (deleteMode && selectedToDelete.has(i.id)) tr.classList.add("tr-del-selected");

    if (deleteMode) {
      const tdSel = document.createElement("td");
      tdSel.className = "center";
      const cbSel = document.createElement("input");
      cbSel.type = "checkbox"; cbSel.checked = selectedToDelete.has(i.id);
      cbSel.addEventListener("change", () => {
        if (cbSel.checked) selectedToDelete.add(i.id); else selectedToDelete.delete(i.id);
        btnDelConfirm.textContent = `Apagar selecionados (${selectedToDelete.size})`;
        tr.classList.toggle("tr-del-selected", cbSel.checked);
      });
      tdSel.appendChild(cbSel); tr.appendChild(tdSel);
    }

    // OK
    const tdOk = document.createElement("td");
    tdOk.className = "center";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = i.feito; cb.disabled = deleteMode;
    cb.addEventListener("change", async () => {
      try { await updateDoc(doc(db, "rooms", roomId, "items", i.id), { feito: cb.checked }); }
      catch (e:any) { console.error(e); showError("Falha ao atualizar item (feito)."); }
    });
    tdOk.appendChild(cb); tr.appendChild(tdOk);

    // Prioridade
    const tdPrio = document.createElement("td");
    const prio = document.createElement("input");
    prio.type = "number"; prio.min = "1"; prio.max = "10";
    prio.value = String(i.prioridade);
    prio.className = "input prio"; prio.disabled = deleteMode;
    prio.addEventListener("change", async () => {
      const v = clampPrio(Number(prio.value)); prio.value = String(v);
      try { await updateDoc(doc(db, "rooms", roomId, "items", i.id), { prioridade: v }); }
      catch (e:any) { console.error(e); showError("Falha ao atualizar prioridade."); }
    });
    tdPrio.appendChild(prio); tr.appendChild(tdPrio);

    // Grupo
    const tdGrupo = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "input small";
    for (const g of grupos) { const o = document.createElement("option"); o.value = g; o.textContent = g; if (g===i.grupo) o.selected = true; sel.appendChild(o); }
    sel.disabled = deleteMode;
    sel.addEventListener("change", async () => {
      try { await updateDoc(doc(db, "rooms", roomId, "items", i.id), { grupo: sel.value }); }
      catch (e:any) { console.error(e); showError("Falha ao atualizar grupo."); }
    });
    tdGrupo.appendChild(sel); tr.appendChild(tdGrupo);

    // Valor
    const tdValor = document.createElement("td");
    const valInput = document.createElement("input");
    valInput.type = "number"; valInput.min = "0"; valInput.step = "0.01";
    valInput.value = i.valor ? String(i.valor) : ""; valInput.placeholder = "0,00";
    valInput.className = "input small"; valInput.disabled = deleteMode;
    const valFmt = document.createElement("div"); valFmt.className = "muted";
    valFmt.textContent = i.valor ? fmtBRL(i.valor) : "—";
    valInput.addEventListener("change", async () => {
      const n = Number(valInput.value); const novo = Number.isFinite(n) && n >= 0 ? n : 0;
      valInput.value = novo ? String(novo) : "";
      try { await updateDoc(doc(db, "rooms", roomId, "items", i.id), { valor: novo }); }
      catch (e:any) { console.error(e); showError("Falha ao atualizar valor."); }
    });
    tdValor.appendChild(valInput); tdValor.appendChild(valFmt); tr.appendChild(tdValor);

    // Texto
    const tdTexto = document.createElement("td");
    const txt = document.createElement("input");
    txt.className = "item-text" + (i.feito ? " strike" : "");
    txt.value = i.texto; txt.disabled = deleteMode;
    txt.addEventListener("blur", async () => {
      try { await updateDoc(doc(db, "rooms", roomId, "items", i.id), { texto: txt.value.trim() }); }
      catch (e:any) { console.error(e); showError("Falha ao atualizar texto."); }
    });
    tdTexto.appendChild(txt); tr.appendChild(tdTexto);

    tbody.appendChild(tr);
  }
}

// ---------- ops Firestore ----------
async function addItem(texto: string, prioridade: number, grupo: string, valor: number) {
  await addDoc(colItems, { texto, prioridade, grupo, valor, feito:false, criadoEm: serverTimestamp() });
}
async function deleteItems(ids: string[]) {
  await Promise.all(ids.map(id => deleteDoc(doc(db, "rooms", roomId, "items", id))));
}
async function createGroupsIfMissing() {
  const snap = await getDoc(docMeta);
  if (!snap.exists()) {
    const defaults = ["Cozinha","Sala","Quarto","Banheiro","Lavanderia","Escritório","Varanda","Outros"];
    await setDoc(docMeta, { groups: defaults }, { merge: true });
    grupos = defaults.slice();
  } else {
    const data = snap.data() as { groups?: string[] } | undefined;
    grupos = data?.groups && Array.isArray(data.groups) ? data.groups : [];
    if (grupos.length === 0) {
      const defaults = ["Cozinha","Sala","Quarto","Banheiro","Lavanderia","Escritório","Varanda","Outros"];
      await setDoc(docMeta, { groups: defaults }, { merge: true });
      grupos = defaults.slice();
    }
  }
}
function subscribe() {
  onSnapshot(docMeta, (snap) => {
    const data = snap.data() as { groups?: string[] } | undefined;
    if (data?.groups && Array.isArray(data.groups)) grupos = data.groups;
    render();
  }, (err) => { console.error(err); showError("Erro de leitura dos grupos (permissão?)"); });

  const q = query(colItems, orderBy("criadoEm", "desc"));
  onSnapshot(q, (snap) => {
    lista = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Item,"id">) }));
    showError(null);
    render();
  }, (err) => { console.error(err); showError("Erro de leitura dos itens (permissão?)"); });
}

// ---------- eventos ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const texto = inpTexto.value.trim(); if (!texto) return;
  const prioridade = clampPrio(Number(inpPrio.value));
  const grupo = inpGrupo.value || (grupos[0] ?? "Geral");
  const n = Number(inpValor.value); const valor = Number.isFinite(n) && n >= 0 ? n : 0;

  try { await addItem(texto, prioridade, grupo, valor); inpTexto.value = ""; inpPrio.value = "5"; inpValor.value = ""; }
  catch (err:any) { console.error(err); showError("Falha ao adicionar item."); }
});

filtroSel.addEventListener("change", render);
filtroGrupo.addEventListener("change", render);

if (prioOp && prioVal && btnPrioClear) {
  prioOp.addEventListener("change", render);
  prioVal.addEventListener("input", () => {
    const n = Number(prioVal.value); if (!Number.isNaN(n)) prioVal.value = String(clampPrio(n));
    render();
  });
  btnPrioClear.addEventListener("click", () => { prioVal.value = ""; render(); });
}

btnDelMode.addEventListener("click", () => { deleteMode = true; selectedToDelete.clear(); render(); });
btnDelCancel.addEventListener("click", () => { deleteMode = false; selectedToDelete.clear(); render(); });
btnDelConfirm.addEventListener("click", async () => {
  if (selectedToDelete.size === 0) return;
  if (!confirm(`Apagar ${selectedToDelete.size} item(ns)?`)) return;
  try { await deleteItems(Array.from(selectedToDelete)); deleteMode = false; selectedToDelete.clear(); }
  catch (e:any) { console.error(e); showError("Falha ao deletar."); }
});

btnLimpar.addEventListener("click", async () => {
  const ids = lista.filter(i => i.feito).map(i => i.id);
  if (ids.length === 0) return;
  if (!confirm(`Apagar ${ids.length} realizado(s)?`)) return;
  try { await deleteItems(ids); }
  catch (e:any) { console.error(e); showError("Falha ao limpar realizados."); }
});

btnGrupo.addEventListener("click", async () => {
  const nome = prompt("Nome do novo grupo (ex.: Cozinha, Quarto…):");
  if (!nome) return; const n = nome.trim(); if (!n) return;
  if (grupos.includes(n)) { alert("Esse grupo já existe."); return; }
  try {
    const arr = [...grupos, n].sort((a,b)=>a.localeCompare(b));
    await setDoc(docMeta, { groups: arr }, { merge: true });
  } catch (e:any) { console.error(e); showError("Falha ao criar grupo."); }
});

// ---------- start ----------
(async function start() {
  try {
    await ensureAnon();              // login anônimo
    await createGroupsIfMissing();   // cria meta/grupos se não existir
    subscribe();                     // listeners em tempo real
  } catch (e:any) {
    console.error(e);
    showError("Falha na inicialização do Firebase. Verifique Auth anônima e .env.local.");
  }
})();
