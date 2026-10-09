// Busca o preço médio de revenda (média Brasil) do levantamento semanal da ANP e grava precos.json.
// 1) lê os links da página de "últimas semanas pesquisadas" e pega o resumo semanal mais recente (.xlsx)
// 2) lê a aba BRASIL da planilha (sem dependências: o xlsx é um zip de XMLs)
// Em GitHub Actions grava "novo=<semana>" em $GITHUB_OUTPUT quando o precos.json muda.
const fs=require("fs"),path=require("path"),zlib=require("zlib");
const raiz=path.join(__dirname,"..");
const PAGINA="https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas";
const UA={"User-Agent":"Mozilla/5.0 (tributacao-bot)"};
// produto na planilha → chave usada no site
const PRODUTOS={"GASOLINA COMUM":"gasolina","OLEO DIESEL S10":"diesel","ETANOL HIDRATADO":"etanol","GNV":"gnv"};

// arquivos de um zip em memória: {nome: Buffer}
function unzip(b){
  let e=b.length-22;while(e>=0&&b.readUInt32LE(e)!==0x06054b50)e--;
  if(e<0)throw new Error("planilha não é um xlsx válido");
  const out={};let p=b.readUInt32LE(e+16);
  for(let i=b.readUInt16LE(e+10);i>0;i--){
    const met=b.readUInt16LE(p+10),tam=b.readUInt32LE(p+20),ln=b.readUInt16LE(p+28),off=b.readUInt32LE(p+42);
    const ini=off+30+b.readUInt16LE(off+26)+b.readUInt16LE(off+28),dados=b.subarray(ini,ini+tam);
    out[b.toString("utf8",p+46,p+46+ln)]=met===8?zlib.inflateRawSync(dados):dados;
    p+=46+ln+b.readUInt16LE(p+30)+b.readUInt16LE(p+32);
  }
  return out;
}
const ent=s=>s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
// linhas da aba como arrays de células
function linhas(z,aba){
  const wb=z["xl/workbook.xml"].toString(),rels=z["xl/_rels/workbook.xml.rels"].toString();
  const id=(wb.match(new RegExp(`<sheet [^>]*name="${aba}"[^>]*r:id="([^"]+)"`))||[])[1];
  const alvo=id&&(rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`))||rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`))||[])[1];
  if(!alvo)throw new Error(`aba ${aba} não encontrada`);
  const ss=[...(z["xl/sharedStrings.xml"]||"").toString().matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m=>ent([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>t[1]).join("")));
  const col=r=>[...r].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;
  return [...z["xl/"+alvo.replace(/^\/?xl\//,"")].toString().matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(m=>{
    const l=[];
    for(const c of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const v=(c[3]||"").match(/<v>([\s\S]*?)<\/v>/),t=(c[2].match(/t="(\w+)"/)||[])[1];
      l[col(c[1])]=t==="s"?ss[+v[1]]:t==="inlineStr"?ent(((c[3]||"").match(/<t[^>]*>([\s\S]*?)<\/t>/)||[,""])[1]):v?(t==="str"?ent(v[1]):Number(v[1])):null;
    }
    return l;
  });
}
const data=serial=>new Date(Math.round((serial-25569)*864e5)).toISOString().slice(0,10);

(async()=>{
  const r=await fetch(PAGINA,{headers:UA});if(!r.ok)throw new Error(`página da ANP HTTP ${r.status}`);
  const html=await r.text();
  // links "resumo_semanal_lpc_AAAA-MM-DD_AAAA-MM-DD.xlsx"; o mais recente pela data no nome
  const links=[...new Set([...html.matchAll(/href="([^"]*resumo_semanal_lpc_(\d{4}-\d{2}-\d{2})_\d{4}-\d{2}-\d{2}\.xlsx)"/g)].map(m=>m[1]))]
    .sort((a,b)=>b.match(/lpc_([\d-]{10})/)[1].localeCompare(a.match(/lpc_([\d-]{10})/)[1]));
  if(!links.length)throw new Error("nenhum resumo semanal na página da ANP");
  const url=new URL(links[0],PAGINA).href;
  const x=await fetch(url,{headers:UA});if(!x.ok)throw new Error(`planilha HTTP ${x.status}: ${url}`);
  const ls=linhas(unzip(Buffer.from(await x.arrayBuffer())),"BRASIL");
  const cab=ls.findIndex(l=>l.includes("PRODUTO")&&l.includes("PREÇO MÉDIO REVENDA"));
  if(cab<0)throw new Error("cabeçalho da aba BRASIL não encontrado");
  const c=n=>ls[cab].indexOf(n);
  const out={inicio:"",fim:"",fonte:url,precos:{}};
  for(const l of ls.slice(cab+1)){
    const k=PRODUTOS[l[c("PRODUTO")]],v=l[c("PREÇO MÉDIO REVENDA")];
    if(!k||typeof v!=="number")continue;
    out.precos[k]=v;out.inicio=data(l[c("DATA INICIAL")]);out.fim=data(l[c("DATA FINAL")]);
  }
  const faltam=Object.values(PRODUTOS).filter(k=>!out.precos[k]);
  if(faltam.length)throw new Error(`sem preço para: ${faltam.join(", ")}`);

  const arq=path.join(raiz,"precos.json"),antes=fs.existsSync(arq)?fs.readFileSync(arq,"utf8"):"";
  const novo=JSON.stringify(out,null,2)+"\n";
  if(novo===antes){console.log(`Preços da semana ${out.inicio} a ${out.fim} já gravados.`);return;}
  fs.writeFileSync(arq,novo);
  console.log(`precos.json: semana ${out.inicio} a ${out.fim}`,out.precos);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`novo=${out.inicio}_${out.fim}\n`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
