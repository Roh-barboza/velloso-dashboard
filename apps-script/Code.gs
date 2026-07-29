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
const SHEET_NAME = "Processos";

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
    iUser:   findCol(header, "atualizado por", "responsavel", "usuario"),
  };
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
  const dataStr = remover ? "" : isoParaBr(iso || new Date().toISOString());
  ctx.sh.getRange(row, ctx.iUlt + 1).setValue(dataStr);
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
