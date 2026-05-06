import { useEffect, useMemo, useState } from "react";

function parseCsv(text) {
  // Parser CSV robusto \u2014 suporta v\u00EDrgulas, aspas e newlines dentro de c\u00E9lulas
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; } // aspas escapadas ("")
        else inQ = false;
      } else {
        cur += c; // mant\u00E9m qualquer caractere dentro das aspas (inclui \n)
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  // Trim c\u00E9lulas e remove linhas totalmente vazias
  return rows
    .map(r => r.map(x => (x || "").trim()))
    .filter(r => r.some(x => x));
}
function brl(val) {
  const n = parseFloat(String(val).replace(/[^0-9,.-]/g,"").replace(",","."));
  return isNaN(n) ? "R$ 0,00" : n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
async function fetchCsv(url) { const r = await fetch(url); return r.text(); }

const LOGO_ID = "1wypkmPUN9alHR55GRptDHmVsxxuTeegO";
const LOGO_PROXY = `https://wsrv.nl/?url=drive.google.com/uc?export%3Dview%26id%3D${LOGO_ID}&w=200&h=200&fit=cover`;

const U_VENDAS     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkhaBtnf2pTwGdZh8VroPSlvAjgfikS2pzrswllPTBJuYQrrB8PEJXKRUvqdzl7oLsU37gMGTEd-qC/pub?output=csv";
const U_ESTOQUE    = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRf8q8phpvkyqstNVcnwL-kpT890VivYhVTIf7zbMsncHk5dcp-_DHGFjzD_5usua-CzsEfRPyPnnn7/pub?output=csv";
const U_CALENDARIO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDxyW-yoO1Y9YngZEL5L4uAKx8Vd9A18Y7oF7OdqvjIUJBGdnuakVX6FJz63m1kb2TnkpFyuGNAuVz/pub?output=csv";
const U_PROCESSOS  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLRDqgcYE4QpXZ3WeGzr5nDeeEVvIDPOVmTdshA0lZEGZA9m3PZSVRBZh30_sROKFJFd4Ll3l-Ar_v/pub?output=csv";

function parseVendas(text) {
  const rows = parseCsv(text);
  const data = [];
  let total = 0, totalConfirmado = 0, totalPrevisao = 0;
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1] || r[1].match(/^\d+$/) || !r[3]) continue;
    // pula linha de cabeçalho "Cliente"
    if (normStr(r[1]) === "cliente") continue;
    const valor = parseFloat(String(r[3]).replace(/[^0-9,]/g,"").replace(",",".")) || 0;
    if (valor === 0) continue;
    // Coluna E (status): se contém "falta", "pendente" ou "assinar" → pendente
    const statusRaw = (r[4] || "").trim();
    const statusN = normStr(statusRaw);
    const pendente = statusN.includes("falta") || statusN.includes("pendente") || statusN.includes("assinar") || statusN.includes("aguard");
    data.push({
      vendedor: r[0]||"",
      cliente: r[1],
      servico: r[2]||"Servico",
      valor,
      pendente,
      status: statusRaw || (pendente ? "Pendente" : "Confirmado"),
    });
    total += valor;
    if (pendente) totalPrevisao += valor;
    else          totalConfirmado += valor;
  }
  const mix = {};
  for (const d of data) {
    const s = d.servico.toLowerCase(); let t = "Outros";
    if (s.includes("consular")) t="Servico Consular";
    else if (s.includes("passaporte")) t="Passaporte";
    else if (s.includes("visto")) t="Visto";
    else if (s.includes("cidadania")) t="Cidadania";
    else if (s.includes("apostila")) t="Apostila";
    mix[t] = (mix[t]||0)+d.valor;
  }
  return { vendas:data, total, totalConfirmado, totalPrevisao, mix };
}
function normStr(s) {
  return (s||"")
    .replace(/\s+/g, " ")          // quebras de linha e tabs viram espaço
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu,"")
    .toLowerCase()
    .trim();
}
function parseEstoque(text) {
  const rows = parseCsv(text);
  // Linha 0 = título mesclado, Linha 1 = cabeçalhos reais
  const h = rows[1] || [];
  // idx normaliza acentos para comparação segura
  const idx = k => h.findIndex(x => normStr(x).includes(normStr(k)));

  const iI  = idx("item");
  const iC  = idx("categoria");
  // "quantidade atual" deve vir ANTES de "quantidade" genérico para pegar a coluna certa
  const iQA = idx("quantidade atual");   // coluna G — QUANTIDADE ATUAL
  const iU  = idx("valor unit");         // coluna H
  const iT  = idx("valor total");        // coluna I
  const iP  = idx("proxima compra");     // coluna E — PRÓXIMA COMPRA (acento removido)

  const SKIP = ["legenda","verde","amarelo","vermelho","compra distante","compra proxima","compra urgente"];

  return rows.slice(2)
    .filter(r => {
      const nome = r[iI] || "";
      if (!nome.trim()) return false;
      const n = normStr(nome);
      return !SKIP.some(s => n.includes(s));
    })
    .map(r => ({
      item:       r[iI]  || "",
      categoria:  r[iC]  || "",
      qtd:        r[iQA] || "0",    // ← QUANTIDADE ATUAL (coluna G)
      valorUnit:  r[iU]  || "0",
      valorTotal: r[iT]  || "0",
      proxCompra: r[iP]  || "",     // ← PRÓXIMA COMPRA (coluna E)
    }));
}
function parseCalendario(text) {
  const rows = parseCsv(text); const result = [];
  for (let i=1;i<rows.length;i++) {
    const r=rows[i]; if(!r[0]||!r[1]) continue;
    const [d,m,a]=r[0].split("/"); if(!d||!m||!a) continue;
    result.push({data:r[0],nome:r[1],tipo:r[2]||"Outro",pais:r[3]||"Brasil",
      dateObj:new Date(`${a}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`),
      dia:parseInt(d),mes:parseInt(m)-1,ano:parseInt(a)});
  }
  return result;
}
function parseProcessos(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  // Encontra a linha de cabeçalho — procura nas primeiras 6 linhas a que tem "pasta" e "familia"
  let hIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const linha = (rows[i] || []).map(normStr).join("|");
    if (linha.includes("pasta") && linha.includes("familia")) { hIdx = i; break; }
  }
  if (hIdx < 0) hIdx = 1; // fallback p/ linha 2

  const h = rows[hIdx] || [];
  // idx procura cabeçalho que CONTÉM o termo (após normalizar acentos e remover quebras)
  const idx = (...keys) => {
    for (const k of keys) {
      const target = normStr(k);
      const i = h.findIndex(x => normStr(x) === target);
      if (i >= 0) return i;
    }
    // segunda tentativa: contém
    for (const k of keys) {
      const target = normStr(k);
      const i = h.findIndex(x => normStr(x).includes(target));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iPasta  = idx("n pasta", "no pasta", "pasta");
  const iFam    = idx("familia", "nome");
  const iTipo   = idx("tipo de servico", "tipo de serv", "servico", "tipo");
  const iVend   = idx("vendedor");
  const iResp   = idx("responsavel", "resp");
  const iEtapa  = idx("etapa atual", "etapa", "status");
  const iPrazo  = idx("prazo");
  const iTotalC = idx("total contrato", "valor contrato");
  const iDataC  = idx("data contrato", "data do contrato");
  const iUltAtt = idx("ult atualizacao", "ultima atualizacao", "ult. atualizacao", "ultima att", "ult att");
  const iUltCtt = idx("ult contato cliente", "ultimo contato", "ult contato", "ult. contato");

  const result = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const pasta = ((iPasta >= 0 ? r[iPasta] : r[0]) || "").trim();
    const familia = ((iFam >= 0 ? r[iFam] : r[1]) || "").trim();
    // Aceita linhas com pasta numérica E família preenchida
    if (!pasta || !familia) continue;
    // Pula a linha de título (que pode conter "VELLOSO")
    if (normStr(pasta).includes("velloso") || normStr(familia).includes("velloso")) continue;
    // Pula linha de cabeçalho duplicada
    if (normStr(pasta) === "pasta" || normStr(pasta) === "n pasta" || normStr(pasta) === "no pasta") continue;

    result.push({
      pasta,
      familia,
      tipo:         ((iTipo  >= 0 ? r[iTipo]  : r[2]) || "").trim(),
      vendedor:     ((iVend  >= 0 ? r[iVend]  : r[3]) || "").trim(),
      responsavel:  ((iResp  >= 0 ? r[iResp]  : r[4]) || "").trim(),
      etapa:        ((iEtapa >= 0 ? r[iEtapa] : r[5]) || "").trim(),
      prazo:        ((iPrazo >= 0 ? r[iPrazo] : r[6]) || "").trim(),
      total:        ((iTotalC>= 0 ? r[iTotalC]: r[7]) || "0").trim(),
      dataContrato: iDataC  >= 0 ? (r[iDataC]  || "").trim() : "",
      ultimaAtt:    iUltAtt >= 0 ? (r[iUltAtt] || "").trim() : "",
      ultimoContato:iUltCtt >= 0 ? (r[iUltCtt] || "").trim() : "",
    });
  }
  return result;
}

const WEEKDAYS_DISPLAY = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];
const MONTHS_DISPLAY   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function evtIcon(tipo) {
  if(!tipo) return "📅";
  if(tipo.includes("nivers")) return "🎂";
  if(tipo.includes("Feriado")) return "🎉";
  if(tipo.includes("Cultural")) return "🎭";
  return "⭐";
}
function evtColor(tipo) {
  if(!tipo||tipo.includes("nivers")) return {bg:"bg-[#592343]/10",border:"border-[#592343]",text:"text-[#592343]"};
  if(tipo.includes("Feriado")) return {bg:"bg-[#ce2b37]/10",border:"border-[#ce2b37]",text:"text-[#ce2b37]"};
  if(tipo.includes("Cultural")) return {bg:"bg-[#00924a]/10",border:"border-[#00924a]",text:"text-[#00924a]"};
  return {bg:"bg-[#592343]/10",border:"border-[#592343]",text:"text-[#592343]"};
}
function ehFinalizado(etapa) {
  if(!etapa) return false;
  const e = etapa.toLowerCase();
  return e.includes("conclu") || e.includes("finaliz") || e.includes("arquiv");
}

/* ── LOGO ── */
function LogoVelloso({collapsed=false}) {
  const [imgOk, setImgOk] = useState(true);
  if(collapsed) return (
    <div className="flex items-center justify-center py-4">
      <div className="w-10 h-10 rounded-full border-2 border-[#592343] overflow-hidden bg-white flex items-center justify-center">
        {imgOk
          ? <img src={LOGO_PROXY} alt="Logo" className="w-full h-full object-cover" onError={()=>setImgOk(false)}/>
          : <span style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:700,color:"#592343"}}>V</span>
        }
      </div>
    </div>
  );
  return (
    <div className="flex flex-col items-center py-8 px-4 border-b border-[#e8ddd4]">
      <div className="w-24 h-24 rounded-full border-4 border-[#592343] overflow-hidden bg-white shadow-lg mb-4 flex items-center justify-center">
        {imgOk
          ? <img src={LOGO_PROXY} alt="Logo Velloso" className="w-full h-full object-cover" onError={()=>setImgOk(false)}/>
          : <svg viewBox="0 0 80 80" width="64" height="64" fill="none" stroke="#592343" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="40" cy="40" r="28"/>
              <path d="M40 12 C32 20 32 60 40 68"/><path d="M40 12 C48 20 48 60 40 68"/>
              <path d="M40 12 C22 22 18 58 40 68"/><path d="M40 12 C58 22 62 58 40 68"/>
              <path d="M13 32 Q40 26 67 32"/><path d="M12 48 Q40 54 68 48"/><path d="M12 40 Q40 38 68 40"/>
            </svg>
        }
      </div>
      <div style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:22,fontWeight:700,letterSpacing:"0.08em",color:"#592343",lineHeight:1}}>VELLOSO</div>
      <div style={{fontFamily:"Inter,'Segoe UI',sans-serif",fontSize:10,letterSpacing:"0.4em",color:"#8b6b7d",textTransform:"uppercase",marginTop:4}}>CIDADANIA</div>
    </div>
  );
}

/* ── ÍCONES ── */
function IcoHome()    { return <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" strokeWidth="2"/><path d="M5 10.5V20h5v-5h4v5h5v-9.5" strokeWidth="2"/></svg>; }
function IcoCal()     { return <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/></svg>; }
function IcoVenda()   { return <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" strokeWidth="2"/><polyline points="16 7 22 7 22 13" strokeWidth="2"/></svg>; }
function IcoProc()    { return <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2"/><polyline points="14 2 14 8 20 8" strokeWidth="2"/><line x1="16" y1="13" x2="8" y2="13" strokeWidth="2"/><line x1="16" y1="17" x2="8" y2="17" strokeWidth="2"/></svg>; }
function IcoEst()     { return <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="2"/></svg>; }
function IcoMenu()    { return <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" strokeWidth="2"/><line x1="3" y1="12" x2="21" y2="12" strokeWidth="2"/><line x1="3" y1="18" x2="21" y2="18" strokeWidth="2"/></svg>; }

const TABS = [
  {id:"inicio",    label:"Início",    icon:<IcoHome/>,  cor:"#592343"},
  {id:"calendario",label:"Calendário",icon:<IcoCal/>,   cor:"#592343"},
  {id:"vendas",    label:"Vendas",    icon:<IcoVenda/>, cor:"#8b6b7d"},
  {id:"processos", label:"Processos", icon:<IcoProc/>,  cor:"#6b3a5d"},
  {id:"estoque",   label:"Estoque",   icon:<IcoEst/>,   cor:"#ce2b37"},
];

/* ── SIDEBAR ── */
function Sidebar({aba, setAba, ultima, carregar}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside style={{
      width: collapsed ? 64 : 220,
      minHeight: "100vh",
      background: "white",
      borderRight: "1px solid #e8ddd4",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s",
      flexShrink: 0,
      position: "sticky",
      top: 0,
    }}>
      <div style={{height:5,display:"flex"}}>
        <div style={{flex:1,background:"#009246"}}/><div style={{flex:1,background:"#ffffff",border:"1px solid #e8ddd4"}}/><div style={{flex:1,background:"#ce2b37"}}/>
      </div>
      <LogoVelloso collapsed={collapsed}/>
      <nav style={{flex:1, padding:"8px 8px"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setAba(t.id)} title={collapsed?t.label:""} style={{
            display:"flex", alignItems:"center", gap:12,
            width:"100%", padding: collapsed?"12px":"12px 16px",
            justifyContent: collapsed?"center":"flex-start",
            borderRadius:8, marginBottom:4,
            background: aba===t.id ? t.cor+"18" : "transparent",
            color: aba===t.id ? t.cor : "#592343",
            border: aba===t.id ? `1.5px solid ${t.cor}40` : "1.5px solid transparent",
            fontWeight: aba===t.id ? 700 : 500,
            fontSize:14, cursor:"pointer", transition:"all .15s",
          }}>
            <span style={{flexShrink:0}}>{t.icon}</span>
            {!collapsed && <span>{t.label}</span>}
          </button>
        ))}
      </nav>
      <div style={{padding:"12px 8px", borderTop:"1px solid #e8ddd4"}}>
        {!collapsed && <p style={{fontSize:10,color:"#8b6b7d",textAlign:"center",marginBottom:6}}>
          {ultima ? `⟳ ${ultima}` : "carregando..."}
        </p>}
        <button onClick={carregar} title="Atualizar" style={{
          width:"100%", padding:"8px", borderRadius:8, border:"1px solid #e8ddd4",
          background:"#faf8f6", cursor:"pointer", color:"#592343", fontSize:12,
          display:"flex", alignItems:"center", justifyContent:"center", gap:6
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M23 4v6h-6" strokeWidth="2"/><path d="M1 20v-6h6" strokeWidth="2"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeWidth="2"/></svg>
          {!collapsed && "Atualizar"}
        </button>
        <button onClick={()=>setCollapsed(c=>!c)} style={{
          width:"100%", marginTop:6, padding:"8px", borderRadius:8, border:"1px solid #e8ddd4",
          background:"#faf8f6", cursor:"pointer", color:"#8b6b7d", fontSize:12,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <IcoMenu/>
        </button>
      </div>
    </aside>
  );
}

/* ── HOME ── */
function TelaInicio({eventos, vendas, processos}) {
  const agora = new Date();
  const [tarefas, setTarefas] = useState([
    {titulo:"Conferir compromissos do dia",feito:true},
    {titulo:"Revisar aniversários e contatos",feito:true},
    {titulo:"Acompanhar processos prioritários",feito:false},
    {titulo:"Atualizar equipe comercial",feito:false},
    {titulo:"Verificar próximos prazos",feito:false},
  ]);
  const toggleTarefa = i => setTarefas(t=>t.map((x,j)=>j===i?{...x,feito:!x.feito}:x));

  const eventosHoje = eventos.filter(e=>e.dia===agora.getDate()&&e.mes===agora.getMonth()&&e.ano===agora.getFullYear());
  const proximos = useMemo(()=>eventos.filter(e=>{const d=Math.ceil((e.dateObj-new Date())/86400000);return d>=0&&d<=7;}).sort((a,b)=>a.dateObj-b.dateObj).slice(0,6),[eventos]);
  const ativos = processos.filter(p=>!ehFinalizado(p.etapa)).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {titulo:"Hoje",valor:agora.toLocaleDateString("pt-BR"),sub:MONTHS_DISPLAY[agora.getMonth()]+" "+agora.getFullYear(),cor:"#592343"},
          {titulo:"Eventos hoje",valor:String(eventosHoje.length),sub:"Aniversários e compromissos",cor:"#ce2b37"},
          {titulo:"Vendas do mês",valor:brl(vendas?.totalConfirmado||0),sub:`✓ ${(vendas?.vendas||[]).filter(v=>!v.pendente).length} confirmados · ⏳ ${(vendas?.vendas||[]).filter(v=>v.pendente).length} pendentes`,cor:"#00924a"},
          {titulo:"Processos ativos",valor:String(ativos),sub:`${processos.length} no total`,cor:"#00924a"},
        ].map(c=>(
          <div key={c.titulo} className="rounded-xl bg-white p-5 shadow border-l-4" style={{borderLeftColor:c.cor}}>
            <p className="text-xs uppercase tracking-wider font-semibold" style={{color:"#8b6b7d"}}>{c.titulo}</p>
            <p className="text-2xl font-bold mt-1" style={{color:"#592343"}}>{c.valor}</p>
            <p className="text-xs mt-1" style={{color:"#8b6b7d"}}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
          <h3 className="text-xl font-bold text-[#592343] mb-1">Resumo do dia</h3>
          <p className="text-xs text-[#8b6b7d] mb-4">{agora.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</p>
          <div className="border-t-2 border-[#592343] pt-4">
            {eventosHoje.length>0 ? (
              <div className="space-y-3">
                {eventosHoje.map((e,i)=>{const c=evtColor(e.tipo); return(
                  <div key={i} className={`rounded-lg border p-4 ${c.bg} ${c.text}`} style={{borderColor:c.border.replace("border-","")}}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{evtIcon(e.tipo)}</span>
                      <div><p className="font-semibold">{e.nome}</p><p className="text-xs opacity-75">{e.tipo} · {e.pais}</p></div>
                    </div>
                  </div>
                );})}
              </div>
            ):(
              <div className="text-center py-8">
                <p className="text-4xl mb-2">📅</p>
                <p className="text-sm text-[#8b6b7d]">Nenhum evento cadastrado para hoje.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xl font-bold text-[#592343]">Tarefas do dia</h3>
            <span className="text-xs text-[#8b6b7d]">{tarefas.filter(t=>t.feito).length}/{tarefas.length}</span>
          </div>
          <div className="w-full bg-[#f5ede8] rounded-full h-1.5 mb-4">
            <div className="h-1.5 rounded-full bg-[#00924a] transition-all" style={{width:`${(tarefas.filter(t=>t.feito).length/tarefas.length)*100}%`}}/>
          </div>
          <div className="border-t-2 border-[#592343] pt-4 space-y-2">
            {tarefas.map((t,i)=>(
              <button key={i} onClick={()=>toggleTarefa(i)} className="w-full flex items-center gap-3 rounded-lg border border-[#e8ddd4] p-3 hover:bg-[#faf8f6] transition-colors text-left">
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${t.feito?"bg-[#00924a] border-[#00924a]":"border-[#592343]"}`}>
                  {t.feito&&<svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" strokeWidth="3"/></svg>}
                </div>
                <p className={`text-sm ${t.feito?"text-[#8b6b7d] line-through":"text-[#2a2a2a]"}`}>{t.titulo}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {proximos.length>0&&(
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-xl font-bold text-[#592343] mb-4">Próximos 7 dias</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {proximos.map((e,i)=>{
              const diff=Math.ceil((e.dateObj-new Date())/86400000);
              return(
                <div key={i} className="rounded-lg border border-[#e8ddd4] p-4 flex items-center gap-3">
                  <span className="text-xl">{evtIcon(e.tipo)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#2a2a2a] truncate text-sm">{e.nome}</p>
                    <p className="text-xs text-[#8b6b7d]">{e.data} · {e.tipo}</p>
                  </div>
                  <span className={`text-xs font-bold flex-shrink-0 ${diff===0?"text-[#ce2b37]":diff<=3?"text-[#592343]":"text-[#8b6b7d]"}`}>
                    {diff===0?"Hoje":`${diff}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CALENDÁRIO ── */
function TelaCalendario({eventos}) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(null);
  const evMes = useMemo(()=>eventos.filter(e=>e.mes===mes&&e.ano===ano),[eventos,mes,ano]);
  const porDia = {};
  for(const e of evMes){if(!porDia[e.dia])porDia[e.dia]=[];porDia[e.dia].push(e);}
  const firstDow = new Date(ano,mes,1).getDay();
  const offset = firstDow===0?6:firstDow-1;
  const diasNoMes = new Date(ano,mes+1,0).getDate();
  const calDays = [...Array(offset).fill(null),...Array.from({length:diasNoMes},(_,i)=>i+1)];
  const weeks = [];
  for(let i=0;i<calDays.length;i+=7)weeks.push(calDays.slice(i,i+7));
  while(weeks[weeks.length-1].length<7)weeks[weeks.length-1].push(null);
  const evDia = diaSel?(porDia[diaSel]||[]):[];
  const proximos = useMemo(()=>eventos.filter(e=>{const d=Math.ceil((e.dateObj-new Date())/86400000);return d>=0&&d<=30;}).sort((a,b)=>a.dateObj-b.dateObj).slice(0,8),[eventos]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={()=>{const d=new Date(ano,mes-1);setMes(d.getMonth());setAno(d.getFullYear());setDiaSel(null);}} className="p-2 hover:bg-[#f5ede8] rounded-lg transition-colors">
            <svg className="w-5 h-5 text-[#592343]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" strokeWidth="2"/></svg>
          </button>
          <h3 className="text-xl font-bold text-[#592343]">{MONTHS_DISPLAY[mes]} {ano}</h3>
          <button onClick={()=>{const d=new Date(ano,mes+1);setMes(d.getMonth());setAno(d.getFullYear());setDiaSel(null);}} className="p-2 hover:bg-[#f5ede8] rounded-lg transition-colors">
            <svg className="w-5 h-5 text-[#592343]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" strokeWidth="2"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS_DISPLAY.map(d=><div key={d} className="text-center font-bold text-[#592343] text-xs py-1">{d}</div>)}
        </div>
        <div className="space-y-1">
          {weeks.map((week,wi)=>(
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day,di)=>{
                const evts=day?porDia[day]:null;
                const hasAniv=evts?.some(e=>e.tipo.includes("nivers"));
                const hasEsp=evts?.some(e=>e.tipo.includes("Feriado")||e.tipo.includes("Cultural"));
                const isHoje=day===hoje.getDate()&&mes===hoje.getMonth()&&ano===hoje.getFullYear();
                return(
                  <button key={di} onClick={()=>day&&setDiaSel(day===diaSel?null:day)}
                    className={["aspect-square rounded-lg text-sm font-semibold transition-all flex flex-col items-center justify-center",
                      !day?"pointer-events-none opacity-0":"",
                      day&&!evts?"bg-[#f5ede8] text-[#2a2a2a] hover:bg-[#e8ddd4]":"",
                      day&&hasEsp?"bg-[#ce2b37]/10 text-[#592343] border-2 border-[#ce2b37]":"",
                      day&&hasAniv&&!hasEsp?"bg-[#592343]/10 text-[#592343] border-2 border-[#592343]":"",
                      day===diaSel?"ring-2 ring-[#592343] ring-offset-1":"",
                      isHoje&&day!==diaSel?"ring-2 ring-[#ce2b37] ring-offset-1":"",
                    ].filter(Boolean).join(" ")}>
                    {day&&<>
                      <span>{day}</span>
                      {evts&&<div className="flex gap-0.5 mt-0.5">
                        {hasEsp&&<div className="w-1.5 h-1.5 bg-[#ce2b37] rounded-full"/>}
                        {hasAniv&&<div className="w-1.5 h-1.5 bg-[#592343] rounded-full"/>}
                      </div>}
                    </>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-[#e8ddd4] flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded border-2 border-[#592343] bg-[#592343]/10"/><span>Aniversários</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded border-2 border-[#ce2b37] bg-[#ce2b37]/10"/><span>Feriados/Eventos</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#f5ede8]"/><span>Sem eventos</span></div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6 sticky top-4 self-start">
        <h3 className="text-lg font-bold text-[#592343]">{diaSel?`${diaSel} de ${MONTHS_DISPLAY[mes]}`:"Selecione um dia"}</h3>
        <div className="border-t-2 border-[#592343] pt-4 mt-3">
          {diaSel&&evDia.length>0?(
            <div className="space-y-3">
              {evDia.map((e,i)=>{const c=evtColor(e.tipo);return(
                <div key={i} className={`p-3 rounded-lg text-sm ${c.bg} ${c.text}`}>
                  <div className="flex gap-2"><span>{evtIcon(e.tipo)}</span><div><p className="font-semibold">{e.nome}</p><p className="text-xs opacity-70">{e.tipo} · {e.pais}</p></div></div>
                </div>
              );})}
            </div>
          ):diaSel?(<p className="text-sm text-[#8b6b7d]">Nenhum evento neste dia.</p>):(
            <>
              <p className="text-xs text-[#8b6b7d] mb-4">Clique em um dia para ver os eventos.</p>
              {proximos.length>0&&<>
                <p className="text-xs font-bold text-[#592343] uppercase tracking-widest mb-3">Próximos 30 dias</p>
                <div className="space-y-2">
                  {proximos.map((e,i)=>{const diff=Math.ceil((e.dateObj-new Date())/86400000);return(
                    <div key={i} className="flex items-center gap-2 py-2 border-b border-[#f5ede8] last:border-0">
                      <span className="text-sm">{evtIcon(e.tipo)}</span>
                      <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{e.nome}</p><p className="text-xs text-[#8b6b7d]">{e.data}</p></div>
                      <span className={`text-xs font-bold ${diff===0?"text-[#ce2b37]":diff<=3?"text-[#592343]":"text-[#8b6b7d]"}`}>{diff===0?"Hoje":`${diff}d`}</span>
                    </div>
                  );})}
                </div>
              </>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── VENDAS ── */
const MEDALHAS_VEND = ["🥇","🥈","🥉","4º","5º"];
const CORES_RANK = ["#d97706","#8b6b7d","#6b3a5d","#592343","#8b6b7d"];

function TelaVendas({vendas}) {
  const mix  = vendas?.mix || {};
  const mt   = Object.values(mix).reduce((a,b)=>a+b,0);
  const cores = ["bg-[#592343]","bg-[#ce2b37]","bg-[#8b6b7d]","bg-[#00924a]","bg-[#6b3a5d]"];

  // Ranking de vendedores
  const rankMap = {};
  (vendas?.vendas||[]).forEach(v => {
    const vend = (v.vendedor||"").trim() || "Não atribuído";
    if (!rankMap[vend]) rankMap[vend] = { total:0, contratos:0 };
    rankMap[vend].total     += v.valor;
    rankMap[vend].contratos += 1;
  });
  const ranking = Object.entries(rankMap)
    .sort((a,b) => b[1].total - a[1].total)
    .slice(0, 5);
  const maxVend = ranking.length > 0 ? ranking[0][1].total : 1;
  const totalReal = vendas?.total || 0;

  const pendentes = (vendas?.vendas||[]).filter(v=>v.pendente).length;

  return(
    <div className="space-y-6">
      {/* KPIs principais — Confirmado vs Previsão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-[#00924a]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✓</span>
            <p className="text-xs text-[#8b6b7d] uppercase font-semibold tracking-wider">Confirmado (Assinado)</p>
          </div>
          <p className="text-2xl font-bold text-[#00924a] mt-1">{brl(vendas?.totalConfirmado||0)}</p>
          <p className="text-xs text-[#8b6b7d] mt-1">{(vendas?.vendas||[]).filter(v=>!v.pendente).length} contrato(s) já assinados</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-[#d97706]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⏳</span>
            <p className="text-xs text-[#8b6b7d] uppercase font-semibold tracking-wider">Aguardando Assinatura</p>
          </div>
          <p className="text-2xl font-bold text-[#d97706] mt-1">{brl(vendas?.totalPrevisao||0)}</p>
          <p className="text-xs text-[#8b6b7d] mt-1">{pendentes} contrato(s) pendente(s)</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-[#592343]" style={{background:"linear-gradient(135deg,#fff 0%,#faf0f6 100%)"}}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📈</span>
            <p className="text-xs text-[#8b6b7d] uppercase font-semibold tracking-wider">Previsão Total do Mês</p>
          </div>
          <p className="text-2xl font-bold text-[#592343] mt-1">{brl(vendas?.total||0)}</p>
          <p className="text-xs text-[#8b6b7d] mt-1">{vendas?.vendas?.length||0} contrato(s) · ticket médio {brl(vendas?.vendas?.length?(vendas.total/vendas.vendas.length):0)}</p>
        </div>
      </div>

      {/* Barra de progresso: confirmado vs previsão */}
      {(vendas?.total||0) > 0 && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-[#592343]">Progresso da Previsão</p>
            <p className="text-xs text-[#8b6b7d]">
              {Math.round(((vendas?.totalConfirmado||0)/(vendas?.total||1))*100)}% confirmado
            </p>
          </div>
          <div className="w-full bg-[#f5ede8] rounded-full h-3 overflow-hidden flex">
            <div
              className="h-3 bg-[#00924a] transition-all"
              style={{width:`${((vendas?.totalConfirmado||0)/(vendas?.total||1))*100}%`}}
              title={`Confirmado: ${brl(vendas?.totalConfirmado||0)}`}
            />
            <div
              className="h-3 bg-[#d97706] transition-all"
              style={{width:`${((vendas?.totalPrevisao||0)/(vendas?.total||1))*100}%`}}
              title={`Aguardando: ${brl(vendas?.totalPrevisao||0)}`}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00924a]"/>
              <span className="text-[#8b6b7d]">Confirmado: <strong className="text-[#00924a]">{brl(vendas?.totalConfirmado||0)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#d97706]"/>
              <span className="text-[#8b6b7d]">Aguardando: <strong className="text-[#d97706]">{brl(vendas?.totalPrevisao||0)}</strong></span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contratos do Mês */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-xl font-bold text-[#592343] mb-2">Contratos do Mês</h3>
          <div className="border-t-2 border-[#592343] pt-4 space-y-2 max-h-96 overflow-y-auto">
            {(vendas?.vendas||[]).map((v,i)=>(
              <div
                key={i}
                className={`flex items-center gap-3 py-2 px-2 rounded-lg border-b border-[#f5ede8] last:border-0 ${v.pendente ? "bg-[#fff7ed]" : ""}`}
                title={v.pendente ? "Aguardando assinatura" : "Confirmado"}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${v.pendente ? "bg-[#d97706]" : "bg-[#00924a]"}`}>
                  {v.cliente.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{v.cliente}</p>
                    {v.pendente && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#d97706]/15 text-[#d97706] whitespace-nowrap">
                        ⏳ Falta assinar
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8b6b7d] truncate">{v.servico}</p>
                </div>
                <p className={`font-bold text-sm whitespace-nowrap ${v.pendente ? "text-[#d97706]" : "text-[#00924a]"}`}>
                  {brl(v.valor)}
                </p>
              </div>
            ))}
            {!vendas&&<p className="text-[#8b6b7d] text-center py-8 text-sm">Carregando...</p>}
          </div>
        </div>

        {/* Mix de Serviços + Ranking */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-xl font-bold text-[#592343] mb-2">Mix de Serviços</h3>
            <div className="border-t-2 border-[#592343] pt-4 space-y-4">
              {Object.entries(mix).map(([tipo,val],i)=>{
                const pct = mt>0 ? Math.round((val/mt)*100) : 0;
                return(
                  <div key={tipo}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{tipo}</span>
                      <span className="text-xs text-[#8b6b7d]">{pct}% · {brl(val)}</span>
                    </div>
                    <div className="w-full bg-[#f5ede8] rounded-full h-2">
                      <div className={`${cores[i%cores.length]} h-2 rounded-full`} style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
              {mt>0&&(
                <div className="pt-3 border-t border-[#e8ddd4] flex justify-between">
                  <span className="text-sm text-[#8b6b7d]">Total</span>
                  <span className="font-bold text-[#592343]">{brl(mt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 🏆 Ranking de Vendedores */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-xl font-bold text-[#592343] mb-2">🏆 Ranking do Mês</h3>
            <div className="border-t-2 border-[#592343] pt-4">
              {ranking.length === 0 ? (
                <p className="text-sm text-[#8b6b7d] text-center py-4">
                  Adicione a coluna <strong>Vendedor</strong> na planilha de vendas para ver o ranking.
                </p>
              ) : (
                <div className="space-y-4">

                  {/* Destaque: Vendedor do Mês */}
                  {(() => {
                    const [nome, dados] = ranking[0];
                    const share = totalReal > 0 ? Math.round((dados.total/totalReal)*100) : 0;
                    return (
                      <div className="rounded-xl p-4 mb-2" style={{background:"linear-gradient(135deg,#592343 0%,#8b3a6d 100%)"}}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">👑</span>
                          <span className="text-xs font-bold uppercase tracking-widest text-white/70">Vendedor do Mês</span>
                        </div>
                        <p className="text-white text-xl font-bold leading-tight">{nome}</p>
                        <div className="flex items-end justify-between mt-2 gap-4">
                          <div>
                            <p className="text-white/60 text-xs">{dados.contratos} contrato{dados.contratos>1?"s":""}</p>
                            <p className="text-white text-2xl font-bold">{brl(dados.total)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white/60 text-xs">participação</p>
                            <p className="text-white text-2xl font-bold">{share}%</p>
                          </div>
                        </div>
                        {/* barra de participação */}
                        <div className="mt-3 w-full bg-white/20 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-white transition-all" style={{width:`${share}%`}}/>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Demais posições */}
                  {ranking.slice(1).map(([nome, dados], i) => {
                    const pct = Math.round((dados.total / maxVend) * 100);
                    return (
                      <div key={nome}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base w-6 flex-shrink-0">{MEDALHAS_VEND[i+1]}</span>
                            <span className="text-sm font-semibold text-[#2a2a2a] truncate max-w-36">{nome}</span>
                            <span className="text-xs text-[#8b6b7d]">{dados.contratos} venda{dados.contratos>1?"s":""}</span>
                          </div>
                          <span className="text-sm font-bold whitespace-nowrap" style={{color:CORES_RANK[i+1]}}>
                            {brl(dados.total)}
                          </span>
                        </div>
                        <div className="w-full bg-[#f5ede8] rounded-full h-2">
                          <div className="h-2 rounded-full transition-all" style={{width:`${pct}%`, background:CORES_RANK[i+1]}}/>
                        </div>
                      </div>
                    );
                  })}

                  {/* Total geral */}
                  <div className="pt-3 border-t border-[#e8ddd4] flex justify-between items-center">
                    <span className="text-sm text-[#8b6b7d]">Total da equipe</span>
                    <span className="font-bold text-[#592343]">{brl(totalReal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 💎 Serviço mais caro */}
          {(() => {
            const todas = vendas?.vendas || [];
            if (todas.length === 0) return null;
            const top = todas.reduce((mx, v) => v.valor > mx.valor ? v : mx, todas[0]);
            return (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-xl font-bold text-[#592343] mb-2">💎 Maior Venda do Mês</h3>
                <div className="border-t-2 border-[#592343] pt-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white text-lg font-bold"
                      style={{background:"linear-gradient(135deg,#ce2b37,#8b3a6d)"}}>
                      {top.vendedor ? top.vendedor.charAt(0).toUpperCase() : top.cliente.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#8b6b7d] uppercase font-semibold tracking-wider mb-0.5">Serviço</p>
                      <p className="font-bold text-[#2a2a2a] text-sm">{top.servico}</p>
                      <p className="text-xs text-[#8b6b7d] mt-1">Cliente: <span className="text-[#592343] font-medium">{top.cliente}</span></p>
                      {top.vendedor && (
                        <p className="text-xs text-[#8b6b7d]">Vendedor: <span className="text-[#592343] font-medium">{top.vendedor}</span></p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#8b6b7d] uppercase font-semibold tracking-wider mb-0.5">Valor</p>
                      <p className="text-2xl font-bold text-[#ce2b37]">{brl(top.valor)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ── ATUALIZAÇÕES DE PROCESSOS (Painel Inteligente) ── */
// Configure aqui a URL do webhook do n8n para sincronizar com a planilha
const WEBHOOK_PROCESSO_UPDATE = ""; // ex: "https://chaoticcow-n8n.cloudfy.live/webhook/atualizar-processo"

const DIAS_LIMITE_URGENCIA = 15; // a partir de X dias sem update, vira "para atualizar"

function diasSemUpdate(dataStr) {
  if (!dataStr) return null;
  const partes = dataStr.trim().split(/[\/\-]/);
  if (partes.length !== 3) return null;
  let [d, m, y] = partes;
  if (y.length === 2) y = "20" + y;
  const dt = new Date(+y, +m - 1, +d);
  if (isNaN(dt)) return null;
  return Math.max(0, Math.floor((new Date() - dt) / 86400000));
}

function hojeKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function loadAtualizadasHoje() {
  try {
    const raw = JSON.parse(localStorage.getItem("velloso_atualizadas") || "{}");
    return raw[hojeKey()] || [];
  } catch { return []; }
}

function saveAtualizadasHoje(lista) {
  try {
    const raw = JSON.parse(localStorage.getItem("velloso_atualizadas") || "{}");
    // limpa registros antigos (>7 dias)
    const limit = new Date(Date.now() - 7 * 86400000);
    const limitKey = `${limit.getFullYear()}-${String(limit.getMonth()+1).padStart(2,"0")}-${String(limit.getDate()).padStart(2,"0")}`;
    for (const k of Object.keys(raw)) if (k < limitKey) delete raw[k];
    raw[hojeKey()] = lista;
    localStorage.setItem("velloso_atualizadas", JSON.stringify(raw));
  } catch {}
}

async function chamarWebhookAtualizacao(pasta, familia) {
  if (!WEBHOOK_PROCESSO_UPDATE) return; // não configurado, ignora
  try {
    await fetch(WEBHOOK_PROCESSO_UPDATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "atualizar",
        pasta,
        familia,
        dataAtualizacao: new Date().toLocaleDateString("pt-BR"),
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) { console.error("[velloso] webhook erro:", e); }
}

async function chamarWebhookEtapa(pasta, familia, novaEtapa) {
  if (!WEBHOOK_PROCESSO_UPDATE) return;
  try {
    await fetch(WEBHOOK_PROCESSO_UPDATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "mudar_etapa",
        pasta,
        familia,
        novaEtapa,
        dataAtualizacao: new Date().toLocaleDateString("pt-BR"),
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) { console.error("[velloso] webhook etapa erro:", e); }
}

/* ── PAINEL ATUALIZE FAMÍLIAS DO DIA (REMOVIDO - mantido apenas o helper) ── */
function _PainelAtualizacoes_DESATIVADO({ processos }) {
  const [atualizadas, setAtualizadas] = useState([]);

  useEffect(() => { setAtualizadas(loadAtualizadasHoje()); }, []);

  const urgentes = useMemo(() => {
    return processos
      .filter(p => !ehFinalizado(p.etapa))
      .map(p => ({
        ...p,
        dias: diasSemUpdate(p.ultimaAtt),
      }))
      .filter(p => p.dias === null || p.dias >= DIAS_LIMITE_URGENCIA)
      .sort((a, b) => {
        // null (sem registro) por último, depois mais dias = mais urgente
        if (a.dias === null && b.dias === null) return 0;
        if (a.dias === null) return 1;
        if (b.dias === null) return -1;
        return b.dias - a.dias;
      });
  }, [processos]);

  const pendentes = urgentes.filter(p => !atualizadas.includes(p.pasta));
  const concluidasHoje = urgentes.filter(p => atualizadas.includes(p.pasta));
  const total = urgentes.length;
  const pct = total > 0 ? Math.round((concluidasHoje.length / total) * 100) : 100;

  function toggleAtualizado(p) {
    const isAdding = !atualizadas.includes(p.pasta);
    const nova = isAdding
      ? [...atualizadas, p.pasta]
      : atualizadas.filter(x => x !== p.pasta);
    setAtualizadas(nova);
    saveAtualizadasHoje(nova);
    if (isAdding) chamarWebhookAtualizacao(p.pasta, p.familia);
  }

  function corDias(dias) {
    if (dias === null) return { bg: "#8b6b7d", label: "Sem registro" };
    if (dias >= 60) return { bg: "#ce2b37", label: `${dias} dias` };
    if (dias >= 30) return { bg: "#d97706", label: `${dias} dias` };
    return { bg: "#592343", label: `${dias} dias` };
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6 border border-[#e8ddd4]">
      {/* Header com gradiente */}
      <div className="p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#592343 0%,#6b3a5d 50%,#8b3a6d 100%)" }}>
        {/* Decoração */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: "white", transform: "translate(40%,-40%)" }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-5" style={{ background: "white", transform: "translate(-30%,30%)" }} />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🎯</span>
              <h3 className="text-xl md:text-2xl font-bold text-white">Atualize as Famílias do Dia</h3>
            </div>
            <p className="text-white/80 text-sm">
              {total === 0
                ? "✨ Nenhuma família precisa de atualização hoje"
                : (
                  <>
                    <strong className="text-white">{pendentes.length}</strong> pendente{pendentes.length !== 1 ? "s" : ""}
                    {" · "}
                    <strong className="text-white">{concluidasHoje.length}</strong> atualizada{concluidasHoje.length !== 1 ? "s" : ""} hoje
                  </>
                )
              }
            </p>
          </div>
          {total > 0 && (
            <div className="text-right">
              <div className="text-4xl font-bold text-white leading-none">{pct}%</div>
              <div className="text-[10px] text-white/70 uppercase tracking-widest mt-1">do dia</div>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="relative w-full bg-white/15 rounded-full h-2 mt-5 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#10b981,#34d399)" }}
            />
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="p-4 md:p-5 space-y-2 max-h-[640px] overflow-y-auto">
        {total === 0 && (
          <div className="text-center py-12">
            <div className="text-7xl mb-3">🎉</div>
            <p className="text-xl font-bold text-[#592343]">Tudo em dia!</p>
            <p className="text-sm text-[#8b6b7d] mt-1">Nenhum processo precisa de atualização agora</p>
          </div>
        )}

        {/* Pendentes */}
        {pendentes.map((p, i) => {
          const c = corDias(p.dias);
          return (
            <button
              key={p.pasta + "-" + i}
              onClick={() => toggleAtualizado(p)}
              className="group w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#e8ddd4] hover:border-[#592343] hover:shadow-md hover:bg-[#faf8f6] transition-all text-left"
            >
              {/* Checkbox */}
              <div className="w-7 h-7 rounded-full border-2 border-[#592343] flex items-center justify-center flex-shrink-0 group-hover:bg-[#592343]/10 transition-all">
                <div className="w-3 h-3 rounded-full bg-[#592343] opacity-0 group-hover:opacity-30 transition-opacity"/>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#2a2a2a] text-base">{p.familia}</span>
                  <span className="font-mono text-[10px] text-[#8b6b7d] bg-[#f5ede8] px-1.5 py-0.5 rounded">#{p.pasta}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-[#8b6b7d] flex-wrap">
                  {p.tipo && <span className="font-medium">{p.tipo}</span>}
                  {p.tipo && p.etapa && <span>·</span>}
                  {p.etapa && <span className="text-[#592343] font-medium">{p.etapa}</span>}
                  {p.responsavel && <><span>·</span><span>{p.responsavel}</span></>}
                </div>
                {p.ultimaAtt && (
                  <p className="text-[10px] text-[#8b6b7d] mt-1">Última atualização: <span className="font-medium">{p.ultimaAtt}</span></p>
                )}
              </div>

              {/* Badge de dias */}
              <div className="flex flex-col items-end flex-shrink-0">
                <span
                  className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full text-white whitespace-nowrap tracking-wider"
                  style={{ background: c.bg, boxShadow: `0 2px 8px ${c.bg}40` }}
                >
                  {c.label}
                </span>
              </div>
            </button>
          );
        })}

        {/* Concluídas hoje */}
        {concluidasHoje.length > 0 && (
          <div className="pt-5 mt-3 border-t border-[#e8ddd4]">
            <p className="text-[10px] uppercase font-bold text-[#00924a] tracking-widest mb-3 flex items-center gap-1.5">
              <span>✓</span>
              <span>Atualizadas hoje ({concluidasHoje.length})</span>
            </p>
            {concluidasHoje.map((p, i) => (
              <button
                key={"done-"+p.pasta+"-"+i}
                onClick={() => toggleAtualizado(p)}
                className="w-full flex items-center gap-4 p-3 rounded-xl bg-[#00924a]/5 border border-[#00924a]/20 mb-2 transition-all text-left opacity-70 hover:opacity-100 hover:bg-[#00924a]/10"
                title="Clique para desfazer"
              >
                <div className="w-7 h-7 rounded-full bg-[#00924a] flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[#2a2a2a] line-through text-sm">{p.familia}</span>
                  <span className="font-mono text-[10px] text-[#8b6b7d] ml-2">#{p.pasta}</span>
                </div>
                <span className="text-[11px] text-[#00924a] font-bold uppercase tracking-wider">✓ Atualizado</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PROCESSOS com paginação ── */
const POR_PAG = 20;
const ETAPAS_PADRAO = [
  "🏛️ Em tramitação judicial",
  "🔍 Em análise",
  "📑 Em coleta de docs",
  "📤 Em envio",
  "⏸️ Pendente",
  "🎬 Iniciar gravações",
  "✅ Concluído",
];

function TelaProcessos({processos}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [atualizadas, setAtualizadas] = useState([]);
  const [etapasLocal, setEtapasLocal] = useState({}); // { pasta: "nova etapa" }

  useEffect(() => { setAtualizadas(loadAtualizadasHoje()); }, []);

  // Lista de etapas únicas (extraídas da planilha + padrão)
  const etapasUnicas = useMemo(() => {
    const set = new Set(ETAPAS_PADRAO);
    for (const p of processos) {
      if (p.etapa && p.etapa.trim()) set.add(p.etapa.trim());
    }
    return Array.from(set);
  }, [processos]);

  const filtered = useMemo(()=>{
    const q = busca.toLowerCase();
    const matches = processos.filter(p=>
      !q || p.familia.toLowerCase().includes(q) ||
      p.tipo.toLowerCase().includes(q) ||
      p.etapa.toLowerCase().includes(q) ||
      p.pasta.toLowerCase().includes(q) ||
      p.vendedor.toLowerCase().includes(q)
    );
    const ativos  = matches.filter(p=>!ehFinalizado(p.etapa));
    const finais  = matches.filter(p=>ehFinalizado(p.etapa));
    return [...ativos, ...finais];
  },[processos, busca]);

  const totalPags = Math.ceil(filtered.length/POR_PAG);
  const pagAtual  = filtered.slice((pagina-1)*POR_PAG, pagina*POR_PAG);

  const ativos  = processos.filter(p=>!ehFinalizado(p.etapa)).length;
  const finais  = processos.filter(p=>ehFinalizado(p.etapa)).length;

  // Marca/desmarca como atualizado hoje
  function toggleAtualizado(p) {
    const isAdding = !atualizadas.includes(p.pasta);
    const nova = isAdding
      ? [...atualizadas, p.pasta]
      : atualizadas.filter(x => x !== p.pasta);
    setAtualizadas(nova);
    saveAtualizadasHoje(nova);
    if (isAdding) chamarWebhookAtualizacao(p.pasta, p.familia);
  }

  // Muda a etapa do processo
  function mudarEtapa(p, novaEtapa) {
    setEtapasLocal(prev => ({ ...prev, [p.pasta]: novaEtapa }));
    chamarWebhookEtapa(p.pasta, p.familia, novaEtapa);
  }

  function getEtapa(p) {
    return etapasLocal[p.pasta] !== undefined ? etapasLocal[p.pasta] : p.etapa;
  }

  function corDias(dias) {
    if (dias === null) return "#8b6b7d";
    if (dias >= 30) return "#ce2b37";
    if (dias >= 15) return "#d97706";
    return "#00924a";
  }

  function corEtapaTexto(e) {
    if (!e) return "#8b6b7d";
    if (ehFinalizado(e)) return "#00924a";
    if (e.toLowerCase().includes("andamento") || e.toLowerCase().includes("tramita")) return "#592343";
    if (e.toLowerCase().includes("pendente")) return "#ce2b37";
    if (e.toLowerCase().includes("analise") || e.toLowerCase().includes("análise")) return "#6b3a5d";
    return "#592343";
  }

  return(
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:"Total",val:processos.length,cor:"#592343"},
          {label:"Em andamento",val:ativos,cor:"#6b3a5d"},
          {label:"Finalizados",val:finais,cor:"#00924a"},
        ].map(c=>(
          <div key={c.label} className="bg-white rounded-xl shadow p-4 border-l-4" style={{borderLeftColor:c.cor}}>
            <p className="text-xs text-[#8b6b7d] uppercase font-semibold">{c.label}</p>
            <p className="text-2xl font-bold mt-1" style={{color:c.cor}}>{c.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-4 flex gap-3 items-center">
        <svg width="16" height="16" fill="none" stroke="#8b6b7d" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2"/></svg>
        <input value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1);}}
          placeholder="Buscar por família, tipo, pasta, vendedor ou etapa..."
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        {busca&&<button onClick={()=>{setBusca("");setPagina(1);}} className="text-[#8b6b7d] hover:text-[#592343] text-xs">✕ limpar</button>}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-4 border-b border-[#e8ddd4] flex justify-between items-center flex-wrap gap-2">
          <h3 className="text-lg font-bold text-[#592343]">Controle de Processos</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8b6b7d]">{filtered.length} encontrados</span>
            {atualizadas.length>0 && <span className="text-xs font-bold text-[#00924a]">✓ {atualizadas.length} atualizadas hoje</span>}
            {totalPags>1&&<span className="text-xs text-[#8b6b7d]">pág. {pagina}/{totalPags}</span>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#faf8f6]">
              <tr>{["Pasta","Família","Tipo","Vendedor","Etapa","Últ. Atualiz.","Dias","✓"].map(h=>(
                <th key={h} className={`px-3 py-3 text-xs font-bold text-[#8b6b7d] uppercase tracking-wider ${h==="✓"||h==="Dias"?"text-center":"text-left"}`}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-[#f5ede8]">
              {pagAtual.map((p,i)=>{
                const etapa = getEtapa(p);
                const dias = diasSemUpdate(p.ultimaAtt);
                const marcado = atualizadas.includes(p.pasta);
                const finalizado = ehFinalizado(etapa);
                return (
                  <tr key={i} className={`hover:bg-[#faf8f6] transition-colors ${finalizado?"opacity-60":""} ${marcado?"bg-[#00924a]/5":""}`}>
                    <td className="px-3 py-2 font-mono text-xs text-[#8b6b7d]">{p.pasta}</td>
                    <td className="px-3 py-2 font-semibold text-[#2a2a2a]">{p.familia}</td>
                    <td className="px-3 py-2 text-xs text-[#2a2a2a]">{p.tipo}</td>
                    <td className="px-3 py-2 text-xs text-[#2a2a2a]">{p.vendedor}</td>
                    <td className="px-3 py-2">
                      <select
                        value={etapa || ""}
                        onChange={e => mudarEtapa(p, e.target.value)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#faf8f6] border border-[#e8ddd4] hover:border-[#592343] focus:border-[#592343] focus:outline-none cursor-pointer transition-colors min-w-[150px]"
                        style={{ color: corEtapaTexto(etapa) }}
                      >
                        <option value="">-- selecione --</option>
                        {etapasUnicas.map(et => (
                          <option key={et} value={et}>{et}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#8b6b7d] whitespace-nowrap">{p.ultimaAtt || "--"}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {dias !== null ? (
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                          style={{ background: corDias(dias) }}
                        >
                          {dias}d
                        </span>
                      ) : <span className="text-xs text-[#e8ddd4]">--</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggleAtualizado(p)}
                        title={marcado ? "Desfazer" : "Marcar como atualizado hoje"}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          marcado
                            ? "bg-[#00924a] border-[#00924a] hover:scale-110"
                            : "border-[#592343] hover:bg-[#592343]/10 hover:scale-110"
                        }`}
                      >
                        {marcado && <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pagAtual.length===0&&<tr><td colSpan={8} className="text-center text-[#8b6b7d] py-10 text-sm">Nenhum processo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>

        {totalPags>1&&(
          <div className="p-4 border-t border-[#e8ddd4] flex items-center justify-center gap-2 flex-wrap">
            <button onClick={()=>setPagina(1)} disabled={pagina===1} className="px-3 py-1.5 rounded-lg border border-[#e8ddd4] text-xs font-semibold text-[#592343] disabled:opacity-30 hover:bg-[#f5ede8] transition-colors">«</button>
            <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1} className="px-3 py-1.5 rounded-lg border border-[#e8ddd4] text-xs font-semibold text-[#592343] disabled:opacity-30 hover:bg-[#f5ede8] transition-colors">‹ Anterior</button>
            {Array.from({length:totalPags},(_,i)=>i+1).filter(p=>p===1||p===totalPags||Math.abs(p-pagina)<=2).reduce((acc,p,i,arr)=>{
              if(i>0&&p-arr[i-1]>1)acc.push(<span key={`d${p}`} className="text-[#8b6b7d] px-1">…</span>);
              acc.push(<button key={p} onClick={()=>setPagina(p)} className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${pagina===p?"bg-[#592343] text-white":"border border-[#e8ddd4] text-[#592343] hover:bg-[#f5ede8]"}`}>{p}</button>);
              return acc;
            },[])}
            <button onClick={()=>setPagina(p=>Math.min(totalPags,p+1))} disabled={pagina===totalPags} className="px-3 py-1.5 rounded-lg border border-[#e8ddd4] text-xs font-semibold text-[#592343] disabled:opacity-30 hover:bg-[#f5ede8] transition-colors">Próxima ›</button>
            <button onClick={()=>setPagina(totalPags)} disabled={pagina===totalPags} className="px-3 py-1.5 rounded-lg border border-[#e8ddd4] text-xs font-semibold text-[#592343] disabled:opacity-30 hover:bg-[#f5ede8] transition-colors">»</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers de data para estoque ── */
function parseDateBR(s) {
  if (!s) return null;
  const [d,m,y] = s.trim().split(/[\/\-]/);
  if (!d||!m||!y) return null;
  return new Date(+y, +m-1, +d);
}
function diasRestantes(s) {
  const dt = parseDateBR(s);
  if (!dt) return null;
  return Math.round((dt - new Date()) / 86400000);
}
function proxCompraStyle(dias) {
  if (dias === null) return { cor:"#8b6b7d", label:null };
  if (dias < 0)  return { cor:"#ce2b37", label:"Atrasado" };
  if (dias < 15) return { cor:"#ce2b37", label:`${dias}d` };
  if (dias < 30) return { cor:"#d97706", label:`${dias}d` };
  return              { cor:"#00924a", label:`${dias}d` };
}

/* ── ESTOQUE ── */
function TelaEstoque({estoque}) {
  return(
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="p-5 border-b border-[#e8ddd4]">
        <h3 className="text-xl font-bold text-[#592343]">Controle de Estoque</h3>
        <div className="flex gap-4 mt-2 text-xs text-[#8b6b7d]">
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#00924a] mr-1"></span>OK (+30d)</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#d97706] mr-1"></span>Em breve (15-30d)</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#ce2b37] mr-1"></span>Urgente (&lt;15d)</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#faf8f6]">
            <tr>{["Item","Categoria","Qtd Atual","Valor Unit.","Total","Próx. Compra"].map(h=>(
              <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#8b6b7d] uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-[#f5ede8]">
            {estoque.map((e,i)=>{
              const dias = diasRestantes(e.proxCompra);
              const {cor, label} = proxCompraStyle(dias);
              return (
                <tr key={i} className="hover:bg-[#faf8f6] transition-colors">
                  <td className="px-4 py-3 font-semibold">{e.item}</td>
                  <td className="px-4 py-3">
                    {e.categoria
                      ? <span className="bg-[#f5ede8] text-[#592343] text-xs font-semibold px-2.5 py-1 rounded-full">{e.categoria}</span>
                      : <span className="text-[#e8ddd4]">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 font-bold text-center">{e.qtd}</td>
                  <td className="px-4 py-3 text-[#8b6b7d]">{brl(e.valorUnit)}</td>
                  <td className="px-4 py-3 font-bold text-[#592343]">{brl(e.valorTotal)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {e.proxCompra ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{color:cor}}>{e.proxCompra}</span>
                        {label && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{background:cor}}>
                            {label}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#e8ddd4]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {estoque.length===0&&<tr><td colSpan={6} className="text-center text-[#8b6b7d] py-10 text-sm">Carregando...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── APP ── */
export default function App() {
  const [aba, setAba] = useState("inicio");
  const [vendas, setVendas] = useState(null);
  const [estoque, setEstoque] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [ultima, setUltima] = useState("");

  async function carregar() {
    try {
      const [tv,te,tc,tp] = await Promise.all([fetchCsv(U_VENDAS),fetchCsv(U_ESTOQUE),fetchCsv(U_CALENDARIO),fetchCsv(U_PROCESSOS)]);
      setVendas(parseVendas(tv)); setEstoque(parseEstoque(te));
      setEventos(parseCalendario(tc)); setProcessos(parseProcessos(tp));
      setUltima(new Date().toLocaleTimeString("pt-BR"));
    } catch(e){console.error(e);}
  }
  useEffect(()=>{carregar();const t=setInterval(carregar,30000);return()=>clearInterval(t);},[]);

  const titulos = {inicio:"Painel do Dia",calendario:"Calendário de Eventos",vendas:"Equipe Comercial",processos:"Processos / CRM",estoque:"Controle de Estoque"};

  return(
    <div style={{display:"flex",minHeight:"100vh",background:"#faf8f6"}}>
      <Sidebar aba={aba} setAba={setAba} ultima={ultima} carregar={carregar}/>
      <main style={{flex:1,overflowX:"hidden"}}>
        <div style={{padding:"32px 32px 64px"}}>
          <div style={{marginBottom:28}}>
            <h1 style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:28,fontWeight:700,color:"#592343",margin:0}}>{titulos[aba]}</h1>
            <p style={{fontSize:13,color:"#8b6b7d",margin:"4px 0 0"}}>Velloso Cidadania · 2026</p>
          </div>
          {aba==="inicio"     && <TelaInicio eventos={eventos} vendas={vendas} processos={processos}/>}
          {aba==="calendario" && <TelaCalendario eventos={eventos}/>}
          {aba==="vendas"     && <TelaVendas vendas={vendas}/>}
          {aba==="processos"  && <TelaProcessos processos={processos}/>}
          {aba==="estoque"    && <TelaEstoque estoque={estoque}/>}
        </div>
      </main>
    </div>
  );
}