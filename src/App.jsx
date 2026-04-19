import { useEffect, useState, useMemo } from "react";

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    const cols = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    cols.push(cur.trim());
    return cols;
  });
}

function brl(val) {
  const n = parseFloat(String(val).replace(/[^0-9,.-]/g, "").replace(",", "."));
  if (isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function fetchCsv(url) {
  const res = await fetch(url);
  return res.text();
}

const URL_VENDAS     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkhaBtnf2pTwGdZh8VroPSlvAjgfikS2pzrswllPTBJuYQrrB8PEJXKRUvqdzl7oLsU37gMGTEd-qC/pub?output=csv";
const URL_ESTOQUE    = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRf8q8phpvkyqstNVcnwL-kpT890VivYhVTIf7zbMsncHk5dcp-_DHGFjzD_5usua-CzsEfRPyPnnn7/pub?output=csv";
const URL_CALENDARIO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDxyW-yoO1Y9YngZEL5L4uAKx8Vd9A18Y7oF7OdqvjIUJBGdnuakVX6FJz63m1kb2TnkpFyuGNAuVz/pub?output=csv";
const URL_PROCESSOS  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLRDqgcYE4QpXZ3WeGzr5nDeeEVvIDPOVmTdshA0lZEGZA9m3PZSVRBZh30_sROKFJFd4Ll3l-Ar_v/pub?output=csv";

function parseVendas(text) {
  const rows = parseCsv(text);
  const data = [];
  let total = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1] || r[1].match(/^\d+$/) || !r[3]) continue;
    const valor = parseFloat(String(r[3]).replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
    if (valor === 0) continue;
    data.push({ vendedor: r[0] || "", cliente: r[1], servico: r[2] || "Servico", valor });
    total += valor;
  }
  const tipoMap = {};
  for (const d of data) {
    const s = d.servico.toLowerCase();
    let tipo = "Outros";
    if (s.includes("consular"))   tipo = "Servico Consular";
    if (s.includes("passaporte")) tipo = "Passaporte";
    if (s.includes("visto"))      tipo = "Visto";
    if (s.includes("cidadania"))  tipo = "Cidadania";
    if (s.includes("apostila"))   tipo = "Apostila";
    tipoMap[tipo] = (tipoMap[tipo] || 0) + d.valor;
  }
  return { vendas: data, total, mix: tipoMap };
}

function parseEstoque(text) {
  const rows = parseCsv(text);
  const header = rows[1] || [];
  const idx = k => header.findIndex(h => h.includes(k));
  const iItem = idx("ITEM"), iCat = idx("CATEGORIA"), iQtd = idx("QUANTIDADE");
  const iVU = idx("VALOR UNIT"), iVT = idx("VALOR TOTAL"), iProx = idx("PROXIMA");
  const result = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r[iItem]) continue;
    result.push({ item: r[iItem], categoria: r[iCat]||"", qtd: r[iQtd]||"0", valorUnit: r[iVU]||"0", valorTotal: r[iVT]||"0", proxCompra: r[iProx]||"" });
  }
  return result;
}

function parseCalendario(text) {
  const rows = parseCsv(text);
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[1]) continue;
    const [d, m, a] = r[0].split("/");
    if (!d || !m || !a) continue;
    result.push({
      data: r[0], nome: r[1], tipo: r[2]||"Outro", pais: r[3]||"Brasil",
      dateObj: new Date(`${a}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`),
      dia: parseInt(d), mes: parseInt(m)-1, ano: parseInt(a),
    });
  }
  return result;
}

function parseProcessos(text) {
  const rows = parseCsv(text);
  const result = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || r[0].includes("VELLOSO") || r[0].includes("Nr") || r[0].includes("N")) continue;
    if (r.every(c => !c)) continue;
    result.push({ pasta: r[0]||"", familia: r[1]||"", tipo: r[2]||"", vendedor: r[3]||"", responsavel: r[4]||"", etapa: r[5]||"", prazo: r[6]||"", totalContrato: r[7]||"0" });
  }
  return result.filter(p => p.pasta && p.familia);
}

function getTipoEmoji(tipo) {
  if (!tipo) return "📌";
  if (tipo.includes("Aniversário") || tipo.includes("Aniversario")) return "🎂";
  if (tipo.includes("Feriado")) return "🎉";
  if (tipo.includes("Cultural")) return "🎭";
  return "📌";
}

function getPaisFlag(pais) {
  if (!pais) return "🌍";
  if (pais.includes("Brasil")) return "🇧🇷";
  if (pais.includes("It")) return "🇮🇹";
  return "🌍";
}

const ETAPA_CORES = {
  "Concluido": "bg-green-100 text-green-800",
  "Concluído": "bg-green-100 text-green-800",
  "Em andamento": "bg-blue-100 text-blue-800",
  "Pendente": "bg-yellow-100 text-yellow-800",
  "Cancelado": "bg-red-100 text-red-800",
};

// ── TELA CALENDARIO ───────────────────────────────────────────────────────────
function TelaCalendario({ eventos }) {
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroPais, setFiltroPais] = useState("Todos");

  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];

  const eventosMes = useMemo(() => eventos.filter(e =>
    e.mes === mesSel && e.ano === anoSel &&
    (filtroTipo === "Todos" || e.tipo === filtroTipo) &&
    (filtroPais === "Todos" || e.pais === filtroPais || e.pais === "Ambos")
  ), [eventos, mesSel, anoSel, filtroTipo, filtroPais]);

  const eventosPorDia = {};
  for (const e of eventosMes) {
    if (!eventosPorDia[e.dia]) eventosPorDia[e.dia] = [];
    eventosPorDia[e.dia].push(e);
  }

  const primeiroDiaSemana = new Date(anoSel, mesSel, 1).getDay();
  const offset = primeiroDiaSemana === 0 ? 6 : primeiroDiaSemana - 1;
  const diasNoMes = new Date(anoSel, mesSel + 1, 0).getDate();
  const eventosDia = diaSel ? (eventosPorDia[diaSel] || []) : [];

  return (
    <div>
      <div className="flex flex-wrap gap-3 justify-center mb-8">
        {[["Todos","Todos"],["Aniversário","🎂 Aniversários"],["Feriado / Data Especial","🎉 Feriados"],["Evento Cultural","🎭 Culturais"]].map(([v,l]) => (
          <button key={v} onClick={() => setFiltroTipo(v)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${filtroTipo===v ? "bg-[#5c1e3c] text-white border-[#5c1e3c]" : "bg-white text-[#5c1e3c] border-[#5c1e3c] hover:bg-[#f5ede8]"}`}>
            {l}
          </button>
        ))}
        {["Todos","Brasil","Itália"].map(p => (
          <button key={p} onClick={() => setFiltroPais(p)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${filtroPais===p ? "bg-[#b5895a] text-white border-[#b5895a]" : "bg-white text-[#b5895a] border-[#b5895a] hover:bg-[#f5ede8]"}`}>
            {getPaisFlag(p)} {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => { const d = new Date(anoSel, mesSel-1); setMesSel(d.getMonth()); setAnoSel(d.getFullYear()); setDiaSel(null); }}
              className="w-9 h-9 rounded-full hover:bg-[#f5ede8] flex items-center justify-center text-[#5c1e3c] text-xl font-bold transition">&#8249;</button>
            <h2 className="text-xl font-bold text-[#5c1e3c]">{meses[mesSel]}</h2>
            <button onClick={() => { const d = new Date(anoSel, mesSel+1); setMesSel(d.getMonth()); setAnoSel(d.getFullYear()); setDiaSel(null); }}
              className="w-9 h-9 rounded-full hover:bg-[#f5ede8] flex items-center justify-center text-[#5c1e3c] text-xl font-bold transition">&#8250;</button>
          </div>
          <div className="grid grid-cols-7 mb-3">
            {diasSemana.map(d => <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({length: offset}).map((_,i) => <div key={`o${i}`} />)}
            {Array.from({length: diasNoMes}).map((_,i) => {
              const dia = i+1;
              const evts = eventosPorDia[dia] || [];
              const isHoje = dia===hoje.getDate() && mesSel===hoje.getMonth() && anoSel===hoje.getFullYear();
              const isSel = dia===diaSel;
              const temAniv = evts.some(e => e.tipo.includes("Aniversário") || e.tipo.includes("Aniversario"));
              const temFeriado = evts.some(e => e.tipo.includes("Feriado"));
              return (
                <div key={dia} onClick={() => setDiaSel(dia===diaSel ? null : dia)}
                  className={`aspect-square flex flex-col items-center justify-start pt-1.5 rounded-xl cursor-pointer transition-all
                    ${isSel ? "bg-[#5c1e3c] text-white" : isHoje ? "bg-[#f5ede8] text-[#5c1e3c]" : "hover:bg-[#fdf8f5] text-gray-700"}
                  `}>
                  <span className={`text-sm font-bold ${isSel ? "text-white" : isHoje ? "text-[#5c1e3c]" : ""}`}>{dia}</span>
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {temAniv && <div className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-pink-300" : "bg-pink-400"}`} />}
                    {temFeriado && <div className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-yellow-200" : "bg-yellow-400"}`} />}
                    {evts.length > 0 && !temAniv && !temFeriado && <div className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-purple-300" : "bg-purple-400"}`} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4 flex-wrap text-xs text-gray-400">
            <span><span className="inline-block w-2 h-2 rounded-full bg-pink-400 mr-1"></span>Aniversários</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"></span>Feriados</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-purple-400 mr-1"></span>Culturais</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {diaSel ? (
            <>
              <h3 className="text-lg font-bold text-[#5c1e3c] mb-1">{diaSel} de {meses[mesSel]}</h3>
              <div className="w-12 h-0.5 bg-[#b5895a] mb-4" />
              {eventosDia.length === 0 ? (
                <p className="text-gray-400 text-sm">Nenhum evento neste dia.</p>
              ) : (
                <div className="space-y-3">
                  {eventosDia.map((e, i) => (
                    <div key={i} className="border-l-2 border-[#b5895a] pl-3">
                      <p className="text-sm font-semibold text-gray-800">{getTipoEmoji(e.tipo)} {e.nome.replace("Aniversário: ","")}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{e.tipo} · {getPaisFlag(e.pais)} {e.pais}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-[#5c1e3c] mb-1">Selecione um dia</h3>
              <div className="w-12 h-0.5 bg-[#b5895a] mb-4" />
              <p className="text-sm text-gray-400">Clique em um dia do calendário para ver os eventos</p>
              <div className="mt-6 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Próximos eventos</p>
                {eventos.filter(e => {
                  const diff = Math.ceil((e.dateObj - new Date()) / 86400000);
                  return diff >= 0 && diff <= 14;
                }).sort((a,b) => a.dateObj-b.dateObj).slice(0,5).map((e,i) => {
                  const diff = Math.ceil((e.dateObj - new Date()) / 86400000);
                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
                      <span className="text-lg">{getTipoEmoji(e.tipo)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{e.nome.replace("Aniversário: ","")}</p>
                        <p className="text-xs text-gray-400">{e.data}</p>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${diff===0?"text-red-500":diff<=3?"text-orange-500":"text-gray-400"}`}>
                        {diff===0?"Hoje":`${diff}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TELA VENDAS ───────────────────────────────────────────────────────────────
function TelaVendas({ vendas }) {
  const mix = vendas?.mix || {};
  const mixTotal = Object.values(mix).reduce((a,b)=>a+b,0);
  const cores = ["bg-[#5c1e3c]","bg-[#b5895a]","bg-[#8b4f72]","bg-[#c9a87c]","bg-[#3d1429]"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-[#5c1e3c]">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Total do Mês</p>
          <p className="text-2xl font-bold text-[#5c1e3c] mt-1">{brl(vendas?.total||0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-[#b5895a]">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Contratos</p>
          <p className="text-2xl font-bold text-[#b5895a] mt-1">{vendas?.vendas?.length||0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-[#8b4f72]">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Ticket Médio</p>
          <p className="text-2xl font-bold text-[#8b4f72] mt-1">{brl(vendas?.vendas?.length?(vendas.total/vendas.vendas.length):0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-[#5c1e3c] text-base mb-1">Contratos do Mês</h3>
          <div className="w-8 h-0.5 bg-[#b5895a] mb-4" />
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(vendas?.vendas||[]).map((v,i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 rounded-full bg-[#f5ede8] flex items-center justify-center text-[#5c1e3c] font-bold text-sm flex-shrink-0">
                  {v.cliente.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{v.cliente}</p>
                  <p className="text-xs text-gray-400 truncate">{v.servico}</p>
                </div>
                <p className="font-bold text-[#5c1e3c] text-sm flex-shrink-0">{brl(v.valor)}</p>
              </div>
            ))}
            {!vendas && <p className="text-gray-400 text-center py-8">Carregando...</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-[#5c1e3c] text-base mb-1">Mix de Serviços</h3>
          <div className="w-8 h-0.5 bg-[#b5895a] mb-4" />
          <div className="space-y-4">
            {Object.entries(mix).map(([tipo,val],i) => {
              const pct = mixTotal>0?Math.round((val/mixTotal)*100):0;
              return (
                <div key={tipo}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{tipo}</span>
                    <span className="text-gray-400 text-xs">{pct}% · {brl(val)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${cores[i%cores.length]} h-2 rounded-full transition-all duration-700`} style={{width:`${pct}%`}} />
                  </div>
                </div>
              );
            })}
          </div>
          {mixTotal>0 && <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between"><span className="text-sm text-gray-500">Total</span><span className="font-bold text-[#5c1e3c]">{brl(mixTotal)}</span></div>}
        </div>
      </div>
    </div>
  );
}

// ── TELA PROCESSOS ────────────────────────────────────────────────────────────
function TelaProcessos({ processos }) {
  const [busca, setBusca] = useState("");
  const filtrados = processos.filter(p =>
    p.familia.toLowerCase().includes(busca.toLowerCase()) ||
    p.tipo.toLowerCase().includes(busca.toLowerCase()) ||
    p.etapa.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <input value={busca} onChange={e=>setBusca(e.target.value)}
          placeholder="Buscar por família, tipo ou etapa..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5c1e3c] transition" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#5c1e3c]">Controle de Processos</h3>
            <div className="w-8 h-0.5 bg-[#b5895a] mt-1" />
          </div>
          <span className="text-sm text-gray-400">{filtrados.length} processos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#fdf8f5]">
              <tr>
                {["Pasta","Família","Tipo","Vendedor","Etapa","Prazo"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.slice(0,50).map((p,i) => (
                <tr key={i} className="hover:bg-[#fdf8f5] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.pasta}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{p.familia}</td>
                  <td className="px-4 py-3 text-gray-600">{p.tipo}</td>
                  <td className="px-4 py-3 text-gray-600">{p.vendedor}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ETAPA_CORES[p.etapa]||"bg-gray-100 text-gray-600"}`}>
                      {p.etapa||"—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.prazo||"—"}</td>
                </tr>
              ))}
              {filtrados.length===0 && <tr><td colSpan={6} className="text-center text-gray-400 py-10">Nenhum processo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── TELA ESTOQUE ──────────────────────────────────────────────────────────────
function TelaEstoque({ estoque }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-bold text-[#5c1e3c]">Controle de Estoque</h3>
        <div className="w-8 h-0.5 bg-[#b5895a] mt-1" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#fdf8f5]">
            <tr>
              {["Item","Categoria","Quantidade","Valor Unit.","Total","Próx. Compra"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {estoque.map((e,i) => (
              <tr key={i} className="hover:bg-[#fdf8f5] transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-800">{e.item}</td>
                <td className="px-4 py-3"><span className="bg-[#f5ede8] text-[#5c1e3c] text-xs font-semibold px-2.5 py-1 rounded-full">{e.categoria}</span></td>
                <td className="px-4 py-3 font-bold text-gray-700">{e.qtd}</td>
                <td className="px-4 py-3 text-gray-500">{brl(e.valorUnit)}</td>
                <td className="px-4 py-3 font-bold text-[#5c1e3c]">{brl(e.valorTotal)}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{e.proxCompra}</td>
              </tr>
            ))}
            {estoque.length===0 && <tr><td colSpan={6} className="text-center text-gray-400 py-10">Carregando...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  const [aba, setAba] = useState("calendario");
  const [vendas, setVendas] = useState(null);
  const [estoque, setEstoque] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [ultima, setUltima] = useState("");

  async function carregar() {
    try {
      const [tv, te, tc, tp] = await Promise.all([
        fetchCsv(URL_VENDAS), fetchCsv(URL_ESTOQUE), fetchCsv(URL_CALENDARIO), fetchCsv(URL_PROCESSOS)
      ]);
      setVendas(parseVendas(tv));
      setEstoque(parseEstoque(te));
      setEventos(parseCalendario(tc));
      setProcessos(parseProcessos(tp));
      setUltima(new Date().toLocaleTimeString("pt-BR"));
    } catch(e) { console.error(e); }
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, []);

  const abas = [
    { id:"calendario", label:"Calendário", emoji:"🗓️", cor:"bg-[#5c1e3c]" },
    { id:"vendas",     label:"Vendas",     emoji:"📈", cor:"bg-[#b5895a]" },
    { id:"processos",  label:"Processos",  emoji:"📋", cor:"bg-[#6b3a5d]" },
    { id:"estoque",    label:"Estoque",    emoji:"📦", cor:"bg-[#c0392b]" },
  ];

  const titulos = {
    calendario: "Calendário de Eventos",
    vendas: "Equipe Comercial",
    processos: "Controle de Processos",
    estoque: "Controle de Estoque",
  };

  return (
    <div className="min-h-screen" style={{backgroundColor:"#f7f3ef"}}>
      {/* Header */}
      <header className="pt-10 pb-6 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-full border-2 border-[#5c1e3c] flex items-center justify-center text-2xl bg-white shadow-sm">🌍</div>
        </div>
        <h1 className="text-4xl font-black tracking-widest text-[#5c1e3c] uppercase">VELLOSO</h1>
        <p className="text-xs font-bold tracking-[0.4em] text-[#b5895a] uppercase mt-1">CIDADANIA</p>
        <h2 className="text-xl font-semibold text-[#5c1e3c] mt-4">{titulos[aba]}</h2>
        <p className="text-sm text-[#b5895a] mt-0.5">2026</p>

        {/* Navbar */}
        <nav className="flex flex-wrap justify-center gap-3 mt-6">
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm
                ${aba===a.id ? `${a.cor} text-white shadow-md scale-105` : "bg-white text-[#5c1e3c] border-2 border-[#5c1e3c] hover:bg-[#f5ede8]"}`}>
              <span>{a.emoji}</span> {a.label}
            </button>
          ))}
        </nav>

        <p className="text-xs text-gray-400 mt-3">
          Atualizado: {ultima||"carregando..."} ·
          <button onClick={carregar} className="ml-1 text-[#b5895a] underline hover:text-[#5c1e3c]">atualizar agora</button>
        </p>
      </header>

      {/* Conteúdo */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        {aba==="calendario" && <TelaCalendario eventos={eventos} />}
        {aba==="vendas"     && <TelaVendas vendas={vendas} />}
        {aba==="processos"  && <TelaProcessos processos={processos} />}
        {aba==="estoque"    && <TelaEstoque estoque={estoque} />}
      </main>

      <footer className="text-center text-xs text-gray-400 pb-6">
        Velloso Cidadania · Sistema de Gestão 2026
      </footer>
    </div>
  );
}