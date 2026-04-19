import { useState, useEffect, useCallback } from "react";

const SHEETS = {
  processos:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLRDqgcYE4QpXZ3WeGzr5nDeeEVvIDPOVmTdshA0lZEGZA9m3PZSVRBZh30_sROKFJFd4Ll3l-Ar_v/pub?output=csv",
  vendas:     "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkhaBtnf2pTwGdZh8VroPSlvAjgfikS2pzrswllPTBJuYQrrB8PEJXKRUvqdzl7oLsU37gMGKEd-qC/pub?output=csv",
  estoque:    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRf8q8phpvkyqstNVcnwL-kpT890VivYhVTIf7zbMsncHk5dcp-_DHGFjzD_5usua-CzsEfRPyPnnn7/pub?output=csv",
  calendario: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDxyW-yoO1Y9YngZEL5L4uAKx8Vd9A18Y7oF7OdqvjIUJBGdnuakVX6FJz63m1kb2TnkpFyuGNAuVz/pub?output=csv",
};

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function col(row, ...keys) {
  for (const k of keys) {
    const match = Object.keys(row).find((r) => r.includes(k.toLowerCase()));
    if (match && row[match] !== undefined && row[match] !== "") return row[match];
  }
  return "";
}

function useSheet(url) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const res = await fetch(url + "&t=" + Date.now());
      setData(parseCSV(await res.text()));
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);
  return { data, error, loading };
}

function Badge({ label, color = "gray" }) {
  const c = { green:"bg-green-100 text-green-800", yellow:"bg-yellow-100 text-yellow-800", red:"bg-red-100 text-red-800", blue:"bg-blue-100 text-blue-800", gray:"bg-gray-100 text-gray-700", purple:"bg-purple-100 text-purple-800" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c[color]??c.gray}`}>{label}</span>;
}

function KpiCard({ title, value, sub, color="blue" }) {
  const r = { blue:"border-blue-400", green:"border-green-400", yellow:"border-yellow-400", red:"border-red-400", purple:"border-purple-400" };
  return (
    <div className={`bg-white rounded-2xl shadow p-5 border-l-4 ${r[color]??r.blue}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Bar({ pct, color="blue" }) {
  const bg = { blue:"bg-blue-500", green:"bg-green-500", yellow:"bg-yellow-400", red:"bg-red-500" };
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-2 rounded-full ${bg[color]??bg.blue} transition-all`} style={{width:`${Math.min(100,Math.max(0,pct))}%`}} />
    </div>
  );
}

function Offline() {
  return <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm"><span>âš ï¸</span> Planilha offline. Dados podem estar desatualizados.</div>;
}

function sColor(s="") {
  s=s.toLowerCase();
  if(s.includes("conclu")||s.includes("entregue")||s.includes("pronto")) return "green";
  if(s.includes("andamento")||s.includes("em curso")) return "blue";
  if(s.includes("aguard")||s.includes("pendente")) return "yellow";
  if(s.includes("cancel")||s.includes("bloqueado")) return "red";
  return "gray";
}

function sPct(s="") {
  s=s.toLowerCase();
  if(s.includes("conclu")||s.includes("entregue")) return 100;
  if(s.includes("andamento")) return 60;
  if(s.includes("aguard")||s.includes("pendente")) return 30;
  if(s.includes("cancel")) return 0;
  return 20;
}

const TABS = ["Visao Geral","Processos","Vendas","Estoque","Financeiro","Tarefas","Calendario"];

function TabVisaoGeral({ processos, vendas, estoque }) {
  const totalReceita = vendas.data.reduce((acc,r) => acc + (parseFloat(col(r,"valor","receita","total").replace(/[^\d.,]/g,"").replace(",","."))||0), 0);
  const clientesAtivos = processos.data.filter(r => { const s=col(r,"status").toLowerCase(); return !s.includes("cancel")&&!s.includes("conclu")&&r[Object.keys(r)[0]]; }).length;
  const ticket = vendas.data.length>0 ? totalReceita/vendas.data.length : 0;
  const srvMap = {};
  processos.data.forEach(r => { const s=col(r,"servico","tipo","produto","categoria")||"Outros"; srvMap[s]=(srvMap[s]||0)+1; });
  const alertas = estoque.data.filter(r => (parseFloat(col(r,"qtd","quantidade","estoque"))||0) <= (parseFloat(col(r,"min","minimo"))||2));
  return (
    <div className="space-y-6">
      {(processos.error||vendas.error||estoque.error)&&<Offline/>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Contratos ativos" value={clientesAtivos||"â€”"} sub="sem cancelados" color="blue"/>
        <KpiCard title="Receita total" value={totalReceita?`R$ ${totalReceita.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"â€”"} color="green"/>
        <KpiCard title="Ticket medio" value={ticket?`R$ ${ticket.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"â€”"} color="purple"/>
        <KpiCard title="Alertas estoque" value={alertas.length||"0"} color={alertas.length>0?"red":"green"}/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Mix de servicos</h3>
          {Object.keys(srvMap).length===0?<p className="text-sm text-gray-400">Sem dados.</p>:(
            <ul className="space-y-2">
              {Object.entries(srvMap).sort((a,b)=>b[1]-a[1]).map(([s,n])=>(
                <li key={s} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-40 truncate">{s}</span>
                  <div className="flex-1"><Bar pct={(n/processos.data.length)*100} color="blue"/></div>
                  <span className="text-xs text-gray-500 w-6 text-right">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Alertas de estoque</h3>
          {alertas.length===0?<p className="text-sm text-green-600">Estoque OK.</p>:(
            <ul className="space-y-2">
              {alertas.map((r,i)=>(
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{col(r,"item","nome","produto")||`Item ${i+1}`}</span>
                  <Badge label={`Qtd: ${col(r,"qtd","quantidade","estoque")}`} color="red"/>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-2">Sobre o escritorio</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600">
          <div>Cidadania italiana</div><div>Passaporte / AIRE</div><div>Declaracao de Valor</div>
          <div>Prenotami</div><div>~80 contratos ativos</div><div>Meta: R$50k/mes</div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Decreto 36/2025 â€” restricao via judicial em vigor.</p>
      </div>
    </div>
  );
}

function TabProcessos({ processos }) {
  const [busca,setBusca]=useState("");
  const [filtro,setFiltro]=useState("Todos");
  const statuses=["Todos",...Array.from(new Set(processos.data.map(r=>col(r,"status")).filter(Boolean)))];
  const lista=processos.data.filter(r=>{
    const n=col(r,"nome","cliente","razao").toLowerCase();
    const s=col(r,"servico","tipo","produto").toLowerCase();
    const st=col(r,"status");
    return (busca===""||n.includes(busca.toLowerCase())||s.includes(busca.toLowerCase()))&&(filtro==="Todos"||st===filtro);
  });
  return (
    <div className="space-y-4">
      {processos.error&&<Offline/>}
      <div className="flex flex-wrap gap-3">
        <input className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Buscar cliente ou servico..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <select className="border rounded-xl px-3 py-2 text-sm" value={filtro} onChange={e=>setFiltro(e.target.value)}>
          {statuses.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      {processos.loading?<p className="text-sm text-gray-400">Carregando...</p>:lista.length===0?<p className="text-sm text-gray-400">Nenhum processo.</p>:(
        <div className="space-y-3">
          {lista.map((r,i)=>{
            const nome=col(r,"nome","cliente","razao")||`Cliente ${i+1}`;
            const srv=col(r,"servico","tipo","produto")||"â€”";
            const st=col(r,"status")||"â€”";
            const obs=col(r,"obs","observacao","nota");
            const p=sPct(st); const c=sColor(st);
            return (
              <div key={i} className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div><p className="font-semibold text-gray-800">{nome}</p><p className="text-xs text-gray-500">{srv}</p></div>
                  <Badge label={st} color={c}/>
                </div>
                <Bar pct={p} color={c==="gray"?"blue":c}/>
                <p className="text-xs text-right text-gray-400 mt-1">{p}%</p>
                {obs&&<p className="text-xs text-gray-500 mt-1 italic">{obs}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabVendas({ vendas }) {
  const total=vendas.data.reduce((a,r)=>a+(parseFloat(col(r,"valor","receita","total").replace(/[^\d.,]/g,"").replace(",","."))||0),0);
  const por={};
  vendas.data.forEach(r=>{
    const d=col(r,"data","date","mes"); const k=d?d.slice(0,7):"s/d";
    por[k]=(por[k]||0)+(parseFloat(col(r,"valor","receita","total").replace(/[^\d.,]/g,"").replace(",","."))||0);
  });
  const meses=Object.entries(por).sort((a,b)=>a[0].localeCompare(b[0]));
  const mx=Math.max(...meses.map(([,v])=>v),1);
  return (
    <div className="space-y-4">
      {vendas.error&&<Offline/>}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard title="Receita total" value={`R$ ${total.toLocaleString("pt-BR",{minimumFractionDigits:2})}`} color="green"/>
        <KpiCard title="Num de vendas" value={vendas.data.length} color="blue"/>
      </div>
      {meses.length>0&&(
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Receita por mes</h3>
          <div className="space-y-3">
            {meses.map(([m,v])=>(
              <div key={m} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">{m}</span>
                <div className="flex-1"><Bar pct={(v/mx)*100} color="green"/></div>
                <span className="text-xs text-gray-600 w-28 text-right">R$ {v.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Historico</h3>
        {vendas.loading?<p className="text-sm text-gray-400">Carregando...</p>:vendas.data.length===0?<p className="text-sm text-gray-400">Sem registros.</p>:(
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 border-b">{Object.keys(vendas.data[0]).slice(0,6).map(h=><th key={h} className="pb-2 pr-4 font-medium capitalize">{h}</th>)}</tr></thead>
              <tbody>{vendas.data.map((r,i)=><tr key={i} className="border-b last:border-0 hover:bg-gray-50">{Object.values(r).slice(0,6).map((v,j)=><td key={j} className="py-2 pr-4 text-gray-700">{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TabEstoque({ estoque }) {
  return (
    <div className="space-y-4">
      {estoque.error&&<Offline/>}
      {estoque.loading?<p className="text-sm text-gray-400">Carregando...</p>:estoque.data.length===0?<p className="text-sm text-gray-400">Sem itens.</p>:(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {estoque.data.map((r,i)=>{
            const nome=col(r,"item","nome","produto")||`Item ${i+1}`;
            const qtd=parseFloat(col(r,"qtd","quantidade","estoque"))||0;
            const min=parseFloat(col(r,"min","minimo"))||2;
            const al=qtd<=min;
            return (
              <div key={i} className={`bg-white rounded-2xl shadow p-4 border-l-4 ${al?"border-red-400":"border-green-400"}`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium text-gray-800">{nome}</p>
                  <Badge label={al?"Repor":"OK"} color={al?"red":"green"}/>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>Qtd: <strong className="text-gray-800">{qtd}</strong></span>
                  <span>Min: <strong className="text-gray-800">{min}</strong></span>
                </div>
                <Bar pct={min>0?(qtd/(min*3))*100:100} color={al?"red":"green"}/>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabFinanceiro() {
  const LIMITE=500;
  const [gastos,setGastos]=useState([
    {desc:"Cafe + material escritorio",valor:45.90,data:"2026-04-15"},
    {desc:"Impressao documentos",valor:28.00,data:"2026-04-16"},
  ]);
  const [desc,setDesc]=useState(""); const [val,setVal]=useState(""); const [dt,setDt]=useState(new Date().toISOString().slice(0,10));
  const total=gastos.reduce((a,g)=>a+g.valor,0);
  const saldo=LIMITE-total; const pct=(total/LIMITE)*100;
  function add(){if(!desc||!val)return;setGastos([...gastos,{desc,valor:parseFloat(val),data:dt}]);setDesc("");setVal("");setDt(new Date().toISOString().slice(0,10));}
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard title="Limite cartao" value={`R$ ${LIMITE.toFixed(2)}`} color="blue"/>
        <KpiCard title="Gasto acumulado" value={`R$ ${total.toFixed(2)}`} color={pct>80?"red":"yellow"}/>
        <KpiCard title="Saldo disponivel" value={`R$ ${saldo.toFixed(2)}`} color={saldo<50?"red":"green"}/>
      </div>
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-700">Uso do cartao</h3>
          <span className="text-sm text-gray-500">{pct.toFixed(0)}%</span>
        </div>
        <Bar pct={pct} color={pct>80?"red":pct>50?"yellow":"green"}/>
      </div>
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Registrar gasto</h3>
        <div className="flex flex-wrap gap-2">
          <input className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-40" placeholder="Descricao" value={desc} onChange={e=>setDesc(e.target.value)}/>
          <input className="border rounded-xl px-3 py-2 text-sm w-28" placeholder="Valor R$" type="number" value={val} onChange={e=>setVal(e.target.value)}/>
          <input className="border rounded-xl px-3 py-2 text-sm w-36" type="date" value={dt} onChange={e=>setDt(e.target.value)}/>
          <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">+ Adicionar</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Lancamentos</h3>
        {gastos.length===0?<p className="text-sm text-gray-400">Nenhum.</p>:(
          <ul className="divide-y">
            {gastos.map((g,i)=>(
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <div><p className="text-gray-800">{g.desc}</p><p className="text-xs text-gray-400">{g.data}</p></div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-700">R$ {g.valor.toFixed(2)}</span>
                  <button onClick={()=>setGastos(gastos.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600 text-xs">x</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const PRIOS=["alta","media","baixa"];
const PC={alta:"red",media:"yellow",baixa:"gray"};

function TabTarefas() {
  const [tarefas,setTarefas]=useState([
    {t:"Enviar documentos cliente Silva",p:"alta",f:false},
    {t:"Ligar para consulado SP",p:"alta",f:false},
    {t:"Atualizar planilha processos",p:"media",f:false},
    {t:"Reuniao Rodrigo - MKT",p:"media",f:true},
    {t:"Repor papel A4",p:"baixa",f:false},
  ]);
  const [txt,setTxt]=useState(""); const [prio,setPrio]=useState("media");
  function add(){if(!txt.trim())return;setTarefas([{t:txt.trim(),p:prio,f:false},...tarefas]);setTxt("");}
  const pend=tarefas.filter(x=>!x.f); const conc=tarefas.filter(x=>x.f);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Nova tarefa</h3>
        <div className="flex gap-2 flex-wrap">
          <input className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-48" placeholder="Descricao..." value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
          <select className="border rounded-xl px-3 py-2 text-sm" value={prio} onChange={e=>setPrio(e.target.value)}>{PRIOS.map(p=><option key={p}>{p}</option>)}</select>
          <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">+ Adicionar</button>
        </div>
      </div>
      {[["Pendentes",pend],["Concluidas",conc]].map(([label,lista])=>lista.length>0&&(
        <div key={label} className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">{label} ({lista.length})</h3>
          <ul className="space-y-2">
            {lista.map(item=>{
              const i=tarefas.indexOf(item);
              return (
                <li key={i} className="flex items-center gap-3">
                  <input type="checkbox" checked={item.f} onChange={()=>setTarefas(tarefas.map((x,j)=>j===i?{...x,f:!x.f}:x))} className="w-4 h-4 accent-blue-600"/>
                  <span className={`flex-1 text-sm ${item.f?"line-through text-gray-400":"text-gray-800"}`}>{item.t}</span>
                  <Badge label={item.p} color={PC[item.p]}/>
                  <button onClick={()=>setTarefas(tarefas.filter((_,j)=>j!==i))} className="text-gray-300 hover:text-red-400 text-xs">x</button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TabCalendario({ calendario }) {
  const hoje=new Date().toISOString().slice(0,10);
  const ev=calendario.data.map(r=>({
    data:col(r,"data","date","dia"),titulo:col(r,"titulo","evento","nome","descricao"),
    tipo:col(r,"tipo","categoria"),hora:col(r,"hora","horario","time"),
  })).filter(e=>e.titulo).sort((a,b)=>a.data.localeCompare(b.data));
  const fut=ev.filter(e=>e.data>=hoje); const pas=ev.filter(e=>e.data<hoje);
  function tc(t=""){t=t.toLowerCase();if(t.includes("reunia"))return"blue";if(t.includes("prazo"))return"red";if(t.includes("consular"))return"purple";return"gray";}
  return (
    <div className="space-y-4">
      {calendario.error&&<Offline/>}
      {calendario.loading?<p className="text-sm text-gray-400">Carregando...</p>:ev.length===0?<p className="text-sm text-gray-400">Sem eventos.</p>:(
        <>
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Proximos eventos ({fut.length})</h3>
            {fut.length===0?<p className="text-sm text-gray-400">Sem eventos futuros.</p>:(
              <ul className="space-y-3">
                {fut.map((e,i)=>(
                  <li key={i} className="flex items-start gap-3">
                    <div className="bg-blue-50 rounded-xl px-3 py-2 text-center min-w-14">
                      <p className="text-xs text-blue-400 font-medium">{e.data.slice(5,7)}/{e.data.slice(0,4)}</p>
                      <p className="text-lg font-bold text-blue-700">{e.data.slice(8,10)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{e.titulo}</p>
                      {e.hora&&<p className="text-xs text-gray-400">{e.hora}</p>}
                      {e.tipo&&<Badge label={e.tipo} color={tc(e.tipo)}/>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {pas.length>0&&(
            <div className="bg-white rounded-2xl shadow p-5 opacity-60">
              <h3 className="font-semibold text-gray-500 mb-3">Passados ({pas.length})</h3>
              <ul className="space-y-2">
                {pas.slice(-5).reverse().map((e,i)=>(
                  <li key={i} className="flex gap-3 text-sm text-gray-500">
                    <span className="w-20">{e.data}</span>
                    <span className="line-through">{e.titulo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [aba,setAba]=useState("Visao Geral");
  const processos=useSheet(SHEETS.processos);
  const vendas=useSheet(SHEETS.vendas);
  const estoque=useSheet(SHEETS.estoque);
  const calendario=useSheet(SHEETS.calendario);
  const [att,setAtt]=useState(new Date());
  useEffect(()=>{const id=setInterval(()=>setAtt(new Date()),30000);return()=>clearInterval(id);},[]);
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Dashboard Jennifer</h1>
            <p className="text-xs text-gray-400">Velloso Cidadania - atualiza a cada 30s</p>
          </div>
          <p className="text-xs text-gray-400 hidden sm:block">Ultima att: {att.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setAba(t)} className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${aba===t?"border-blue-600 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700"}`}>{t}</button>
          ))}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {aba==="Visao Geral"&&<TabVisaoGeral processos={processos} vendas={vendas} estoque={estoque}/>}
        {aba==="Processos"&&<TabProcessos processos={processos}/>}
        {aba==="Vendas"&&<TabVendas vendas={vendas}/>}
        {aba==="Estoque"&&<TabEstoque estoque={estoque}/>}
        {aba==="Financeiro"&&<TabFinanceiro/>}
        {aba==="Tarefas"&&<TabTarefas/>}
        {aba==="Calendario"&&<TabCalendario calendario={calendario}/>}
      </main>
    </div>
  );
}
