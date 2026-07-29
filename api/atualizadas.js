// Proxy para o Apps Script que le/escreve na planilha do Google Sheets.
// URL do Apps Script Web App vem da env var APPS_SCRIPT_URL (definida na Vercel).
// Se a env var nao estiver setada, retorna 200 com map vazio (nao quebra o app).

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

async function callAppsScript(body) {
  if (!APPS_SCRIPT_URL) return { ok: false, error: "APPS_SCRIPT_URL nao configurada" };
  const r = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "follow",
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: r.ok, raw: text }; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      if (!APPS_SCRIPT_URL) return res.status(200).json({ map: {} });
      try {
        const r = await fetch(APPS_SCRIPT_URL + "?acao=listar", { redirect: "follow" });
        const text = await r.text();
        let j = {};
        try { j = JSON.parse(text); } catch (_) {
          return res.status(502).json({ error: "resposta nao-JSON do Apps Script", status: r.status, sample: text.slice(0, 300) });
        }
        return res.status(200).json({ map: j.map || {} });
      } catch (fe) {
        return res.status(502).json({ error: "fetch falhou", detail: String(fe?.cause?.message || fe?.message || fe) });
      }
    }

    if (req.method === "POST") {
      const { pasta, iso, usuario } = req.body || {};
      if (!pasta || !iso) return res.status(400).json({ error: "pasta e iso obrigatorios" });
      const out = await callAppsScript({ acao: "atualizar", pasta, iso, usuario: usuario || "" });
      return res.status(200).json(out);
    }

    if (req.method === "DELETE") {
      const { pasta } = req.body || {};
      if (!pasta) return res.status(400).json({ error: "pasta obrigatoria" });
      const out = await callAppsScript({ acao: "remover", pasta });
      return res.status(200).json(out);
    }

    return res.status(405).json({ error: "metodo nao suportado" });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
