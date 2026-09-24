# Página de contratos — Velloso Cidadania

Página pública, estática e independente do dashboard principal. Não usa framework, build, variáveis de ambiente, funções serverless nem hospedagem externa para os assets essenciais.

## Publicação no Vercel

Crie um novo projeto no Vercel. Não altere o projeto que publica o dashboard principal.

| Configuração | Valor |
| --- | --- |
| Repositório | `Roh-barboza/velloso-dashboard` |
| Project Name | `contratos-vellosocidadania` |
| Root Directory | `contracts-redirect` |
| Framework Preset | `Other` |
| Build Command | vazio |
| Output Directory | `public` |

Use a branch que contém esta pasta. Enquanto o trabalho estiver apenas na branch de prévia, selecione `preview-contratos-link`.

Desative qualquer Deployment Protection/Authentication no novo projeto. Isso é indispensável para que os robôs do WhatsApp acessem o HTML e `og-contracts.jpg` sem login.

Após o deploy, valide em uma janela anônima:

- `https://contratos-vellosocidadania.vercel.app/`
- `https://contratos-vellosocidadania.vercel.app/og-contracts.jpg`
- `https://contratos-vellosocidadania.vercel.app/logo-velloso.jpg`

O HTML inicial contém todos os metadados Open Graph e Twitter/X. O redirecionamento para o Google Forms acontece no navegador após 3,5 segundos com `window.location.replace`; o botão funciona imediatamente. Não há redirecionamento HTTP na rota principal.

## Arquivos

- `public/index.html`: conteúdo da página e metadados sociais.
- `public/styles.css`: composição visual responsiva para desktop e celular.
- `public/redirect.js`: redirecionamento temporizado.
- `public/logo-velloso.jpg`: logo oficial fornecido.
- `public/og-contracts.jpg`: card social estático de 1200 × 630 px.
- `public/roma-bg.webp`: bandeira italiana e Coliseu usados na página.
- `vercel.json`: publicação estática, cabeçalhos e cache.
