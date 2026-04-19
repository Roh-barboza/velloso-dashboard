import { useEffect, useMemo, useState } from "react";

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
  return isNaN(n) ? "R$ 0,00" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function fetchCsv(url) {
  const r = await fetch(url);
  return r.text();
}

const LOGO_URL = "https://drive.google.com/uc?export=view&id=1wypkmPUN9alHR55GRptDHmVsxxuTeegO";

const U_VENDAS     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkhaBtnf2pTwGdZh8VroPSlvAjgfikS2pzrswllPTBJuYQrrB8PEJXKRUvqdzl7oLsU37gMGTEd-qC/pub?output=csv";
const U_ESTOQUE    = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRf8q8phpvkyqstNVcnwL-kpT890VivYhVTIf7zbMsncHk5dcp-_DHGFjzD_5usua-CzsEfRPyPnnn7/pub?output=csv";
const U_CALENDARIO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDxyW-yoO1Y9YngZEL5L4uAKx8Vd9A18Y7oF7OdqvjIUJBGdnuakVX6FJz63m1kb2TnkpFyuGNAuVz/pub?output=csv";
const U_PROCESSOS  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLRDqgcYE4QpXZ3WeGzr5nDeeEVvIDPOVmTdshA0lZEGZA9m3PZSVRBZh30_sROKFJFd4Ll3l-Ar_v/pub?output=csv";

function parseVendas(text) {
  const rows = parseCsv(text);
  const data = [];
  let total = 0;

  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1] || r[1].match(/^\d+$/) || !r[3]) continue;
    const valor = parseFloat(String(r[3]).replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
    if (valor === 0) continue;
    data.push({
      vendedor: r[0] || "",
      cliente: r[1],
      servico: r[2] || "Servico",
      valor
    });
    total += valor;
  }

  const mix = {};
  for (const d of data) {
    const s = d.servico.toLowerCase();
    let t = "Outros";
    if (s.includes("consular")) t = "Servico Consular";
    else if (s.includes("passaporte")) t = "Passaporte";
    else if (s.includes("visto")) t = "Visto";
    else if (s.includes("cidadania")) t = "Cidadania";
    else if (s.includes("apostila")) t = "Apostila";
    mix[t] = (mix[t] || 0) + d.valor;
  }

  return { vendas: data, total, mix };
}

function parseEstoque(text) {
  const rows = parseCsv(text);
  const h = rows[1] || [];
  const idx = k => h.findIndex(x => x.includes(k));
  const iI = idx("ITEM"), iC = idx("CATEGORIA"), iQ = idx("QUANTIDADE"), iU = idx("VALOR UNIT"), iT = idx("VALOR TOTAL"), iP = idx("PROXIMA");

  return rows.slice(2).filter(r => r[iI]).map(r => ({
    item: r[iI],
    categoria: r[iC] || "",
    qtd: r[iQ] || "0",
    valorUnit: r[iU] || "0",
    valorTotal: r[iT] || "0",
    proxCompra: r[iP] || ""
  }));
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
      data: r[0],
      nome: r[1],
      tipo: r[2] || "Outro",
      pais: r[3] || "Brasil",
      dateObj: new Date(`${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`),
      dia: parseInt(d),
      mes: parseInt(m) - 1,
      ano: parseInt(a)
    });
  }

  return result;
}

function parseProcessos(text) {
  const rows = parseCsv(text);
  const result = [];

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || r[0].includes("VELLOSO") || !r[1]) continue;
    if (r.every(c => !c)) continue;

    result.push({
      pasta: r[0],
      familia: r[1],
      tipo: r[2] || "",
      vendedor: r[3] || "",
      responsavel: r[4] || "",
      etapa: r[5] || "",
      prazo: r[6] || "",
      total: r[7] || "0"
    });
  }

  return result.filter(p => p.pasta && p.familia);
}

const WEEKDAYS_DISPLAY = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const MONTHS_DISPLAY = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function evtIcon(tipo) {
  if (!tipo) return "📅";
  if (tipo.includes("nivers")) return "🎂";
  if (tipo.includes("Feriado")) return "🎉";
  if (tipo.includes("Cultural")) return "🎭";
  return "⭐";
}

function evtColor(tipo) {
  if (!tipo) return { bg: "bg-[#592343]/10", border: "border-[#592343]", text: "text-[#592343]" };
  if (tipo.includes("nivers")) return { bg: "bg-[#592343]/10", border: "border-[#592343]", text: "text-[#592343]" };
  if (tipo.includes("Feriado")) return { bg: "bg-[#ce2b37]/10", border: "border-[#ce2b37]", text: "text-[#ce2b37]" };
  if (tipo.includes("Cultural")) return { bg: "bg-[#00924a]/10", border: "border-[#00924a]", text: "text-[#00924a]" };
  return { bg: "bg-[#592343]/10", border: "border-[#592343]", text: "text-[#592343]" };
}

function LogoVelloso() {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-5 flex items-center justify-center">
        <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-[#592343] shadow-lg bg-white">
          <img
            src={LOGO_URL}
            alt="Logo Velloso"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "https://drive.google.com/uc?export=download&id=1wypkmPUN9alHR55GRptDHmVsxxuTeegO";
            }}
          />
        </div>
      </div>

      <div style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 52,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "#592343",
        lineHeight: 1,
        marginBottom: 6
      }}>
        VELLOSO
      </div>

      <div style={{
        fontFamily: "Inter, 'Segoe UI', sans-serif",
        fontSize: 13,
        fontWeight: 400,
        letterSpacing: "0.5em",
        color: "#8b6b7d",
        textTransform: "uppercase",
        marginBottom: 4
      }}>
        CIDADANIA
      </div>
    </div>
  );
}

function IconHome() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" strokeWidth="2"/><path d="M5 10.5V20h14v-9.5" strokeWidth="2"/></svg>;
}
function IconCalendario() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/></svg>;
}
function IconVendas() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" strokeWidth="2"/><polyline points="16 7 22 7 22 13" strokeWidth="2"/></svg>;
}
function IconProcessos() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2"/><polyline points="14 2 14 8 20 8" strokeWidth="2"/><line x1="16" y1="13" x2="8" y2="13" strokeWidth="2"/><line x1="16" y1="17" x2="8" y2="17" strokeWidth="2"/></svg>;
}
function IconEstoque() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="2"/></svg>;
}

const TABS = [
  { id: "inicio", label: "Início", cor: "#592343", icon: <IconHome /> },
  { id: "calendario", label: "Calendário", cor: "#592343", icon: <IconCalendario /> },
  { id: "vendas", label: "Vendas", cor: "#8b6b7d", icon: <IconVendas /> },
  { id: "processos", label: "Processos", cor: "#6b3a5d", icon: <IconProcessos /> },
  { id: "estoque", label: "Estoque", cor: "#ce2b37", icon: <IconEstoque /> },
];

function CardResumo({ titulo, valor, subtitulo, cor = "#592343" }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-lg border-l-4" style={{ borderLeftColor: cor }}>
      <p className="text-xs uppercase tracking-wider text-[#8b6b7d] font-semibold">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-[#592343]">{valor}</p>
      {subtitulo ? <p className="mt-1 text-xs text-[#8b6b7d]">{subtitulo}</p> : null}
    </div>
  );
}

function TelaInicio({ eventos, vendas, processos }) {
  const agora = new Date();
  const hojeDia = agora.getDate();
  const hojeMes = agora.getMonth();
  const hojeAno = agora.getFullYear();

  const eventosHoje = eventos.filter(e => e.dia === hojeDia && e.mes === hojeMes && e.ano === hojeAno);
  const proximos = eventos
    .filter(e => {
      const diff = Math.ceil((e.dateObj - new Date()) / 86400000);
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => a.dateObj - b.dateObj)
    .slice(0, 6);

  const tarefasHoje = [
    { titulo: "Conferir compromissos do dia", status: "feito" },
    { titulo: "Revisar aniversários e contatos", status: "feito" },
    { titulo: "Acompanhar processos prioritários", status: "pendente" },
    { titulo: "Atualizar equipe comercial", status: "pendente" },
    { titulo: "Verificar próximos prazos", status: "pendente" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CardResumo titulo="Hoje" valor={agora.toLocaleDateString("pt-BR")} subtitulo={agora.toLocaleTimeString("pt-BR")} cor="#592343" />
        <CardResumo titulo="Eventos de hoje" valor={String(eventosHoje.length)} subtitulo="Aniversários e compromissos" cor="#ce2b37" />
        <CardResumo titulo="Vendas do mês" valor={brl(vendas?.total || 0)} subtitulo={`${vendas?.vendas?.length || 0} contratos`} cor="#8b6b7d" />
        <CardResumo titulo="Processos" valor={String(processos.length)} subtitulo="Itens carregados da planilha" cor="#00924a" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-2xl font-bold text-[#592343]">Resumo do dia</h3>
          <div className="mt-4 border-t-2 border-[#592343] pt-4">
            {eventosHoje.length > 0 ? (
              <div className="space-y-3">
                {eventosHoje.map((e, i) => {
                  const c = evtColor(e.tipo);
                  return (
                    <div key={i} className={`rounded-lg border p-4 ${c.bg} ${c.text} ${c.border}/30`}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{evtIcon(e.tipo)}</span>
                        <div>
                          <p className="font-semibold">{e.nome}</p>
                          <p className="text-xs opacity-75">{e.tipo} · {e.pais}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#8b6b7d]">Nenhum evento cadastrado para hoje.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-[#592343]">Tarefas do dia</h3>
          <div className="mt-4 border-t-2 border-[#592343] pt-4 space-y-3">
            {tarefasHoje.map((t, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[#e8ddd4] p-3">
                <div className={`h-4 w-4 rounded-full border-2 ${t.status === "feito" ? "bg-[#00924a] border-[#00924a]" : "border-[#592343]"}`}></div>
                <p className={`text-sm ${t.status === "feito" ? "text-[#8b6b7d] line-through" : "text-[#2a2a2a]"}`}>{t.titulo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-[#592343]">Próximos eventos</h3>
        <div className="mt-4 border-t-2 border-[#592343] pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {proximos.length > 0 ? proximos.map((e, i) => {
            const diff = Math.ceil((e.dateObj - new Date()) / 86400000);
            return (
              <div key={i} className="rounded-lg border border-[#e8ddd4] p-4 flex items-center gap-3">
                <div className="text-lg">{evtIcon(e.tipo)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#2a2a2a] truncate">{e.nome}</p>
                  <p className="text-xs text-[#8b6b7d]">{e.data} · {e.tipo}</p>
                </div>
                <div className="text-xs font-bold text-[#592343]">{diff === 0 ? "Hoje" : `${diff}d`}</div>
              </div>
            );
          }) : (
            <p className="text-sm text-[#8b6b7d]">Sem próximos eventos.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TelaCalendario({ eventos }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(null);

  const evMes = useMemo(() => eventos.filter(e => e.mes === mes && e.ano === ano), [eventos, mes, ano]);
  const porDia = {};
  for (const e of evMes) {
    if (!porDia[e.dia]) porDia[e.dia] = [];
    porDia[e.dia].push(e);
  }

  const firstDow = new Date(ano, mes, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const calDays = [...Array(offset).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];
  const weeks = [];
  for (let i = 0; i < calDays.length; i += 7) weeks.push(calDays.slice(i, i + 7));
  while (weeks[weeks.length - 1].length < 7) weeks[weeks.length - 1].push(null);

  const evDia = diaSel ? (porDia[diaSel] || []) : [];
  const proximos = useMemo(() => eventos.filter(e => {
    const d = Math.ceil((e.dateObj - new Date()) / 86400000);
    return d >= 0 && d <= 30;
  }).sort((a, b) => a.dateObj - b.dateObj).slice(0, 6), [eventos]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { const d = new Date(ano, mes - 1); setMes(d.getMonth()); setAno(d.getFullYear()); setDiaSel(null); }} className="p-2 hover:bg-[#f5ede8] rounded-lg transition-colors">
            <svg className="w-6 h-6 text-[#592343]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" strokeWidth="2" /></svg>
          </button>
          <h3 className="text-2xl font-bold text-[#592343]">{MONTHS_DISPLAY[mes]}</h3>
          <button onClick={() => { const d = new Date(ano, mes + 1); setMes(d.getMonth()); setAno(d.getFullYear()); setDiaSel(null); }} className="p-2 hover:bg-[#f5ede8] rounded-lg transition-colors">
            <svg className="w-6 h-6 text-[#592343]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" strokeWidth="2" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-3">
          {WEEKDAYS_DISPLAY.map(d => <div key={d} className="text-center font-bold text-[#592343] text-xs py-2">{d}</div>)}
        </div>

        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                const evts = day ? porDia[day] : null;
                const hasAniv = evts?.some(e => e.tipo.includes("nivers"));
                const hasEsp = evts?.some(e => e.tipo.includes("Feriado") || e.tipo.includes("Cultural"));
                const isHoje = day === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
                const isSel = day === diaSel;

                return (
                  <button
                    key={di}
                    onClick={() => day && setDiaSel(day === diaSel ? null : day)}
                    className={[
                      "aspect-square rounded-lg text-sm font-semibold transition-all relative flex flex-col items-center justify-center",
                      !day ? "pointer-events-none opacity-0" : "",
                      day && !evts ? "bg-[#f5ede8] text-[#2a2a2a] hover:bg-[#e8ddd4] border border-[#e8ddd4]" : "",
                      day && hasEsp ? "bg-[#ce2b37]/10 text-[#592343] border-2 border-[#ce2b37]" : "",
                      day && hasAniv && !hasEsp ? "bg-[#592343]/10 text-[#592343] border-2 border-[#592343]" : "",
                      isSel ? "ring-2 ring-[#592343] ring-offset-2" : "",
                      isHoje && !isSel ? "ring-2 ring-[#ce2b37] ring-offset-1" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {day && <>
                      <span>{day}</span>
                      {evts && <div className="flex gap-0.5 mt-0.5">
                        {hasEsp && <div className="w-1.5 h-1.5 bg-[#ce2b37] rounded-full" />}
                        {hasAniv && <div className="w-1.5 h-1.5 bg-[#592343] rounded-full" />}
                      </div>}
                    </>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-[#e8ddd4]">
          <p className="font-bold text-[#592343] text-xs mb-3">LEGENDA</p>
          <div className="flex flex-wrap gap-4 text-xs text-[#2a2a2a]">
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded border-2 border-[#592343] bg-[#592343]/10" /><span>Aniversários</span></div>
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded border-2 border-[#ce2b37] bg-[#ce2b37]/10" /><span>Feriados / Eventos</span></div>
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded border border-[#e8ddd4] bg-[#f5ede8]" /><span>Sem eventos</span></div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-lg p-6 sticky top-4">
          <h3 className="text-xl font-bold text-[#592343] mb-1">
            {diaSel ? `${diaSel} de ${MONTHS_DISPLAY[mes]}` : "Selecione um dia"}
          </h3>

          <div className="border-t-2 border-[#592343] pt-4 mt-3">
            {diaSel && evDia.length > 0 ? (
              <div className="space-y-3">
                {evDia.map((e, i) => {
                  const c = evtColor(e.tipo);
                  return (
                    <div key={i} className={`p-3 rounded-lg text-sm ${c.bg} ${c.text} border ${c.border}/30`}>
                      <div className="flex items-start gap-2">
                        <span className="text-base">{evtIcon(e.tipo)}</span>
                        <div>
                          <div className="font-semibold text-sm">{e.nome}</div>
                          <div className="text-xs opacity-70 mt-0.5">{e.tipo} · {e.pais}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : diaSel ? (
              <p className="text-[#8b6b7d] text-sm">Nenhum evento neste dia</p>
            ) : (
              <>
                <p className="text-[#8b6b7d] text-sm mb-4">Clique em um dia do calendário para ver os eventos</p>
                {proximos.length > 0 && <>
                  <p className="text-xs font-bold text-[#592343] uppercase tracking-widest mb-3">Próximos eventos</p>
                  <div className="space-y-2">
                    {proximos.map((e, i) => {
                      const diff = Math.ceil((e.dateObj - new Date()) / 86400000);
                      return (
                        <div key={i} className="flex items-center gap-2 py-2 border-b border-[#f5ede8] last:border-0">
                          <span className="text-sm">{evtIcon(e.tipo)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#2a2a2a] truncate">{e.nome}</p>
                            <p className="text-xs text-[#8b6b7d]">{e.data}</p>
                          </div>
                          <span className={`text-xs font-bold flex-shrink-0 ${diff === 0 ? "text-[#ce2b37]" : diff <= 3 ? "text-[#592343]" : "text-[#8b6b7d]"}`}>
                            {diff === 0 ? "Hoje" : `${diff}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TelaVendas({ vendas }) {
  const mix = vendas?.mix || {};
  const mt = Object.values(mix).reduce((a, b) => a + b, 0);
  const cores = ["bg-[#592343]", "bg-[#ce2b37]", "bg-[#8b6b7d]", "bg-[#00924a]", "bg-[#6b3a5d]"];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total do Mês", val: brl(vendas?.total || 0), cor: "border-[#592343]" },
          { label: "Contratos", val: (vendas?.vendas?.length || 0), cor: "border-[#8b6b7d]" },
          { label: "Ticket Médio", val: brl(vendas?.vendas?.length ? (vendas.total / vendas.vendas.length) : 0), cor: "border-[#ce2b37]" },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-xl shadow-lg p-5 border-l-4 ${c.cor}`}>
            <p className="text-xs text-[#8b6b7d] uppercase font-semibold tracking-wider">{c.label}</p>
            <p className="text-2xl font-bold text-[#592343] mt-1">{c.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-[#592343] mb-2">Contratos do Mês</h3>
          <div className="border-t-2 border-[#592343] pt-4 space-y-2 max-h-80 overflow-y-auto">
            {(vendas?.vendas || []).map((v, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#f5ede8] last:border-0">
                <div className="w-8 h-8 rounded-full bg-[#592343] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {v.cliente.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#2a2a2a] text-sm truncate">{v.cliente}</p>
                  <p className="text-xs text-[#8b6b7d] truncate">{v.servico}</p>
                </div>
                <p className="font-bold text-[#592343] text-sm flex-shrink-0">{brl(v.valor)}</p>
              </div>
            ))}
            {!vendas && <p className="text-[#8b6b7d] text-center py-8 text-sm">Carregando...</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-[#592343] mb-2">Mix de Serviços</h3>
          <div className="border-t-2 border-[#592343] pt-4 space-y-4">
            {Object.entries(mix).map(([tipo, val], i) => {
              const pct = mt > 0 ? Math.round((val / mt) * 100) : 0;
              return (
                <div key={tipo}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-[#2a2a2a]">{tipo}</span>
                    <span className="text-[#8b6b7d] text-xs">{pct}% · {brl(val)}</span>
                  </div>
                  <div className="w-full bg-[#f5ede8] rounded-full h-2">
                    <div className={`${cores[i % cores.length]} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {mt > 0 && <div className="pt-3 border-t border-[#e8ddd4] flex justify-between">
              <span className="text-sm text-[#8b6b7d]">Total</span>
              <span className="font-bold text-[#592343]">{brl(mt)}</span>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TelaProcessos({ processos }) {
  const [busca, setBusca] = useState("");
  const fil = processos.filter(p =>
    p.familia.toLowerCase().includes(busca.toLowerCase()) ||
    p.tipo.toLowerCase().includes(busca.toLowerCase()) ||
    p.etapa.toLowerCase().includes(busca.toLowerCase())
  );

  const etapaCor = e => {
    if (!e) return "bg-[#f5ede8] text-[#8b6b7d]";
    if (e.includes("Conclu")) return "bg-[#00924a]/10 text-[#00924a]";
    if (e.includes("andamento")) return "bg-[#592343]/10 text-[#592343]";
    if (e.includes("Pendente")) return "bg-[#ce2b37]/10 text-[#ce2b37]";
    return "bg-[#f5ede8] text-[#8b6b7d]";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-4">
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por família, tipo ou etapa..."
          className="w-full border border-[#e8ddd4] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#592343] transition-colors"
        />
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#e8ddd4] flex justify-between items-center">
          <h3 className="text-xl font-bold text-[#592343]">Controle de Processos</h3>
          <span className="text-sm text-[#8b6b7d]">{fil.length} processos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#faf8f6]">
              <tr>{["Pasta", "Família", "Tipo", "Vendedor", "Etapa", "Prazo"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#8b6b7d] uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-[#f5ede8]">
              {fil.slice(0, 50).map((p, i) => (
                <tr key={i} className="hover:bg-[#faf8f6] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#8b6b7d]">{p.pasta}</td>
                  <td className="px-4 py-3 font-semibold text-[#2a2a2a]">{p.familia}</td>
                  <td className="px-4 py-3 text-[#2a2a2a]">{p.tipo}</td>
                  <td className="px-4 py-3 text-[#2a2a2a]">{p.vendedor}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${etapaCor(p.etapa)}`}>{p.etapa || "--"}</span></td>
                  <td className="px-4 py-3 text-xs text-[#8b6b7d]">{p.prazo || "--"}</td>
                </tr>
              ))}
              {fil.length === 0 && <tr><td colSpan={6} className="text-center text-[#8b6b7d] py-10 text-sm">Nenhum processo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TelaEstoque({ estoque }) {
  return (
    <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-5 border-b border-[#e8ddd4]">
        <h3 className="text-xl font-bold text-[#592343]">Controle de Estoque</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#faf8f6]">
            <tr>{["Item", "Categoria", "Qtd", "Valor Unit.", "Total", "Próx. Compra"].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#8b6b7d] uppercase tracking-wider">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-[#f5ede8]">
            {estoque.map((e, i) => (
              <tr key={i} className="hover:bg-[#faf8f6] transition-colors">
                <td className="px-4 py-3 font-semibold text-[#2a2a2a]">{e.item}</td>
                <td className="px-4 py-3"><span className="bg-[#f5ede8] text-[#592343] text-xs font-semibold px-2.5 py-1 rounded-full">{e.categoria}</span></td>
                <td className="px-4 py-3 font-bold text-[#2a2a2a]">{e.qtd}</td>
                <td className="px-4 py-3 text-[#8b6b7d]">{brl(e.valorUnit)}</td>
                <td className="px-4 py-3 font-bold text-[#592343]">{brl(e.valorTotal)}</td>
                <td className="px-4 py-3 text-xs text-[#8b6b7d]">{e.proxCompra}</td>
              </tr>
            ))}
            {estoque.length === 0 && <tr><td colSpan={6} className="text-center text-[#8b6b7d] py-10 text-sm">Carregando...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [aba, setAba] = useState("inicio");
  const [vendas, setVendas] = useState(null);
  const [estoque, setEstoque] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [ultima, setUltima] = useState("");

  async function carregar() {
    try {
      const [tv, te, tc, tp] = await Promise.all([
        fetchCsv(U_VENDAS),
        fetchCsv(U_ESTOQUE),
        fetchCsv(U_CALENDARIO),
        fetchCsv(U_PROCESSOS)
      ]);

      setVendas(parseVendas(tv));
      setEstoque(parseEstoque(te));
      setEventos(parseCalendario(tc));
      setProcessos(parseProcessos(tp));
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

  const titulos = {
    inicio: "Painel do Dia",
    calendario: "Calendário de Eventos",
    vendas: "Equipe Comercial",
    processos: "Processos / CRM",
    estoque: "Controle de Estoque"
  };

  return (
    <div className="min-h-screen" style={{ background: "#faf8f6" }}>
      <div style={{ height: 5, display: "flex" }}>
        <div style={{ flex: 1, background: "#009246" }} />
        <div style={{ flex: 1, background: "#ffffff" }} />
        <div style={{ flex: 1, background: "#ce2b37" }} />
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 24px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <LogoVelloso />

          <h2 style={{
            fontFamily: "Georgia,'Times New Roman',serif",
            fontSize: 26,
            fontWeight: 700,
            color: "#592343",
            marginBottom: 4,
            marginTop: 8
          }}>
            {titulos[aba]}
          </h2>

          <p style={{ fontSize: 16, color: "#8b6b7d", marginBottom: 28 }}>2026</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 10 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setAba(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 22px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all .2s",
                  background: aba === t.id ? t.cor : "white",
                  color: aba === t.id ? "white" : "#592343",
                  border: aba === t.id ? `2px solid ${t.cor}` : "2px solid #592343",
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, color: "#8b6b7d", marginBottom: 0 }}>
            Atualizado: {ultima || "carregando..."} &nbsp;·&nbsp;
            <button
              onClick={carregar}
              style={{ color: "#592343", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: 11 }}
            >
              atualizar agora
            </button>
          </p>
        </div>

        {aba === "inicio" && <TelaInicio eventos={eventos} vendas={vendas} processos={processos} />}
        {aba === "calendario" && <TelaCalendario eventos={eventos} />}
        {aba === "vendas" && <TelaVendas vendas={vendas} />}
        {aba === "processos" && <TelaProcessos processos={processos} />}
        {aba === "estoque" && <TelaEstoque estoque={estoque} />}
      </div>

      <div style={{ marginTop: 64, background: "#592343" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", textAlign: "center" }}>
          <p style={{ color: "white", fontWeight: 600, fontSize: 16, fontFamily: "Georgia,'Times New Roman',serif" }}>
            VELLOSO CIDADANIA
          </p>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 4 }}>
            Assessoria em Cidadania Italiana
          </p>
        </div>
      </div>
    </div>
  );
}