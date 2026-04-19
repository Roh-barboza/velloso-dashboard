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
    cols.push(cur.trim()); return cols;
  });
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
  const rows = parseCsv(text); const data = []; let total = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1] || r[1].match(/^\d+$/) || !r[3]) continue;
    const valor = parseFloat(String(r[3]).replace(/[^0-9,]/g,"").replace(",",".")) || 0;
    if (valor === 0) continue;
    data.push({ vendedor:r[0]||"", cliente:r[1], servico:r[2]||"Servico", valor });
    total += valor;
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
  return { vendas:data, total, mix };
}
function parseEstoque(text) {
  const rows = parseCsv(text); const h = rows[1]||[];
  const idx = k => h.findIndex(x => x.includes(k));
  const iI=idx("ITEM"),iC=idx("CATEGORIA"),iQ=idx("QUANTIDADE"),iU=idx("VALOR UNIT"),iT=idx("VALOR TOTAL"),iP=idx("PROXIMA");
  return rows.slice(2).filter(r=>r[iI]).map(r=>({item:r[iI],categoria:r[iC]||"",qtd:r[iQ]||"0",valorUnit:r[iU]||"0",valorTotal:r[iT]||"0",proxCompra:r[iP]||""}));
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
  const rows = parseCsv(text); const result = [];
  for (let i=3;i<rows.length;i++) {
    const r=rows[i];
    if(!r[0]||r[0].includes("VELLOSO")||!r[1]) continue;
    if(r.every(c=>!c)) continue;
    result.push({pasta:r[0],familia:r[1],tipo:r[2]||"",vendedor:r[3]||"",responsavel:r[4]||"",etapa:r[5]||"",prazo:r[6]||"",total:r[7]||"0"});
  }
  return result.filter(p=>p.pasta&&p.familia);
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
          {titulo:"Vendas do mês",valor:brl(vendas?.total||0),sub:`${vendas?.vendas?.length||0} contratos`,cor:"#8b6b7d"},
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
function TelaVendas({vendas}) {
  const mix=vendas?.mix||{};
  const mt=Object.values(mix).reduce((a,b)=>a+b,0);
  const cores=["bg-[#592343]","bg-[#ce2b37]","bg-[#8b6b7d]","bg-[#00924a]","bg-[#6b3a5d]"];
  return(
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {label:"Total do Mês",val:brl(vendas?.total||0),cor:"border-[#592343]"},
          {label:"Contratos",val:vendas?.vendas?.length||0,cor:"border-[#8b6b7d]"},
          {label:"Ticket Médio",val:brl(vendas?.vendas?.length?(vendas.total/vendas.vendas.length):0),cor:"border-[#ce2b37]"},
        ].map(c=>(
          <div key={c.label} className={`bg-white rounded-xl shadow p-5 border-l-4 ${c.cor}`}>
            <p className="text-xs text-[#8b6b7d] uppercase font-semibold tracking-wider">{c.label}</p>
            <p className="text-2xl font-bold text-[#592343] mt-1">{c.val}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-xl font-bold text-[#592343] mb-2">Contratos do Mês</h3>
          <div className="border-t-2 border-[#592343] pt-4 space-y-2 max-h-96 overflow-y-auto">
            {(vendas?.vendas||[]).map((v,i)=>(
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#f5ede8] last:border-0">
                <div className="w-8 h-8 rounded-full bg-[#592343] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{v.cliente.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{v.cliente}</p><p className="text-xs text-[#8b6b7d] truncate">{v.servico}</p></div>
                <p className="font-bold text-[#592343] text-sm">{brl(v.valor)}</p>
              </div>
            ))}
            {!vendas&&<p className="text-[#8b6b7d] text-center py-8 text-sm">Carregando...</p>}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-xl font-bold text-[#592343] mb-2">Mix de Serviços</h3>
          <div className="border-t-2 border-[#592343] pt-4 space-y-4">
            {Object.entries(mix).map(([tipo,val],i)=>{const pct=mt>0?Math.round((val/mt)*100):0;return(
              <div key={tipo}>
                <div className="flex justify-between text-sm mb-1"><span className="font-medium">{tipo}</span><span className="text-xs text-[#8b6b7d]">{pct}% · {brl(val)}</span></div>
                <div className="w-full bg-[#f5ede8] rounded-full h-2"><div className={`${cores[i%cores.length]} h-2 rounded-full`} style={{width:`${pct}%`}}/></div>
              </div>
            );})}
            {mt>0&&<div className="pt-3 border-t border-[#e8ddd4] flex justify-between"><span className="text-sm text-[#8b6b7d]">Total</span><span className="font-bold text-[#592343]">{brl(mt)}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PROCESSOS com paginação ── */
const POR_PAG = 20;
function TelaProcessos({processos}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

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

  const etapaCor = e=>{
    if(!e) return "bg-[#f5ede8] text-[#8b6b7d]";
    if(ehFinalizado(e)) return "bg-[#00924a]/10 text-[#00924a]";
    if(e.toLowerCase().includes("andamento")) return "bg-[#592343]/10 text-[#592343]";
    if(e.toLowerCase().includes("pendente")) return "bg-[#ce2b37]/10 text-[#ce2b37]";
    return "bg-[#f5ede8] text-[#8b6b7d]";
  };

  const ativos  = processos.filter(p=>!ehFinalizado(p.etapa)).length;
  const finais  = processos.filter(p=>ehFinalizado(p.etapa)).length;

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
            {totalPags>1&&<span className="text-xs text-[#8b6b7d]">pág. {pagina}/{totalPags}</span>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#faf8f6]">
              <tr>{["Pasta","Família","Tipo","Vendedor","Etapa","Prazo"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#8b6b7d] uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-[#f5ede8]">
              {pagAtual.map((p,i)=>(
                <tr key={i} className={`hover:bg-[#faf8f6] transition-colors ${ehFinalizado(p.etapa)?"opacity-60":""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-[#8b6b7d]">{p.pasta}</td>
                  <td className="px-4 py-3 font-semibold text-[#2a2a2a]">{p.familia}</td>
                  <td className="px-4 py-3 text-[#2a2a2a]">{p.tipo}</td>
                  <td className="px-4 py-3 text-[#2a2a2a]">{p.vendedor}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${etapaCor(p.etapa)}`}>{p.etapa||"--"}</span></td>
                  <td className="px-4 py-3 text-xs text-[#8b6b7d]">{p.prazo||"--"}</td>
                </tr>
              ))}
              {pagAtual.length===0&&<tr><td colSpan={6} className="text-center text-[#8b6b7d] py-10 text-sm">Nenhum processo encontrado.</td></tr>}
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

/* ── ESTOQUE ── */
function TelaEstoque({estoque}) {
  return(
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="p-5 border-b border-[#e8ddd4]"><h3 className="text-xl font-bold text-[#592343]">Controle de Estoque</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#faf8f6]">
            <tr>{["Item","Categoria","Qtd","Valor Unit.","Total","Próx. Compra"].map(h=>(
              <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#8b6b7d] uppercase tracking-wider">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-[#f5ede8]">
            {estoque.map((e,i)=>(
              <tr key={i} className="hover:bg-[#faf8f6] transition-colors">
                <td className="px-4 py-3 font-semibold">{e.item}</td>
                <td className="px-4 py-3"><span className="bg-[#f5ede8] text-[#592343] text-xs font-semibold px-2.5 py-1 rounded-full">{e.categoria}</span></td>
                <td className="px-4 py-3 font-bold">{e.qtd}</td>
                <td className="px-4 py-3 text-[#8b6b7d]">{brl(e.valorUnit)}</td>
                <td className="px-4 py-3 font-bold text-[#592343]">{brl(e.valorTotal)}</td>
                <td className="px-4 py-3 text-xs text-[#8b6b7d]">{e.proxCompra}</td>
              </tr>
            ))}
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