# Transparência de Tributos – Combustíveis

Site estático (GitHub Pages) que gera todo mês o XML `TransparenciaTributos` a partir do PDF
"Carga tributária estadual" da [Fecombustíveis](https://www.fecombustiveis.org.br/tributacao).

**Site:** https://imextecnologia.github.io/tributacao/

## Como funciona

1. **Busca do PDF** – a cada 12 horas um workflow procura o PDF novo na página da Fecombustíveis e salva em `pdf/`.
2. **Leitura com IA** – o site envia o PDF ao Google Gemini, que devolve os valores por combustível e UF.
3. **Comparação** – os valores são comparados com o XML do mês anterior (em `xml/`) e o que mudou fica destacado.
4. **Geração** – para cada combustível que mudou, o bloco antigo termina no dia anterior (ex.: 30/09/2026) e é criado
   um bloco novo (ex.: 01/10/2026 até 01/01/2050). Combustíveis sem mudança ficam como estão.
   Também é possível baixar uma planilha Excel com os valores.

Tudo roda no navegador; não há servidor próprio.

## Uso mensal

1. Quando o PDF novo sair, a busca automática o coloca em `pdf/` e publica o site
   (ou rode na hora em *Actions → Buscar PDF da Fecombustíveis → Run workflow*).
2. Abra o site. No **Passo 1** o PDF mais recente já vem selecionado, com o XML do mês anterior como base
   e o início da vigência preenchido pelo mês do PDF.
3. Clique em **Extrair valores do PDF com IA**.
4. **Passo 2** – revise cada aba:
   - amarelo = mudou em relação ao XML base (o valor antigo aparece embaixo);
   - borda vermelha = conta não fecha (PMPF × alíquota ≠ ICMS, ou PMPF × 9,25% ≠ PIS/COFINS no GNV).

   Os valores podem ser corrigidos direto na tabela. Ajuste a *MensagemPadrao* se o decreto mudou.
5. **Passo 3** – *Gerar XML* e *Baixar XML* (e *Baixar Excel*, se quiser).
6. Salve o XML em `xml/` com o nome `TransparenciaTributos_AAAAMMDD.xml` (ex.: `TransparenciaTributos_20261101.xml`),
   faça commit e push.

O site evita chamar a IA sem necessidade:

- se o XML do mês do PDF já está em `xml/`, ele é carregado direto (comparado com o mês anterior);
- o resultado da IA fica salvo no navegador, então atualizar a página não chama a IA de novo.

Para usar outros arquivos, abra **Enviar arquivos manualmente** no Passo 1 (escolha o PDF/XML ou cole o XML).
Se a IA estiver indisponível, use **Preencher a partir do XML (edição manual)** e digite os valores olhando o PDF.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | O site inteiro (HTML, CSS e JavaScript) |
| `pdf/` | PDFs da Fecombustíveis (baixados pela busca automática) |
| `xml/` | XMLs `TransparenciaTributos` de cada mês |
| `exemplos/` | PDF de outubro/2026 e o XML gerado a partir dele, para conferência |
| `scripts/buscar-pdf.js` | Procura e baixa o PDF novo da Fecombustíveis |
| `scripts/gerar-arquivos.js` | Gera `arquivos.json`, a lista de arquivos de `pdf/` e `xml/` que o site lê |
| `.github/workflows/pages.yml` | Publica o site a cada push na `main` |
| `.github/workflows/buscar-pdf.yml` | Roda a busca do PDF a cada 12 horas |

## Configuração (uma vez)

### Chave do Gemini

1. Crie a chave grátis em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (conta Google, sem cartão).
2. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**, nome `GEMINI_API_KEY`.
3. Rode o workflow de publicação de novo (*Actions → Publicar no GitHub Pages → Run workflow*).

> **Atenção:** a chave é gravada no `index.html` publicado e fica visível no código-fonte do site.
> Restrinja-a em [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials):
> *Referenciadores HTTP* = `https://imextecnologia.github.io/*` e *Restrições de API* = Generative Language API.

- O site tenta os modelos `gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-2.5-flash` e `gemini-2.5-flash-lite`, nessa ordem.
- O plano gratuito tem limite por minuto/dia — de sobra para uso mensal. Erro 429 = aguarde um minuto.
- No plano gratuito o Google pode usar o conteúdo enviado para melhorar seus produtos; só o PDF público da Fecombustíveis é enviado.

### GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

A cada push na `main`, o workflow `pages.yml` gera a lista de arquivos, grava a chave no `index.html` e publica o site.

### Busca automática do PDF

O workflow `buscar-pdf.yml` roda às 00:00 e 12:00 UTC (21:00 e 09:00 em Brasília):

1. lê https://www.fecombustiveis.org.br/tributacao e pega o link do PDF "Carga tributária estadual" mais recente;
2. se a página falhar, tenta o link no padrão do mês atual e do próximo;
3. se o arquivo ainda não está em `pdf/`, salva com o mesmo nome do link, faz commit e publica o site.

## Desenvolvimento local

No VS Code, abra **Run and Debug** (Ctrl+Shift+D) e escolha **Edge (localhost:5500)** ou **Chrome (localhost:5500)**.
A tarefa gera o `arquivos.json`, sobe um servidor em `http://localhost:5500` (via `npx http-server`) e abre o navegador
com o debugger conectado. Localmente não há chave do Gemini — use a edição manual ou um XML já existente em `xml/`.

Sem o VS Code:

```bash
node scripts/gerar-arquivos.js
npx http-server -p 5500 -c-1
```

## Mapeamento de produtos (códigos ANP)

| Produto | codigoANP |
|---|---|
| Gasolina C | 320102001, 320102002 |
| Gasolina Premium | 320102003, 320102005 |
| Etanol hidratado | 810101001, 810101002, 810101003 |
| Diesel S-500 | 820101012, 820101013 |
| Diesel S-10 | 820101033, 820101034 |
| GNV | 220101005, 220101006 |

Para incluir outro produto, edite a constante `PRODUTOS` em `index.html`. Combustíveis com códigos não mapeados
são mantidos no XML sem alteração.
