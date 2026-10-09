// Procura o PDF mais recente de "Carga tributária estadual" da Fecombustíveis e salva em pdf/ se ainda não existir.
// 1) lê os links da página https://www.fecombustiveis.org.br/tributacao
// 2) se a página falhar, tenta o padrão de URL do mês atual e do próximo
// Em GitHub Actions grava "novo=<arquivo>" em $GITHUB_OUTPUT quando baixa um PDF.
const fs=require("fs"),path=require("path");
const raiz=path.join(__dirname,"..");
const PAGINA="https://www.fecombustiveis.org.br/tributacao";
const BASE="https://www.galaxcms.com.br/imgs_redactor/3188/files/";
const MESES=["JANEIRO","FEVEREIRO","MARCO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const UA={"User-Agent":"Mozilla/5.0 (tributacao-bot)"};

const semAcento=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"");
// "…Carga tributria estadual - 01 OUTUBRO 2026v2.pdf" → {dia:"01",mes:9,ano:2026,suf:"v2",url}
function interpretar(url){
  const nome=semAcento(decodeURIComponent(url.split("/").pop())).toUpperCase();
  const m=nome.match(/CARGA.*ESTADUAL\D*(\d{1,2})\s+([A-Z]+)\s+(\d{4})\s*([A-Z0-9]*)\.PDF$/);
  if(!m||!MESES.includes(m[2]))return null;
  return {url,dia:m[1].padStart(2,"0"),mes:MESES.indexOf(m[2]),ano:+m[3],suf:m[4].toLowerCase()};
}
// mesmo nome do arquivo no link (ex.: "Carga tributria estadual - 01 OUTUBRO 2026.pdf")
const nomeArquivo=c=>decodeURIComponent(c.url.split("/").pop());
const ordem=c=>c.ano*10000+c.mes*100+ +c.dia; // "10 OUTUBRO" vem antes de "01 OUTUBRO"

async function daPagina(){
  const r=await fetch(PAGINA,{headers:UA});
  if(!r.ok)throw new Error(`página HTTP ${r.status}`);
  const html=await r.text();
  return [...html.matchAll(/href\s*=\s*"([^"]+\.pdf)"/gi)].map(m=>interpretar(m[1])).filter(Boolean);
}
function doPadrao(){
  const hoje=new Date(new Date().toLocaleString("en-US",{timeZone:"America/Sao_Paulo"}));
  return [0,1].map(n=>{const d=new Date(hoje.getFullYear(),hoje.getMonth()+n,1);
    return interpretar(`${BASE}Carga%20tributria%20estadual%20-%2001%20${MESES[d.getMonth()]}%20${d.getFullYear()}.pdf`);});
}
async function baixar(url){
  const r=await fetch(url,{headers:UA});if(!r.ok)return null;
  const buf=Buffer.from(await r.arrayBuffer());
  return buf.subarray(0,5).toString()==="%PDF-"?buf:null;
}

(async()=>{
  let cands=[];
  try{cands=await daPagina();console.log(`Página: ${cands.length} PDF(s) encontrados.`);}
  catch(e){console.log(`Página indisponível (${e.message}); usando padrão de URL.`);}
  if(!cands.length)cands=doPadrao();
  cands.sort((a,b)=>ordem(b)-ordem(a)||b.suf.localeCompare(a.suf));

  const dir=path.join(raiz,"pdf");fs.mkdirSync(dir,{recursive:true});
  for(const c of cands){
    const arq=nomeArquivo(c);
    if(fs.existsSync(path.join(dir,arq))){console.log(`Já existe: pdf/${arq}. Nada a fazer.`);return;}
    const buf=await baixar(c.url);
    if(!buf){console.log(`Ainda não publicado: ${c.url}`);continue;}
    fs.writeFileSync(path.join(dir,arq),buf);
    console.log(`Baixado: pdf/${arq} (${buf.length} bytes)`);
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`novo=${arq}\n`);
    return;
  }
  console.log("Nenhum PDF novo.");
})().catch(e=>{console.error(e);process.exit(1);});
