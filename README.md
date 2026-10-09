# Transparência de Tributos – Combustíveis

Site estático (GitHub Pages) que automatiza a atualização mensal do XML `TransparenciaTributos`:

1. Lê o PDF da Fecombustíveis ("Carga tributária estadual") com IA gratuita (Google Gemini).
2. Compara os valores com o XML atual e destaca o que mudou.
3. Gera o XML novo: para cada combustível que mudou, o bloco antigo termina no dia anterior
   (ex.: 30/09/2026) e é criado um bloco novo (ex.: 01/10/2026 até 01/01/2050).
   Combustíveis sem mudança (ex.: diesel) ficam como estão.
4. Exporta também uma planilha Excel com os valores.

Tudo roda no navegador; nenhum servidor próprio é necessário.

## Uso mensal

1. O PDF do mês é baixado sozinho para `pdf/` (ver *Busca automática do PDF*). Coloque o XML atual na pasta `xml/`, faça commit e push. O deploy atualiza o site.
2. Abra o site. **Passo 1** – o PDF mais recente de `pdf/` já vem selecionado, e como base o XML de `xml/` anterior ao mês do PDF.
   Se o XML do mês do PDF já estiver em `xml/` (ex.: `TransparenciaTributos_20261001.xml` para o PDF de 01 OUTUBRO 2026),
   ele é carregado direto, sem chamar a IA. O resultado da IA também fica salvo no navegador: atualizar a página não chama a IA de novo.
   Para usar outros arquivos, abra *Enviar arquivos manualmente* (selecione ou cole o XML). Confira as datas de vigência
   (a data de início é preenchida automaticamente com a "Referência" do PDF).
3. Clique em **Extrair valores do PDF com IA**.
4. **Passo 2** – revise as abas. Amarelo = mudou em relação ao XML atual; borda vermelha = conta não fecha
   (PMPF × alíquota ≠ ICMS, ou PMPF × 9,25% ≠ PIS/COFINS no GNV). Ajuste a *MensagemPadrao* se o decreto mudou.
5. **Passo 3** – *Gerar XML*, depois *Baixar XML* / *Baixar Excel*.

Sem chave ou com limite estourado, use **Preencher a partir do XML atual** e digite os valores manualmente.

## Chave gratuita do Gemini

- Crie a chave grátis em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (conta Google, sem cartão).
- A chave é enviada somente ao Google. O site usa os modelos `gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-2.5-flash` e `gemini-2.5-flash-lite`, nessa ordem.
- O plano gratuito tem limite de requisições por minuto/dia — de sobra para uso mensal. Erro 429 = aguarde um minuto.
- No plano gratuito o Google pode usar o conteúdo enviado para melhorar seus produtos; aqui só é enviado o PDF público da Fecombustíveis.

## Busca automática do PDF

O workflow `.github/workflows/buscar-pdf.yml` roda a cada 12 horas (e manualmente em *Actions → Buscar PDF da Fecombustíveis → Run workflow*).
Ele lê https://www.fecombustiveis.org.br/tributacao, pega o PDF de "Carga tributária estadual" do mês mais recente
(se a página falhar, tenta o link do mês atual e do próximo) e, se ainda não estiver em `pdf/`, salva com o mesmo nome do link,
faz commit e publica o site.

## Publicar no GitHub Pages

```bash
cd C:\Users\fabio\source\repos\imextecnlogia\tributacao
git init
git add .
git commit -m "Gerador de XML de transparência de tributos"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/tributacao.git
git push -u origin main
```

No GitHub:

1. **Settings → Secrets and variables → Actions → New repository secret**: nome `GEMINI_API_KEY`, valor = sua chave.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.

A cada push na `main` o workflow `.github/workflows/pages.yml` grava a chave no `index.html` e publica o site,
e o site usa essa chave automaticamente. Para trocar a chave, atualize o secret e rode o workflow de novo.
**Atenção:** a chave fica visível no código-fonte do site publicado. Restrinja-a em
https://console.cloud.google.com/apis/credentials (*Restrições de aplicativo → Referenciadores HTTP* =
`https://<seu-usuario>.github.io/*` e *Restrições de API* = Generative Language API).
Em alguns minutos o site fica em `https://<seu-usuario>.github.io/tributacao/`.

Para testar localmente basta abrir `index.html` no navegador.

## Mapeamento de produtos (códigos ANP)

| Produto | codigoANP |
|---|---|
| Gasolina C | 320102001, 320102002 |
| Gasolina Premium | 320102003, 320102005 |
| Etanol hidratado | 810101001, 810101002, 810101003 |
| Diesel S-500 | 820101012, 820101013 |
| Diesel S-10 | 820101033, 820101034 |
| GNV | 220101005, 220101006 |

Para incluir outro produto, edite a constante `PRODUTOS` em `index.html`. Combustíveis com códigos não mapeados são mantidos no XML sem alteração.

## Exemplos

A pasta `exemplos/` contém o PDF de outubro/2026 e o XML gerado a partir dele, para conferência.
