# Setup — sincronizar dashboard com a planilha

Substitui o que o n8n fazia. Faz-se uma vez só (~10 min).

## 1) Criar o Apps Script na planilha

1. Abre a planilha de processos no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. Apaga o `Code.gs` padrão.
4. Cole o conteúdo do arquivo [`apps-script/Code.gs`](apps-script/Code.gs) deste repo.
5. Se o nome da aba de processos **NÃO** for `Processos`, ajuste `SHEET_NAME` na primeira linha.
6. Salve (ícone do disquete ou `Ctrl+S`).

## 2) Publicar como Web App

1. Ainda no Apps Script, clique no botão **Deploy → New deployment** (canto superior direito).
2. No ícone de engrenagem à esquerda, escolha **Web app**.
3. Preencha:
   - **Description**: `velloso-dashboard backend`
   - **Execute as**: `Me (seu email)`
   - **Who has access**: `Anyone`
4. Clique **Deploy**. Vai pedir autorização — aceite todas.
5. Copie a **Web app URL** (algo tipo `https://script.google.com/macros/s/AKfycb.../exec`).

> Toda vez que você alterar o Code.gs, precisa clicar em **Deploy → Manage deployments → editar (lápis) → Version: New version → Deploy** para o site pegar a mudança.

## 3) Adicionar a URL na Vercel

1. Abra o projeto **velloso-dashboard** na Vercel.
2. **Settings → Environment Variables**.
3. Crie: `APPS_SCRIPT_URL` = _a URL copiada no passo 2.5_.
4. Marque todos os ambientes (Production, Preview, Development).
5. **Save**.

## 4) Redeploy

1. Vá em **Deployments** e no último deploy clique **... → Redeploy** (sem cache).
2. Aguarde ~1 min.

## Pronto — como testar

- Abra o dashboard, vá em **Processos**, clique numa bolinha branca → ela vira verde.
- Abra a planilha do Google Sheets → a linha daquela família tem a coluna **ULT ATUALIZAÇÃO** preenchida com a data de hoje.
- Mude a **ETAPA** de um processo pelo dropdown do dashboard → a coluna **ETAPA** na planilha muda também.
- Abrir em outro navegador/dispositivo → o estado aparece igual (o dashboard puxa da planilha).

## Se algo não funcionar

- Erro 500 em `/api/atualizadas` → conferir se `APPS_SCRIPT_URL` está setada na Vercel e se o Redeploy foi feito.
- Erro "pasta X nao encontrada" → o valor da coluna PASTA no dashboard não bate com o da planilha (checar espaços/formato).
- Erro "coluna ULT ATUALIZACAO nao encontrada" → renomear a coluna na planilha para `ULT ATUALIZAÇÃO` ou `ULTIMA ATUALIZAÇÃO`.

## Sem esse setup

O app **continua funcionando** — a bolinha e o dropdown funcionam localmente no navegador (localStorage), mas nada é escrito na planilha e não sincroniza entre dispositivos. Basta configurar quando quiser.
