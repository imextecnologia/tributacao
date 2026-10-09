// Lê o quadro oficial de tributação (% por combustível) da página da Fecombustíveis e grava painel.json,
// para o resumo do site mostrar sempre a versão publicada por eles.
// Em GitHub Actions grava "novo=1" em $GITHUB_OUTPUT quando o painel.json muda.
const fs=require("fs"),path=require("path");
const raiz=path.join(__dirname,"..");
const PAGINA="https://www.fecombustiveis.org.br/tributacao";
const UA={"User-Agent":"Mozilla/5.0 (tributacao-bot)"};

const texto=s=>s.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&ndash;/g,"–").replace(/&amp;/g,"&")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n)).replace(/\s+/g," ").trim();

(async()=>{
  const r=await fetch(PAGINA,{headers:UA});if(!r.ok)throw new Error(`página HTTP ${r.status}`);
  const html=new TextDecoder("iso-8859-1").decode(await r.arrayBuffer()); // a página é ISO-8859-1
  // versão desktop do quadro: cabeçalho com os combustíveis e linhas "rótulo + 4 valores"
  const ini=html.indexOf("tabela-combustivel show-desktop");if(ini<0)throw new Error("quadro de tributação não encontrado na página");
  const fim=html.indexOf("tabela-combustivel",ini+1),bloco=html.slice(ini,fim>ini?fim:ini+20000); // até a versão mobile
  const colunas=[...bloco.matchAll(/class\s*=\s*"titulo-tabela"\s*>\s*<div>([\s\S]*?)<\/div>/g)].map(m=>texto(m[1]));
  const linhas=bloco.split(/class\s*=\s*"info-tabela _02"/).slice(1).map(p=>{
    const rot=p.match(/<div>\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/div>/);
    const valores=[...p.matchAll(/class\s*=\s*"info-tabela"\s*>\s*<div>([\s\S]*?)<\/div>/g)].slice(0,colunas.length).map(m=>texto(m[1]));
    return rot&&{rotulo:texto(rot[1]),det:texto(rot[2]),valores};
  });
  if(colunas.length!==4||!linhas.length||linhas.some(l=>!l||l.valores.length!==4||l.valores.some(v=>!/^\d+(,\d+)?\s*%$/.test(v))))
    throw new Error("quadro de tributação com formato inesperado: "+JSON.stringify({colunas,linhas}));

  const arq=path.join(raiz,"painel.json"),antes=fs.existsSync(arq)?fs.readFileSync(arq,"utf8"):"";
  const novo=JSON.stringify({fonte:PAGINA,colunas,linhas},null,2)+"\n";
  if(novo===antes){console.log("Quadro oficial sem mudanças.");return;}
  fs.writeFileSync(arq,novo);
  console.log("painel.json atualizado:",linhas.map(l=>`${l.rotulo} ${l.valores.join(" ")}`).join(" | "));
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,"novo=1\n");
})().catch(e=>{console.error(e.message||e);process.exit(1);});
