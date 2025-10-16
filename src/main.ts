/* ---------- Tipos ---------- */
type Item = {
  id: string;
  item: string;
  prio: number;
  grupo: string;
  valor: number;      // em reais, ponto como separador
  link?: string;      // NOVO
  feito: boolean;
  createdAt: number;
};

/* ---------- Estado ---------- */
let items: Item[] = [];
let grupos: string[] = ["Cozinha", "Quarto", "Sala", "Banheiro", "Serviços"];

/* ---------- DOM ---------- */
const elNovoItem = document.getElementById("novoItem") as HTMLInputElement;
const elNovoGrupo = document.getElementById("novoGrupo") as HTMLSelectElement;
const elNovaPrio = document.getElementById("novaPrio") as HTMLInputElement;
const elNovoValor = document.getElementById("novoValor") as HTMLInputElement;
const elNovoLink  = document.getElementById("novoLink")  as HTMLInputElement; // NOVO
const btnAdd      = document.getElementById("btnAdd") as HTMLButtonElement;

const selFiltroEstado = document.getElementById("filtroEstado") as HTMLSelectElement;
const selFiltroGrupo  = document.getElementById("filtroGrupo") as HTMLSelectElement;
const selCmpPrio      = document.getElementById("cmpPrio") as HTMLSelectElement;
const inpFiltroPrio   = document.getElementById("filtroPrio") as HTMLInputElement;
const btnLimpaPrio    = document.getElementById("btnLimpaPrio") as HTMLButtonElement;
const inpBusca        = document.getElementById("filtroBusca") as HTMLInputElement; // NOVO

const btnCriarGrupo = document.getElementById("btnCriarGrupo") as HTMLButtonElement;
const btnLimpar     = document.getElementById("btnLimpar") as HTMLButtonElement;
const btnDeletar    = document.getElementById("btnDeletar") as HTMLButtonElement;

const ulLista = document.getElementById("lista") as HTMLUListElement;
const elResumo = document.getElementById("resumo") as HTMLDivElement;

/* ---------- Helpers ---------- */
const money = (n: number) =>
  (isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function normalizaGrupo(s: string) {
  return (s || "").trim();
}
function cmpGrupo(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

/* ---------- Render ---------- */
function renderGrupos() {
  const opts = grupos.map(g => `<option value="${g}">${g}</option>`).join("");
  elNovoGrupo.innerHTML = opts;
  selFiltroGrupo.innerHTML = `<option value="todos">Todos</option>` + opts;
}

function renderResumo(exibidos: Item[]) {
  const pend = exibidos.filter(i => !i.feito);
  const real = exibidos.filter(i => i.feito);
  const total = exibidos.reduce((s, i) => s + (i.valor || 0), 0);
  const falta = pend.reduce((s, i) => s + (i.valor || 0), 0);

  elResumo.innerHTML =
    `${exibidos.length} itens • ${pend.length} pendentes • ${real.length} realizados ` +
    `• Total ${money(total)} • Falta ${money(falta)}`;
}

function render() {
  // filtros
  const estado = selFiltroEstado.value; // todos | pendentes | realizados
  const grupoFiltro = normalizaGrupo(selFiltroGrupo.value);
  const cmp = selCmpPrio.value as ">=" | "<=" | "=";
  const prioV = Number(inpFiltroPrio.value) || undefined;
  const busca = (inpBusca.value || "").toLowerCase().trim();

  let exibidos = items.slice();

  // Filtro estado
  if (estado === "pendentes") exibidos = exibidos.filter(i => !i.feito);
  if (estado === "realizados") exibidos = exibidos.filter(i => i.feito);

  // Filtro grupo (CORRIGIDO: case-insensitive e “Todos” não filtra)
  if (grupoFiltro && grupoFiltro.toLowerCase() !== "todos") {
    exibidos = exibidos.filter(
      i => normalizaGrupo(i.grupo).toLowerCase() === grupoFiltro.toLowerCase()
    );
  }

  // Filtro prioridade
  if (prioV && prioV >= 1 && prioV <= 10) {
    exibidos = exibidos.filter(i =>
      cmp === ">=" ? i.prio >= prioV :
      cmp === "<=" ? i.prio <= prioV : i.prio === prioV
    );
  }

  // Filtro de busca (item + link)
  if (busca) {
    exibidos = exibidos.filter(i =>
      i.item.toLowerCase().includes(busca) ||
      (i.link || "").toLowerCase().includes(busca)
    );
  }

  // Ordena: pendentes primeiro, depois prio desc, depois alfabético
  exibidos.sort((a, b) => (Number(a.feito) - Number(b.feito)) || (b.prio - a.prio) || cmpGrupo(a.item, b.item));

  // Render
  ulLista.innerHTML = exibidos.map(i => row(i)).join("");
  renderResumo(exibidos);
}

function row(i: Item) {
  const linkHtml = i.link ? `<a class="chip link" href="${i.link}" target="_blank" rel="noopener">🔗 link</a>` : "";
  return `
<li class="tr ${i.feito ? "done" : ""}" data-id="${i.id}">
  <div class="td center">
    <input type="checkbox" ${i.feito ? "checked" : ""} data-action="toggle" />
  </div>
  <div class="td">
    <input class="pill prio" type="number" min="1" max="10" value="${i.prio}" data-action="edit-prio" />
  </div>
  <div class="td">
    <div class="select slim">
      <select data-action="edit-grupo">
        ${grupos.map(g => `<option ${g===i.grupo?"selected":""}>${g}</option>`).join("")}
      </select>
    </div>
  </div>
  <div class="td">
    <input class="input slim" value="${(i.valor||0).toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2})}" data-action="edit-valor" />
  </div>
  <div class="td">
    <div class="row gap">
      <input class="input flex" value="${i.item.replace(/"/g,'&quot;')}" data-action="edit-item" />
      <input class="input flex" placeholder="link" value="${i.link ?? ""}" data-action="edit-link" />
      ${linkHtml}
    </div>
  </div>
</li>`;
}

/* ---------- Eventos UI ---------- */
btnAdd.addEventListener("click", () => {
  const txt = (elNovoItem.value || "").trim();
  const prio = Math.max(1, Math.min(10, Number(elNovaPrio.value || 5)));
  const grupo = normalizaGrupo(elNovoGrupo.value || "Outros");
  const valor = parseMoney(elNovoValor.value);
  const link = (elNovoLink.value || "").trim();

  if (!txt) return;

  const it: Item = {
    id: crypto.randomUUID(),
    item: txt,
    prio,
    grupo,
    valor,
    link: link || undefined,
    feito: false,
    createdAt: Date.now()
  };
  items.push(it);
  elNovoItem.value = "";
  elNovoValor.value = "";
  elNovoLink.value = "";
  render();
  persistAdd(it).catch(console.error);
});

btnCriarGrupo.addEventListener("click", () => {
  const nome = prompt("Nome do novo grupo?");
  const g = normalizaGrupo(nome || "");
  if (!g) return;
  if (!grupos.map(s=>s.toLowerCase()).includes(g.toLowerCase())) {
    grupos.push(g);
    grupos.sort(cmpGrupo);
    persistGrupos().catch(console.error);
  } else {
    alert("Esse grupo já existe.");
  }
  renderGrupos();
});

btnLimpaPrio.addEventListener("click", ()=>{ inpFiltroPrio.value=""; render(); });

[selFiltroEstado, selFiltroGrupo, selCmpPrio, inpFiltroPrio, inpBusca].forEach(el =>
  el.addEventListener("input", render)
);

ulLista.addEventListener("input", (e) => {
  const t = e.target as HTMLElement;
  const li = (t.closest("li") as HTMLLIElement);
  if (!li) return;
  const id = li.dataset.id!;
  const it = items.find(x => x.id === id);
  if (!it) return;

  const action = t.getAttribute("data-action");
  if (action === "edit-prio") {
    const v = clamp(+((t as HTMLInputElement).value || 5), 1, 10);
    it.prio = v;
    persistUpdate(id, { prio: v }).catch(console.error);
  } else if (action === "edit-grupo") {
    const g = normalizaGrupo((t as HTMLSelectElement).value);
    it.grupo = g;
    persistUpdate(id, { grupo: g }).catch(console.error);
  } else if (action === "edit-valor") {
    const v = parseMoney((t as HTMLInputElement).value);
    it.valor = v;
    (t as HTMLInputElement).value = formatMoney(v);
    persistUpdate(id, { valor: v }).catch(console.error);
  } else if (action === "edit-item") {
    const v = ((t as HTMLInputElement).value || "").trim();
    it.item = v;
    persistUpdate(id, { item: v }).catch(console.error);
  } else if (action === "edit-link") {
    const v = ((t as HTMLInputElement).value || "").trim();
    it.link = v || undefined;
    persistUpdate(id, { link: it.link ?? null }).catch(console.error);
  }
  render();
});

ulLista.addEventListener("change", (e) => {
  const t = e.target as HTMLElement;
  if ((t as HTMLInputElement).type !== "checkbox") return;
  const li = (t.closest("li") as HTMLLIElement);
  if (!li) return;
  const id = li.dataset.id!;
  const it = items.find(x => x.id === id);
  if (!it) return;
  it.feito = (t as HTMLInputElement).checked;
  persistUpdate(id, { feito: it.feito }).catch(console.error);
  render();
});

btnLimpar.addEventListener("click", () => {
  const feitos = items.filter(i => i.feito).map(i => i.id);
  if (!feitos.length) return;
  if (!confirm(`Deletar ${feitos.length} realizados?`)) return;
  items = items.filter(i => !i.feito);
  render();
  persistDeleteMany(feitos).catch(console.error);
});

btnDeletar.addEventListener("click", () => {
  const ids = prompt("IDs (separe por vírgula) ou deixe vazio para cancelar:");
  if (!ids) return;
  const arr = ids.split(",").map(s=>s.trim()).filter(Boolean);
  items = items.filter(i => !arr.includes(i.id));
  render();
  persistDeleteMany(arr).catch(console.error);
});

/* ---------- Format helpers ---------- */
function parseMoney(s: string): number {
  const t = (s || "").replace(/\./g, "").replace(",", ".").replace(/[^\d.]+/g, "");
  const n = Number(t);
  return isFinite(n) ? Number(n.toFixed(2)) : 0;
}
function formatMoney(n: number) {
  return (isFinite(n) ? n : 0).toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2});
}
function clamp(n:number, min:number, max:number){ return Math.max(min, Math.min(max, n)); }

/* ---------- Persistência (Firestore) ---------- */
/*  Se você já tinha firebase.ts com getDb/getAuth, continue usando.
    Aqui vai uma versão “inline” simples para não quebrar nada.
*/
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, updateDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

console.log("[fb cfg]", { apiKey: firebaseConfig.apiKey ? "ok" : "(vazia)", projectId: firebaseConfig.projectId, ok: !!firebaseConfig.apiKey && !!firebaseConfig.projectId });

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// room por querystring (?room=...)
const url = new URL(location.href);
const room = (url.searchParams.get("room") || "wullyann-pamela").trim();

async function ensureAuth() {
  await signInAnonymously(auth);
}

const colItems = collection(db, "rooms", room, "items");
const docMeta = doc(db, "rooms", room, "meta", "config");

/* carregar em tempo real */
onSnapshot(colItems, snap => {
  const arr: Item[] = [];
  snap.forEach(d => {
    const v = d.data() as any;
    arr.push({
      id: d.id,
      item: v.item ?? "",
      prio: Number(v.prio ?? 5),
      grupo: normalizaGrupo(v.grupo ?? "Outros"),
      valor: Number(v.valor ?? 0),
      link: v.link || undefined,
      feito: Boolean(v.feito),
      createdAt: Number(v.createdAt ?? Date.now())
    });
  });
  items = arr;
  render();
});

onSnapshot(docMeta, d => {
  const v = d.data() as any;
  if (v?.groups && Array.isArray(v.groups)) {
    grupos = (v.groups as string[]).map(normalizaGrupo).sort(cmpGrupo);
    renderGrupos();
  }
});

/* salvar/adicionar/atualizar */
async function persistAdd(it: Item) {
  await setDoc(doc(colItems, it.id), {
    item: it.item, prio: it.prio, grupo: it.grupo, valor: it.valor,
    link: it.link ?? null, feito: it.feito, createdAt: serverTimestamp()
  });
}
async function persistUpdate(id: string, patch: Partial<Item>) {
  await updateDoc(doc(colItems, id), patch as any);
}
async function persistDeleteMany(ids: string[]) {
  await Promise.all(ids.map(id => deleteDoc(doc(colItems, id))));
}
async function persistGrupos() {
  await setDoc(docMeta, { groups: grupos }, { merge: true });
}

/* ---------- Inicialização ---------- */
(async function start(){
  try {
    await ensureAuth();
  } catch (e) {
    console.error("Falha na inicialização do Firebase. Verifique Auth anônima e .env.local.", e);
  }
  // inicial popula selects
  renderGrupos();
  render();
})();
