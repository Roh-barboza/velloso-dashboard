// Proxy para o Apps Script — muda a coluna ETAPA de um processo na planilha.

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "metodo nao suportado" });

  const { pasta, novaEtapa, usuario } = req.body || {};
  if (!pasta || novaEtapa === undefined) {
    return res.status(400).json({ error: "pasta e novaEtapa obrigatorios" });
  }
  if (!APPS_SCRIPT_URL) return res.status(200).json({ ok: false, error: "APPS_SCRIPT_URL nao configurada" });

  try {
    const r = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "mudar_etapa", pasta, novaEtapa, usuario: usuario || "" }),
      redirect: "follow",
    });
    const text = await r.text();
    try { return res.status(200).json(JSON.parse(text)); }
    catch { return res.status(200).json({ ok: r.ok, raw: text }); }
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
