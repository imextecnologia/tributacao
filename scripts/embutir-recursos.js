// Deploy: embute site.css, tema.js e o logo do rodapé nas páginas. O GitHub Pages serve tudo com
// cache de só 10 min (sem como mudar o cabeçalho); embutidos, eles não viram requisições separadas.
const fs=require("fs"),path=require("path");
const raiz=path.join(__dirname,"..");
const ler=f=>fs.readFileSync(path.join(raiz,f),"utf8");

const css=ler("site.css").trim(),js=ler("tema.js").trim();
if(/<\/style/i.test(css)||/<\/script/i.test(js))throw new Error("site.css/tema.js não podem conter </style> ou </script>");
// SVG: arredonda as coordenadas para 1 casa e codifica como data URI (aspas simples, sem base64)
const svg=ler("imex-rodape.svg").replace(/(\d+\.\d)\d+/g,"$1").replace(/\s+/g," ").trim()
  .replace(/"/g,"'").replace(/%/g,"%25").replace(/#/g,"%23").replace(/</g,"%3C").replace(/>/g,"%3E");

const trocas=[
  ['<link rel="stylesheet" href="site.css">',`<style>\n${css}\n</style>`],
  ['<script src="tema.js"></script>',`<script>\n${js}\n</script>`],
  ['src="imex-rodape.svg"',`src="data:image/svg+xml,${svg}"`]
];
for(const arq of ["index.html","tributos.html"]){
  let s=ler(arq);
  for(const [de,para] of trocas){
    if(!s.includes(de))throw new Error(`${arq}: não encontrado ${de}`);
    s=s.split(de).join(para);
  }
  fs.writeFileSync(path.join(raiz,arq),s);
}
console.log(`embutidos: site.css (${css.length} B), tema.js (${js.length} B), imex-rodape.svg (${svg.length} B)`);
