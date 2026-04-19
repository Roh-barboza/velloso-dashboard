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

function parseVendas(text) {
  const rows = parseCsv(text);
  const data = [];
  let total = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1] || r[1].match(/^\d+$/) || !r[3]) continue;
    const valor = parseFloat(String(r[3]).replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
    if (valor === 0) continue;
    data.push({ cliente: r[1], servico: r[2] || "Servico", valor });
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
    result.push({
      item: r[iItem], categoria: r[iCat] || "", qtd: r[iQtd] || "0",
      valorUnit: r[iVU] || "0", valorTotal: r[iVT] || "0", proxCompra: r[iProx] || "",
    });
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
      data: r[0], nome: r[1], tipo: r[2] || "Outro",
      pais: r[3] || "Brasil", natureza: r[4] || "",
      dateObj: new Date(`${a}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`),
      dia: parseInt(d), mes: parseInt(m) - 1, ano: parseInt(a),
    });
  }
  return result;
}

const TIPO_CONFIG = {
  "Aniversario":             { emoji: "birthday", bg: "bg-pink-100",   text: "text-pink-700",   dot: "bg-pink-400"   },
  "Feriado / Data Especial": { emoji: "party",    bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400" },
  "Evento Cultural":         { emoji: "theater",  bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-400" },
  "Outro":                   { emoji: "pin",      bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"   },
};

const TIPO_EMOJI = {
  "Aniversario": "birthday_cake",
  "Feriado / Data Especial": "tada",
  "Evento Cultural": "performing_arts",
  "Outro": "pushpin",
};

const PAIS_FLAG = { "Brasil": "flag_brazil", "Italia": "flag_italy", "Ambos": "earth_globe" };

function getTipoConfig(tipo) {
  if (tipo && tipo.includes("Aniversario")) return TIPO_CONFIG["Aniversario"];
  return TIPO_CONFIG[tipo] || TIPO_CONFIG["Outro"];
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

function Card({ title, value, sub, gradient, emoji }) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient} relative overflow-hidden`}>
      <div className="absolute right-4 top-3 text-4xl opacity-20 select-none">{emoji}</div>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-75">{title}</p>
      <p className="text-3xl font-extrabold mt-1 leading-tight">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-base font-bold text-gray-700 mb-4">{children}</h2>;
}

function TabDashboard({ vendas, estoque }) {
  const mix = vendas?.mix || {};
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);
  const coresBarra = ["from-blue-500 to-blue-600","from-green-500 to-green-600","from-purple-500 to-purple-600","from-yellow-500 to-yellow-600","from-red-500 to-red-600"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card emoji="💰" title="Vendas do Mes" value={brl(vendas?.total || 0)} sub={`${vendas?.vendas?.length || 0} contratos`} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
        <Card emoji="📦" title="Itens em Estoque" value={estoque.length} sub="produtos cadastrados" gradient="bg-gradient-to-br from-emerald-500 to-green-600" />
        <Card emoji="🛎️" title="Tipos de Servico" value={Object.keys(mix).length} sub="no mes atual" gradient="bg-gradient-to-br from-violet-500 to-purple-700" />
        <Card emoji="🏆" title="Ticket Medio" value={brl(vendas?.vendas?.length ? (vendas.total / vendas.vendas.length) : 0)} sub="por contrato" gradient="bg-gradient-to-br from-orange-500 to-red-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SectionTitle>💼 Contratos do Mes</SectionTitle>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(vendas?.vendas || []).map((v, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {v.cliente.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{v.cliente}</p>
                    <p className="text-xs text-gray-400">{v.servico}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-600 text-sm">{brl(v.valor)}</p>
              </div>
            ))}
            {!vendas && <p className="text-gray-400 text-sm text-center py-8">Carregando...</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SectionTitle>📊 Mix de Servicos</SectionTitle>
          <div className="space-y-4">
            {Object.entries(mix).map(([tipo, val], i) => {
              const pct = mixTotal > 0 ? Math.round((val / mixTotal) * 100) : 0;
              return (
                <div key={tipo}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-gray-700">{tipo}</span>
                    <span className="text-gray-400 text-xs">{pct}% · {brl(val)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`bg-gradient-to-r ${coresBarra[i % coresBarra.length]} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {mixTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Total do mes</span>
              <span className="font-bold text-gray-800">{brl(mixTotal)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <SectionTitle>📦 Controle de Estoque</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100">
                {["Item","Categoria","Qtd","Valor Unit.","Total","Prox. Compra"].map(h => (
                  <th key={h} className="pb-3 text-xs text-gray-400 uppercase tracking-wider font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {estoque.map((e, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 font-semibold text-gray-800">{e.item}</td>
                  <td className="py-3"><span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">{e.categoria}</span></td>
                  <td className="py-3 font-bold text-gray-700">{e.qtd}</td>
                  <td className="py-3 text-gray-500">{brl(e.valorUnit)}</td>
                  <td className="py-3 font-bold text-gray-800">{brl(e.valorTotal)}</td>
                  <td className="py-3 text-xs text-gray-400">{e.proxCompra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabCalendario({ eventos }) {
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroPais, setFiltroPais] = useState("Todos");
  const meses = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const eventosMes = useMemo(() => eventos.filter(e => e.mes === mesSel && e.ano === anoSel && (filtroTipo === "Todos" || e.tipo === filtroTipo) && (filtroPais === "Todos" || e.pais === filtroPais || e.pais === "Ambos")), [eventos, mesSel, anoSel, filtroTipo, filtroPais]);
  const primeiroDia = new Date(anoSel, mesSel, 1).getDay();
  const diasNoMes = new Date(anoSel, mesSel + 1, 0).getDate();
  const eventosPorDia = {};
  for (const e of eventosMes) { if (!eventosPorDia[e.dia]) eventosPorDia[e.dia] = []; eventosPorDia[e.dia].push(e); }
  const proximos = useMemo(() => eventos.filter(e => { const diff = Math.ceil((e.dateObj - hoje) / 86400000); return diff >= 0 && diff <= 60 && (filtroTipo === "Todos" || e.tipo === filtroTipo) && (filtroPais === "Todos" || e.pais === filtroPais || e.pais === "Ambos"); }).sort((a, b) => a.dateObj - b.dateObj).slice(0, 10), [eventos, filtroTipo, filtroPais]);
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(anoSel, mesSel - 1); setMesSel(d.getMonth()); setAnoSel(d.getFullYear()); }} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">&#8249;</button>
          <span className="font-bold text-gray-800 min-w-[140px] text-center">{meses[mesSel]} {anoSel}</span>
          <button onClick={() => { const d = new Date(anoSel, mesSel + 1); setMesSel(d.getMonth()); setAnoSel(d.getFullYear()); }} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">&#8250;</button>
        </div>
        <div className="flex gap-2 flex-wrap ml-auto">
          {["Todos","Aniversário","Feriado / Data Especial","Evento Cultural"].map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)} className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${filtroTipo === t ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{getTipoEmoji(t)} {t.split(" ")[0]}</button>
          ))}
          {["Todos","Brasil","Itália"].map(p => (
            <button key={p} onClick={() => setFiltroPais(p)} className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${filtroPais === p ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{getPaisFlag(p)} {p}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="grid grid-cols-7 mb-2">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sab"].map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: primeiroDia }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: diasNoMes }).map((_, i) => {
              const dia = i + 1;
              const evts = eventosPorDia[dia] || [];
              const isHoje = dia === hoje.getDate() && mesSel === hoje.getMonth() && anoSel === hoje.getFullYear();
              return (
                <div key={dia} className={`min-h-[56px] rounded-xl p-1.5 border transition ${isHoje ? "border-blue-400 bg-blue-50" : "border-transparent hover:border-gray-200 hover:bg-gray-50"}`}>
                  <p className={`text-xs font-bold mb-1 ${isHoje ? "text-blue-600" : "text-gray-600"}`}>{dia}</p>
                  <div className="space-y-0.5">
                    {evts.slice(0, 2).map((e, ei) => {
                      const cfg = getTipoConfig(e.tipo);
                      return <div key={ei} className={`${cfg.bg} ${cfg.text} text-xs rounded px-1 py-0.5 truncate`} title={e.nome}>{getTipoEmoji(e.tipo)} {e.nome.replace("Aniversário: ","").split(" ")[0]}</div>;
                    })}
                    {evts.length > 2 && <div className="text-xs text-gray-400 font-semibold">+{evts.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SectionTitle>⏰ Proximos 60 dias</SectionTitle>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {proximos.map((e, i) => {
              const diff = Math.ceil((e.dateObj - hoje) / 86400000);
              const cfg = getTipoConfig(e.tipo);
              return (
                <div key={i} className={`rounded-xl p-3 ${cfg.bg}`}>
                  <div className="flex justify-between items-start gap-2">
                    <p className={`text-sm font-semibold ${cfg.text} leading-tight`}>{getTipoEmoji(e.tipo)} {e.nome.replace("Aniversário: ","")}</p>
                    <span className={`text-xs font-bold flex-shrink-0 ${diff === 0 ? "text-red-600" : diff <= 7 ? "text-orange-500" : cfg.text}`}>{diff === 0 ? "Hoje!" : `${diff}d`}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{e.data} {getPaisFlag(e.pais)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <SectionTitle>📋 Eventos de {meses[mesSel]} ({eventosMes.length})</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
          {eventosMes.map((e, i) => {
            const cfg = getTipoConfig(e.tipo);
            return (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${cfg.bg}`}>{getTipoEmoji(e.tipo)}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{e.nome.replace("Aniversário: ","")}</p>
                  <p className="text-xs text-gray-400">{e.data} · {getPaisFlag(e.pais)} {e.pais}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [aba, setAba] = useState("dashboard");
  const [vendas, setVendas] = useState(null);
  const [estoque, setEstoque] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [ultima, setUltima] = useState("");

  async function carregar() {
    try {
      const [tv, te, tc] = await Promise.all([fetchCsv(URL_VENDAS), fetchCsv(URL_ESTOQUE), fetchCsv(URL_CALENDARIO)]);
      setVendas(parseVendas(tv));
      setEstoque(parseEstoque(te));
      setEventos(parseCalendario(tc));
      setUltima(new Date().toLocaleTimeString("pt-BR"));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🏛️</div>
            <div>
              <h1 className="text-white font-extrabold text-lg leading-tight">Velloso Cidadania</h1>
              <p className="text-blue-200 text-xs">Sistema de Gestao 2026</p>
            </div>
          </div>
          <p className="text-blue-200 text-xs hidden sm:block">{ultima || "Carregando..."}</p>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {[["dashboard","📊 Dashboard"],["calendario","📅 Calendario"]].map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)} className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition ${aba === id ? "bg-slate-100 text-blue-700" : "text-blue-200 hover:text-white hover:bg-white/10"}`}>{label}</button>
          ))}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        {aba === "dashboard" && <TabDashboard vendas={vendas} estoque={estoque} />}
        {aba === "calendario" && <TabCalendario eventos={eventos} />}
      </main>
      <footer className="text-center text-xs text-gray-400 py-4">
        Velloso Cidadania · <button onClick={carregar} className="text-blue-400 underline">Atualizar agora</button>
      </footer>
    </div>
  );
}