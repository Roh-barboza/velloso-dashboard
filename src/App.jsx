import { useEffect, useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split("\n").map(l => l.trim()).filter(Boolean);
  const result = [];
  for (const line of lines) {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    cols.push(cur.trim());
    result.push(cols);
  }
  return result;
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

// ── URLs ──────────────────────────────────────────────────────────────────────
const URL_PROCESSOS  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLRDqgcYE4QpXZ3WeGzr5nDeeEVvIDPOVmTdshA0lZEGZA9m3PZSVRBZh30_sROKFJFd4Ll3l-Ar_v/pub?output=csv";
const URL_VENDAS     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkhaBtnf2pTwGdZh8VroPSlvAjgfikS2pzrswllPTBJuYQrrB8PEJXKRUvqdzl7oLsU37gMGTEd-qC/pub?output=csv";
const URL_ESTOQUE    = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRf8q8phpvkyqstNVcnwL-kpT890VivYhVTIf7zbMsncHk5dcp-_DHGFjzD_5usua-CzsEfRPyPnnn7/pub?output=csv";
const URL_CALENDARIO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDxyW-yoO1Y9YngZEL5L4uAKx8Vd9A18Y7oF7OdqvjIUJBGdnuakVX6FJz63m1kb2TnkpFyuGNAuVz/pub?output=csv";

// ── Parsers com colunas reais ─────────────────────────────────────────────────
function parseVendas(text) {
  const rows = parseCsv(text);
  // cabeçalho real na linha 2 (índice 2): ["", "Cliente", "Serviço Contratado", "Valor"]
  // dados começam na linha 4 (índice 4)
  const data = [];
  let totalGeral = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1] || r[1].match(/^\d+$/) || !r[3]) continue; // pula totais e vazios
    const valor = parseFloat(String(r[3]).replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
    if (valor === 0) continue;
    data.push({ cliente: r[1], servico: r[2] || "", valor });
    totalGeral += valor;
  }

  // Mix de serviços por tipo real
  const tipoMap = {};
  for (const d of data) {
    const s = d.servico.toLowerCase();
    let tipo = "Outros";
    if (s.includes("consular"))    tipo = "Serviço Consular";
    if (s.includes("passaporte"))  tipo = "Passaporte";
    if (s.includes("visto"))       tipo = "Visto";
    if (s.includes("cidadania"))   tipo = "Cidadania";
    if (s.includes("apostila"))    tipo = "Apostila";
    tipoMap[tipo] = (tipoMap[tipo] || 0) + d.valor;
  }

  return { vendas: data, total: totalGeral, mix: tipoMap };
}

function parseEstoque(text) {
  const rows = parseCsv(text);
  // linha 0: título com emoji → pular
  // linha 1: cabeçalhos reais: ITEM, CATEGORIA, FREQUÊNCIA, ÚLTIMA COMPRA, PRÓXIMA COMPRA, QUANTIDADE, VALOR UNIT. (R$), VALOR TOTAL (R$), DIAS
  const header = rows[1];
  const idxItem   = header.indexOf("ITEM");
  const idxCat    = header.indexOf("CATEGORIA");
  const idxQtd    = header.indexOf("QUANTIDADE");
  const idxValU   = header.indexOf("VALOR UNIT. (R$)");
  const idxValT   = header.indexOf("VALOR TOTAL (R$)");
  const idxProx   = header.indexOf("PRÓXIMA COMPRA");
  const result = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r[idxItem]) continue;
    result.push({
      item:      r[idxItem],
      categoria: r[idxCat]  || "",
      qtd:       r[idxQtd]  || "0",
      valorUnit: r[idxValU] || "0",
      valorTotal:r[idxValT] || "0",
      proxCompra:r[idxProx] || "",
    });
  }
  return result;
}

function parseCalendario(text) {
  const rows = parseCsv(text);
  // colunas: Data, Nome, Tipo, País, Natureza
  const hoje = new Date();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[1]) continue;
    const [d, m, a] = r[0].split("/");
    const data = new Date(`${a}-${m}-${d}`);
    const diff = Math.ceil((data - hoje) / 86400000);
    if (diff >= 0 && diff <= 60) {
      result.push({ data: r[0], nome: r[1], tipo: r[2] || "", diff });
    }
  }
  return result.sort((a, b) => a.diff - b.diff).slice(0, 8);
}

// ── Componentes ───────────────────────────────────────────────────────────────
function Card({ title, value, sub, gradient }) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

function Badge({ label, color }) {
  const map = {
    green:  "bg-green-100 text-green-800",
    blue:   "bg-blue-100 text-blue-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red:    "bg-red-100 text-red-800",
    purple: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[color] || map.blue}`}>
      {label}
    </span>
  );
}

// ── App Principal ─────────────────────────────────────────────────────────────
export default function App() {
  const [vendas,     setVendas]     = useState(null);
  const [estoque,    setEstoque]    = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [ultima,     setUltima]     = useState("");

  async function carregar() {
    try {
      const [tv, te, tc] = await Promise.all([
        fetchCsv(URL_VENDAS),
        fetchCsv(URL_ESTOQUE),
        fetchCsv(URL_CALENDARIO),
      ]);
      setVendas(parseVendas(tv));
      setEstoque(parseEstoque(te));
      setCalendario(parseCalendario(tc));
      setUltima(new Date().toLocaleTimeString("pt-BR"));
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, []);

  const mix = vendas?.mix || {};
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);
  const cores = ["bg-blue-500","bg-green-500","bg-purple-500","bg-yellow-500","bg-red-500","bg-pink-500"];

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏛️ Velloso Cidadania</h1>
          <p className="text-sm text-gray-500">Dashboard operacional</p>
        </div>
        <div className="text-xs text-gray-400">
          Atualizado: {ultima || "carregando..."}<br />
          <button onClick={carregar} className="mt-1 text-blue-500 underline">Atualizar agora</button>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card
          title="Vendas do Mês"
          value={brl(vendas?.total || 0)}
          sub={`${vendas?.vendas?.length || 0} contratos`}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
        />
        <Card
          title="Itens em Estoque"
          value={estoque.length}
          sub="categorias ativas"
          gradient="bg-gradient-to-br from-green-500 to-green-700"
        />
        <Card
          title="Eventos (60 dias)"
          value={calendario.length}
          sub="próximos compromissos"
          gradient="bg-gradient-to-br from-purple-500 to-purple-700"
        />
        <Card
          title="Tipos de Serviço"
          value={Object.keys(mix).length}
          sub="no mês atual"
          gradient="bg-gradient-to-br from-orange-500 to-orange-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Vendas */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold text-gray-700 mb-4">💼 Vendas do Mês</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {(vendas?.vendas || []).map((v, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{v.cliente}</p>
                  <Badge label={v.servico || "Serviço"} color="blue" />
                </div>
                <p className="font-bold text-green-600 text-sm">{brl(v.valor)}</p>
              </div>
            ))}
            {!vendas && <p className="text-gray-400 text-sm">Carregando...</p>}
          </div>
        </div>

        {/* Mix de Serviços */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold text-gray-700 mb-4">📊 Mix de Serviços</h2>
          <div className="space-y-3">
            {Object.entries(mix).map(([tipo, val], i) => {
              const pct = mixTotal > 0 ? Math.round((val / mixTotal) * 100) : 0;
              return (
                <div key={tipo}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{tipo}</span>
                    <span className="text-gray-500">{pct}% · {brl(val)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${cores[i % cores.length]} h-2 rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(mix).length === 0 && <p className="text-gray-400 text-sm">Carregando...</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estoque */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold text-gray-700 mb-4">📦 Estoque</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Item</th>
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2 text-center">Qtd</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {estoque.map((e, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-medium text-gray-800">{e.item}</td>
                    <td className="py-2"><Badge label={e.categoria} color="green" /></td>
                    <td className="py-2 text-center text-gray-600">{e.qtd}</td>
                    <td className="py-2 text-right text-gray-700">{brl(e.valorTotal)}</td>
                  </tr>
                ))}
                {estoque.length === 0 && (
                  <tr><td colSpan={4} className="text-gray-400 py-4 text-center">Carregando...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calendário */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold text-gray-700 mb-4">📅 Próximos Eventos (60 dias)</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {calendario.map((e, i) => {
              const color = e.diff <= 7 ? "red" : e.diff <= 15 ? "yellow" : "blue";
              return (
                <div key={i} className="flex items-start justify-between border-b pb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{e.nome}</p>
                    <Badge label={e.tipo} color={color} />
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-xs text-gray-500">{e.data}</p>
                    <p className={`text-xs font-bold ${e.diff <= 7 ? "text-red-500" : "text-gray-400"}`}>
                      {e.diff === 0 ? "Hoje!" : `em ${e.diff}d`}
                    </p>
                  </div>
                </div>
              );
            })}
            {calendario.length === 0 && <p className="text-gray-400 text-sm">Nenhum evento próximo.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}