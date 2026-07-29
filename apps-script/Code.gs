// ===================================================================
// VELLOSO DASHBOARD — Apps Script backend
// -------------------------------------------------------------------
// Cole este arquivo em Extensoes > Apps Script da planilha de processos,
// depois clique em Deploy > New deployment > Web app.
//
// - Execute as: Me
// - Who has access: Anyone
// -------------------------------------------------------------------

// >>> AJUSTE AQUI se o nome da aba de processos for outro <<<
const SHEET_NAME = "CONTROLE DE PROCESSOS";

// -------------------------------------------------------------------

function doGet(e) {
  const acao = (e && e.parameter && e.parameter.acao) || "listar";
  if (acao === "listar") {
    return jsonOut({ map: listarAtualizacoes() });
  }
  return jsonOut({ ok: false, error: "acao desconhecida" });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || "{}"); } catch (_) {}
  const acao = body.acao;

  if (acao === "atualizar") {
    return jsonOut(atualizarLinha(body.pasta, body.iso, body.usuario || ""));
  }
  if (acao === "remover") {
    return jsonOut(atualizarLinha(body.pasta, "", "", true));
  }
  if (acao === "mudar_etapa") {
    return jsonOut(mudarEtapa(body.pasta, body.novaEtapa, body.usuario || ""));
  }
  return jsonOut({ ok: false, error: "acao desconhecida" });
}

// -------------------------------------------------------------------

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Aba '" + SHEET_NAME + "' nao encontrada. Ajuste SHEET_NAME no topo do script.");
  return sh;
}

// Normaliza strings pra comparar cabecalhos (mesma logica do frontend)
function normStr(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.\-]/g, "")
    .trim();
}

function findHeaderRow(values) {
  for (let i = 0; i < Math.min(values.length, 6); i++) {
    const linha = (values[i] || []).map(normStr).join("|");
    if (linha.includes("pasta") && linha.includes("familia")) return i;
  }
  return 1;
}

function findCol(header, ...candidates) {
  for (const c of candidates) {
    const t = normStr(c);
    const idx = header.findIndex(h => normStr(h) === t);
    if (idx >= 0) return idx;
  }
  for (const c of candidates) {
    const t = normStr(c);
    const idx = header.findIndex(h => normStr(h).includes(t));
    if (idx >= 0) return idx;
  }
  return -1;
}

function getContext() {
  const sh = getSheet();
  const values = sh.getDataRange().getValues();
  const hRow = findHeaderRow(values);
  const header = values[hRow] || [];
  return {
    sh, values, hRow, header,
    iPasta:  findCol(header, "n pasta", "no pasta", "pasta"),
    iEtapa:  findCol(header, "etapa atual", "etapa", "status"),
    iUlt:    findCol(header, "ult atualizacao", "ultima atualizacao", "ult atualizacao", "ultima att", "ult att"),
    iProx:   findCol(header, "proxima atualizacao", "prox atualizacao", "proxima att", "prox att"),
    iUser:   findCol(header, "atualizado por", "responsavel", "usuario"),
  };
}

function isoMaisDias(iso, dias) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + dias);
  return isoParaBr(d.toISOString());
}

function findRowByPasta(ctx, pasta) {
  const alvo = String(pasta).trim();
  for (let i = ctx.hRow + 1; i < ctx.values.length; i++) {
    const cell = ctx.values[i][ctx.iPasta >= 0 ? ctx.iPasta : 0];
    if (String(cell).trim() === alvo) return i + 1; // 1-indexed
  }
  return -1;
}

function isoParaBr(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return dd + "/" + mm + "/" + yyyy;
}

function brParaIso(br) {
  const s = String(br || "").trim();
  if (!s) return "";
  // aceita d/m/yyyy, dd/mm/yyyy, yyyy-mm-dd, ou Date object serializado
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return new Date(+y, +mo - 1, +d).toISOString();
  }
  return "";
}

// -------------------------------------------------------------------

function atualizarLinha(pasta, iso, usuario, remover) {
  if (!pasta) return { ok: false, error: "pasta obrigatoria" };
  const ctx = getContext();
  if (ctx.iUlt < 0) return { ok: false, error: "coluna 'ULT ATUALIZACAO' nao encontrada na planilha" };
  const row = findRowByPasta(ctx, pasta);
  if (row < 0) return { ok: false, error: "pasta " + pasta + " nao encontrada" };
  const isoFinal = iso || new Date().toISOString();
  const dataStr = remover ? "" : isoParaBr(isoFinal);
  ctx.sh.getRange(row, ctx.iUlt + 1).setValue(dataStr);
  if (ctx.iProx >= 0) {
    ctx.sh.getRange(row, ctx.iProx + 1).setValue(remover ? "" : isoMaisDias(isoFinal, 15));
  }
  if (!remover && ctx.iUser >= 0 && usuario) {
    ctx.sh.getRange(row, ctx.iUser + 1).setValue(usuario);
  }
  return { ok: true, pasta, dataStr };
}

function mudarEtapa(pasta, novaEtapa, usuario) {
  if (!pasta) return { ok: false, error: "pasta obrigatoria" };
  const ctx = getContext();
  if (ctx.iEtapa < 0) return { ok: false, error: "coluna 'ETAPA' nao encontrada" };
  const row = findRowByPasta(ctx, pasta);
  if (row < 0) return { ok: false, error: "pasta " + pasta + " nao encontrada" };
  ctx.sh.getRange(row, ctx.iEtapa + 1).setValue(novaEtapa || "");
  return { ok: true, pasta, novaEtapa };
}

function listarAtualizacoes() {
  const ctx = getContext();
  const map = {};
  if (ctx.iUlt < 0) return map;
  for (let i = ctx.hRow + 1; i < ctx.values.length; i++) {
    const pasta = String(ctx.values[i][ctx.iPasta >= 0 ? ctx.iPasta : 0] || "").trim();
    if (!pasta) continue;
    const raw = ctx.values[i][ctx.iUlt];
    let iso = "";
    if (raw instanceof Date) iso = raw.toISOString();
    else iso = brParaIso(raw);
    if (!iso) continue;
    const usuario = ctx.iUser >= 0 ? String(ctx.values[i][ctx.iUser] || "").trim() : "";
    map[pasta] = { iso, usuario };
  }
  return map;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =================================================================
 * EMAIL DIARIO — lista de familias para atualizar
 * -----------------------------------------------------------------
 * Rode setupEmailTrigger() UMA VEZ (menu Executar) para agendar
 * o envio automatico seg-sex as 8h da manha.
 * Ajuste EMAIL_DESTINO com o(s) email(s) que devem receber.
 * ================================================================= */

const EMAIL_DESTINO = Session.getActiveUser().getEmail(); // por padrao, seu proprio email
const EMAIL_LIMITE_DIAS = 15;

function sendDailyEmail() {
  const dow = new Date().getDay(); // 0=dom 6=sab
  if (dow === 0 || dow === 6) return; // pula fim de semana

  const ctx = getContext();
  if (ctx.iUlt < 0) return;

  const criticas = [];
  for (let i = ctx.hRow + 1; i < ctx.values.length; i++) {
    const row = ctx.values[i];
    const pasta = String(row[ctx.iPasta >= 0 ? ctx.iPasta : 0] || "").trim();
    if (!pasta) continue;
    const etapa = ctx.iEtapa >= 0 ? String(row[ctx.iEtapa] || "").trim() : "";
    if (isEtapaFinalizada(etapa)) continue;
    const familia = String(row[1] || "").trim();
    const raw = row[ctx.iUlt];
    const iso = raw instanceof Date ? raw.toISOString() : brParaIso(raw);
    let dias = null;
    if (iso) {
      dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
      if (dias < EMAIL_LIMITE_DIAS) continue;
    }
    criticas.push({ pasta, familia, etapa, dias });
  }
  // ordena: nunca atualizadas primeiro, depois mais antigas
  criticas.sort((a, b) => {
    if (a.dias === null && b.dias !== null) return -1;
    if (b.dias === null && a.dias !== null) return 1;
    return (b.dias || 0) - (a.dias || 0);
  });

  const total = criticas.length;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const assunto = total > 0
    ? `[Velloso] ${total} familia${total > 1 ? "s" : ""} para atualizar hoje (${hoje})`
    : `[Velloso] Sem pendencias — ${hoje}`;

  let html = '<div style="font-family:Arial,sans-serif;color:#2a2a2a;max-width:640px">';
  html += '<h2 style="color:#592343;margin:0 0 4px">Painel do Dia — ' + hoje + '</h2>';
  html += '<p style="color:#8b6b7d;font-size:13px;margin:0 0 20px">Familias ativas sem atualizacao ha ' + EMAIL_LIMITE_DIAS + ' dias ou mais.</p>';
  if (total === 0) {
    html += '<p style="font-size:16px;color:#00924a;font-weight:bold">Todas as familias em dia. Bom trabalho!</p>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse;font-size:14px">';
    html += '<tr style="background:#faf8f6;text-align:left"><th style="padding:8px;border-bottom:2px solid #592343">Pasta</th><th style="padding:8px;border-bottom:2px solid #592343">Familia</th><th style="padding:8px;border-bottom:2px solid #592343">Etapa</th><th style="padding:8px;border-bottom:2px solid #592343">Dias</th></tr>';
    for (const c of criticas.slice(0, 50)) {
      const cor = c.dias === null ? "#8b6b7d" : c.dias >= 30 ? "#ce2b37" : "#d97706";
      const label = c.dias === null ? "nunca" : c.dias + "d";
      html += '<tr style="border-bottom:1px solid #e8ddd4">';
      html += '<td style="padding:8px;font-weight:bold">' + c.pasta + '</td>';
      html += '<td style="padding:8px">' + c.familia + '</td>';
      html += '<td style="padding:8px;color:#8b6b7d">' + (c.etapa || '—') + '</td>';
      html += '<td style="padding:8px"><span style="background:' + cor + ';color:white;padding:2px 8px;border-radius:10px;font-weight:bold;font-size:12px">' + label + '</span></td>';
      html += '</tr>';
    }
    html += '</table>';
    if (total > 50) html += '<p style="color:#8b6b7d;font-size:12px;margin-top:8px">Exibindo as 50 mais criticas de ' + total + ' pendentes.</p>';
    html += '<p style="margin-top:24px"><a href="https://velloso-dashboard.vercel.app" style="background:#592343;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold">Abrir o dashboard</a></p>';
  }
  html += '</div>';

  MailApp.sendEmail({
    to: EMAIL_DESTINO,
    subject: assunto,
    htmlBody: html,
  });
}

function isEtapaFinalizada(etapa) {
  const e = normStr(etapa);
  return e.includes("finalizado") || e.includes("concluido") || e.includes("entregue") || e.includes("cancelado") || e.includes("arquivado");
}

// Rode ESTA funcao UMA VEZ pra agendar o envio automatico
function setupEmailTrigger() {
  // Remove triggers antigos pra nao duplicar
  const existing = ScriptApp.getProjectTriggers();
  for (const t of existing) {
    if (t.getHandlerFunction() === "sendDailyEmail") ScriptApp.deleteTrigger(t);
  }
  // Cria trigger diario as 8h
  ScriptApp.newTrigger("sendDailyEmail")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  return "Trigger criado: sendDailyEmail roda todo dia as 8h (fim de semana pula sozinho).";
}
