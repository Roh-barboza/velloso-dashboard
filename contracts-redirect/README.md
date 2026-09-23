# Página de contratos — Velloso Cidadania

Página estática independente do dashboard. Não usa Node, build, variáveis de ambiente, funções ou serviços externos para carregar a página e a prévia.

## Publicação no Vercel

1. Importe `Roh-barboza/velloso-dashboard` como **um novo projeto** (não altere o projeto `velloso-dashboard`).
2. Selecione a branch `preview-contratos-link` até que esta pasta esteja na branch que você pretende usar para o deploy de produção.
3. **Project Name:** `contratos-vellosocidadania`.
4. **Root Directory:** `contracts-redirect`.
5. **Framework Preset:** `Other`. Deixe Build Command vazio e configure **Output Directory** como `public` se o Vercel não o detectar automaticamente; o `index.html` e todos os assets ficam em `public/`.
6. Desative Deployment Protection/Authentication do novo projeto para que o WhatsApp consiga buscar a página e a imagem pública. Mantenha o dashboard no projeto atual.
7. Faça o deploy e valide `https://contratos-vellosocidadania.vercel.app/` e `https://contratos-vellosocidadania.vercel.app/og-contracts.jpg` sem estar logado.

O HTML inicial já contém título, descrição e imagem Open Graph absolutos. O navegador aguarda 3,5 segundos e usa `window.location.replace` para o Google Forms; o link do botão funciona imediatamente. O crawler não executa o redirecionamento por JavaScript.

## Arquivos

- `public/index.html`: estrutura e metadados sociais.
- `public/styles.css`: layout desktop e mobile.
- `public/redirect.js`: redirecionamento temporizado.
- `public/logo-velloso.jpg`: arquivo oficial do logo fornecido.
- `public/og-contracts.jpg`: imagem estática 1200 × 630.
- `public/roma-bg.webp`: ilustração decorativa da página.
- `vercel.json`: cabeçalhos e configuração estática.
