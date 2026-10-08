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

1. Abra o site.
2. **Passo 1** – cole a chave da API Gemini (só na primeira vez; fica salva no navegador) e clique em *Carregar modelos*. Prefira um modelo `flash`.
3. **Passo 2** – selecione o PDF do mês e o XML atual (ou cole o XML). Confira as datas de vigência
   (a data de início é preenchida automaticamente com a "Referência" do PDF).
4. Clique em **Extrair valores do PDF com IA**.
5. **Passo 3** – revise as abas. Amarelo = mudou em relação ao XML atual; borda vermelha = conta não fecha
   (PMPF × alíquota ≠ ICMS, ou PMPF × 9,25% ≠ PIS/COFINS no GNV). Ajuste a *MensagemPadrao* se o decreto mudou.
6. **Passo 4** – *Gerar XML*, depois *Baixar XML* / *Baixar Excel*.

Sem chave ou com limite estourado, use **Preencher a partir do XML atual** e digite os valores manualmente.

## Chave gratuita do Gemini

- Crie em https://aistudio.google.com/apikey (conta Google, sem cartão).
- O plano gratuito tem limite de requisições por minuto/dia — de sobra para uso mensal. Erro 429 = aguarde um minuto.
- No plano gratuito o Google pode usar o conteúdo enviado para melhorar seus produtos; aqui só é enviado o PDF público da Fecombustíveis.

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

No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
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
