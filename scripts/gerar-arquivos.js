// Gera arquivos.json com os PDFs de pdf/ e os XMLs de xml/, do mais recente para o mais antigo
// (data do último commit do arquivo; se ainda não foi commitado, data de modificação).
const fs=require("fs"),path=require("path"),{execFileSync}=require("child_process");
const raiz=path.join(__dirname,"..");

function data(rel){
  try{const s=execFileSync("git",["log","-1","--format=%ct","--",rel],{cwd:raiz,encoding:"utf8"}).trim();
    if(s)return new Date(Number(s)*1000).toISOString();}catch(e){}
  return fs.statSync(path.join(raiz,rel)).mtime.toISOString();
}
function listar(dir,ext){
  const d=path.join(raiz,dir);if(!fs.existsSync(d))return[];
  return fs.readdirSync(d).filter(n=>n.toLowerCase().endsWith(ext))
    .map(n=>({nome:n,caminho:`${dir}/${n}`,data:data(`${dir}/${n}`)}))
    .sort((a,b)=>b.data.localeCompare(a.data)||b.nome.localeCompare(a.nome));
}
const out={pdf:listar("pdf",".pdf"),xml:listar("xml",".xml")};
fs.writeFileSync(path.join(raiz,"arquivos.json"),JSON.stringify(out,null,2));
console.log(`arquivos.json: ${out.pdf.length} PDF(s), ${out.xml.length} XML(s)`);

// --html (deploy): embute a lista nas páginas e pré-carrega o XML mais recente em tributos.html,
// para o navegador não esperar o arquivos.json antes de pedir o XML (cadeia de requisições críticas).
// Em tributos.html embute também o quadro oficial de tributação da Fecombustíveis (painel.json), mostrado no resumo.
if(process.argv.includes("--html")){
  const js=v=>JSON.stringify(v).replace(/</g,"\\u003c");
  const lista=`<script>window.ARQUIVOS=${js(out)};</script>\n`;
  const pj=path.join(raiz,"painel.json"),painel=fs.existsSync(pj)?`<script>window.PAINEL=${js(JSON.parse(fs.readFileSync(pj,"utf8")))};</script>\n`:"";
  const ultimo=out.xml.filter(f=>/\d{8}/.test(f.nome)).sort((a,b)=>b.nome.match(/\d{8}/)[0].localeCompare(a.nome.match(/\d{8}/)[0]))[0];
  const marca='<link rel="stylesheet" href="site.css"';
  for(const [arq,extra] of [["index.html",""],["tributos.html",(ultimo?`<link rel="preload" href="${encodeURI(ultimo.caminho)}" as="fetch" crossorigin>\n`:"")+painel]]){
    const p=path.join(raiz,arq),s=fs.readFileSync(p,"utf8");
    if(!s.includes(marca))throw new Error(`${arq}: link do site.css não encontrado`);
    fs.writeFileSync(p,s.replace(marca,extra+lista+marca));
  }
  console.log(`lista embutida no HTML${ultimo?`; preload de ${ultimo.caminho}`:""}`);
}
