// Gera o XML TransparenciaTributos do PDF novo da Fecombustíveis, como o Passo 1–3 do site, sem revisão humana:
// 1) lê o PDF com o Gemini (mesmo prompt, produtos e UFs do index.html);
// 2) usa como base o XML mais recente de xml/ anterior à data do PDF;
// 3) para cada combustível que mudou, o bloco atual termina no dia anterior e um bloco novo vai até 2050-01-01;
// 4) grava xml/TransparenciaTributos_AAAAMMDD.xml.
// Uso: node scripts/gerar-xml.js ["pdf/<arquivo>.pdf"] [--pendente] [--testar]
//   sem arquivo: o PDF mais recente de pdf/; --pendente: só se ainda não há XML da data dele;
//   --testar: não grava em xml/ (o resultado vai para xml-teste.xml)
// Env: GEMINI_API_KEY. Em GitHub Actions grava xml=<arquivo> em $GITHUB_OUTPUT e o resumo em xml-resumo.txt.
// Se algum valor não fecha a conta (ou falta), não grava: o XML deve ser gerado e revisado no site.
const fs=require("fs"),path=require("path");
const raiz=path.join(__dirname,"..");
const FIM="2050-01-01";

// constantes do site: uma fonte só para o prompt, os produtos e as UFs
const site=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const pegar=nome=>{const m=site.match(new RegExp(`const ${nome}=([\\s\\S]*?);\\n`));if(!m)throw new Error(`index.html: ${nome} não encontrado`);
  return Function(`"use strict";return (${m[1]})`)();};
const UFS=pegar("UFS"),PRODUTOS=pegar("PRODUTOS"),PROMPT=pegar("PROMPT"),FALLBACKS=pegar("FALLBACKS");

const num=v=>{if(v===null||v===undefined||v==="")return null;const n=typeof v==="number"?v:parseFloat(String(v).replace("%","").replace(",","."));return isFinite(n)?n:null;};
const fmt=v=>{const n=num(v);if(n===null)return null;return String(+n.toFixed(4));};
const same=(a,b)=>{const x=num(a),y=num(b);if(x===null||y===null)return x===y;return Math.abs(x-y)<1e-9;};
function addDays(iso,d){const t=new Date(iso+"T12:00:00Z");t.setUTCDate(t.getUTCDate()+d);return t.toISOString().slice(0,10);}
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const escA=s=>esc(s).replace(/"/g,"&quot;");
const unesc=s=>s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
const br=iso=>iso.split("-").reverse().join("/");

/* ---------- XML (mesmo modelo do site; aqui sem DOMParser) ---------- */
const attr=(tag,nome)=>{const m=tag.match(new RegExp(`${nome}\\s*=\\s*"([^"]*)"`));return m?unesc(m[1]):"";};
function parseXml(text){
  const root=(text.replace(/^﻿/,"").replace(/<\?[\s\S]*?\?>/g,"").match(/<([\w:]+)/)||[])[1];
  if(!root)throw new Error("XML inválido");
  const combs=[...text.matchAll(/<combustivel\b([^>]*)>([\s\S]*?)<\/combustivel>/g)].map(c=>({
    codigoANP:attr(c[1],"codigoANP"),
    tributos:[...c[2].matchAll(/<tributos\b([^>]*)>([\s\S]*?)<\/tributos>/g)].map(t=>({
      ini:attr(t[1],"dataInicioVigencia"),fim:attr(t[1],"dataFimVigencia"),
      estados:[...t[2].matchAll(/<estado\b([^>]*)>([\s\S]*?)<\/estado>/g)].map(e=>({uf:attr(e[1],"ufAtendida"),
        campos:[...e[2].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)].map(f=>[f[1],unesc(f[2])])}))
    }))
  }));
  if(!combs.length)throw new Error("XML sem <combustivel>");
  const prod=text.match(/<produtos\s*\/>|<produtos\b[^>]*>[\s\S]*?<\/produtos>/);
  return {root,combs,produtosXml:prod?prod[0]:"<produtos />"};
}
function blocoAtual(comb,ini){
  const ts=comb.tributos;if(!ts.length)return null;
  const cobre=ts.filter(t=>t.ini<=ini&&(!t.fim||t.fim>=ini));
  const pool=cobre.length?cobre:ts;
  return pool.reduce((a,b)=>b.ini>a.ini?b:a);
}
const prodDe=comb=>PRODUTOS.find(p=>comb.codigoANP.split("|").some(c=>p.codes.includes(c.trim())));
const campo=(est,tag)=>{const f=est.campos.find(c=>c[0]===tag);return f?f[1]:null;};
function extrairAtual(model,ini){
  const atual={},msgs={};
  for(const comb of model.combs){
    const p=prodDe(comb);if(!p)continue;
    const b=blocoAtual(comb,ini);if(!b)continue;
    let m=null;for(const e of b.estados){const x=campo(e,"MensagemPadrao");if(x){m=x;break;}}
    msgs[p.key]=m||"";
    if(p.tipo==="unico"){const e=b.estados[0];
      atual[p.key]={federal:num(campo(e,"TributoFederal")),estadual:num(campo(e,"TributoEstadual")),mistura:num(campo(e,"PercentualMistura"))};
    }else{
      atual[p.key]=b.estados.map(e=>({uf:e.uf,pmpf:num(campo(e,"PMPF")),aliquota:num(campo(e,"PercentualICMS")),federal:num(campo(e,"TributoFederal")),estadual:num(campo(e,"TributoEstadual"))}));
    }
  }
  return {atual,msgs};
}
function novosEstados(p,tpl,novo,mensagem){
  if(p.tipo==="unico"){
    return tpl.estados.map(e=>({uf:e.uf,campos:(()=>{
      const tags=e.campos.map(c=>c[0]);const order=["TributoFederal","TributoEstadual","PercentualMistura","MensagemPadrao"];
      const all=[...new Set([...tags,...order.filter(t=>t!=="MensagemPadrao"||mensagem)])];
      return all.map(t=>{if(t==="TributoFederal")return[t,fmt(novo.federal)];if(t==="TributoEstadual")return[t,fmt(novo.estadual)];
        if(t==="PercentualMistura")return[t,fmt(novo.mistura)];if(t==="MensagemPadrao")return mensagem?[t,mensagem]:null;
        return e.campos.find(c=>c[0]===t);}).filter(c=>c&&c[1]!==null);})()}));
  }
  const tinha=tpl.estados.some(e=>campo(e,"MensagemPadrao"));
  return novo.map(r=>{const c=[];
    if(r.pmpf!==null)c.push(["PMPF",fmt(r.pmpf)]);
    if(r.aliquota!==null)c.push(["PercentualICMS",fmt(r.aliquota)]);
    if(r.federal!==null)c.push(["TributoFederal",fmt(r.federal)]);
    if(r.estadual!==null)c.push(["TributoEstadual",fmt(r.estadual)]);
    if(mensagem&&(tinha||p.key!=="gnv"))c.push(["MensagemPadrao",mensagem]);
    return {uf:r.uf,campos:c};});
}
const assin=ests=>JSON.stringify(ests.map(e=>[e.uf,e.campos.map(([t,v])=>[t,num(v)!==null&&t!=="MensagemPadrao"?num(v):v])]));
function gerar(xml,novo,msgs,ini){
  const fimAnt=addDays(ini,-1);
  const model=JSON.parse(JSON.stringify(xml));const log=[];
  for(const comb of model.combs){
    const p=prodDe(comb);if(!p){log.push(`• ${comb.codigoANP}: não reconhecido — mantido sem alteração.`);continue;}
    const tpl=blocoAtual(comb,ini);if(!tpl){log.push(`• ${p.nome}: sem bloco <tributos> — ignorado.`);continue;}
    const est=novosEstados(p,tpl,novo[p.key],msgs[p.key]||"");
    if(assin(est)===assin(tpl.estados)){log.push(`• ${p.nome}: sem mudança.`);continue;}
    if(tpl.ini>=ini){tpl.estados=est;tpl.fim=FIM;log.push(`• ${p.nome}: valores substituídos no bloco de ${br(tpl.ini)}.`);continue;}
    tpl.fim=fimAnt;
    comb.tributos.splice(comb.tributos.indexOf(tpl)+1,0,{ini,fim:FIM,estados:est});
    log.push(`• ${p.nome}: ALTERADO — antigo até ${br(fimAnt)}, novo a partir de ${br(ini)}.`);
  }
  return {xml:serializar(model),log};
}
function serializar(m){
  const L=[`<${m.root}>`,"  <combustiveis>"];
  for(const c of m.combs){
    L.push(`    <combustivel codigoANP="${escA(c.codigoANP)}">`);
    for(const t of c.tributos){
      L.push(`      <tributos dataInicioVigencia="${escA(t.ini)}" dataFimVigencia="${escA(t.fim)}">`);
      for(const e of t.estados){
        L.push(`        <estado ufAtendida="${escA(e.uf)}">`);
        for(const [tag,v] of e.campos)L.push(`          <${tag}>${esc(v)}</${tag}>`);
        L.push("        </estado>");
      }
      L.push("      </tributos>");
    }
    L.push("    </combustivel>");
  }
  L.push("  </combustiveis>",`  ${m.produtosXml}`,`</${m.root}>`);
  return L.join("\n")+"\n";
}

/* ---------- validação (mesmas contas do site) ---------- */
function checks(p,row){
  const err={};
  if(p.tipo!=="uf")return err;
  if(row.pmpf!==null&&row.aliquota!==null&&row.estadual!==null){
    const base=(p.key==="etanol"&&row.uf==="MT")?row.pmpf*0.5:row.pmpf;
    if(Math.abs(base*row.aliquota/100-row.estadual)>0.0015)err.estadual=true;
  }
  if(p.key==="gnv"&&row.pmpf!==null&&row.federal!==null&&Math.abs(row.pmpf*0.0925-row.federal)>0.0015)err.federal=true;
  if(row.aliquota===null)err.aliquota=true;
  if(p.key==="etanol"){for(const k of["pmpf","estadual","federal"])if(row[k]===null)err[k]=true;}
  return err;
}
function problemas(novo){
  const out=[];
  for(const p of PRODUTOS){const n=novo[p.key];
    if(p.tipo==="unico"){const f=["federal","estadual","mistura"].filter(k=>n[k]===null||n[k]<0);if(f.length)out.push(`${p.nome}: sem ${f.join(", ")}`);}
    else for(const r of n){const e=Object.keys(checks(p,r));if(e.length)out.push(`${p.nome} ${r.uf}: confira ${e.join(", ")}`);}
  }
  return out;
}
// o que mudou em relação à base, para o aviso
function mudancas(atual,novo){
  const out=[];
  for(const p of PRODUTOS){const a=atual[p.key],n=novo[p.key];if(!a)continue;
    if(p.tipo==="unico"){for(const k of["federal","estadual","mistura"])if(!same(a[k],n[k]))out.push(`${p.nome} ${k}: ${fmt(a[k])} → ${fmt(n[k])}`);}
    else for(const r of n){const x=a.find(y=>y.uf===r.uf)||{};
      for(const k of["aliquota","pmpf","estadual","federal"])if(!same(x[k],r[k]))out.push(`${p.nome} ${r.uf} ${k}: ${fmt(x[k])??"—"} → ${fmt(r[k])??"—"}`);}
  }
  return out;
}

/* ---------- Gemini ---------- */
function normalizar(d){
  const o={dataReferencia:d.dataReferencia||null};
  for(const p of PRODUTOS){
    if(p.tipo==="unico"){const x=d[p.key]||{};o[p.key]={federal:num(x.federal),estadual:num(x.estadual),mistura:num(x.mistura)};}
    else{const arr=Array.isArray(d[p.key])?d[p.key]:[];
      o[p.key]=UFS.map(uf=>{const x=arr.find(r=>String(r.uf||"").replace(/\W/g,"").toUpperCase()===uf)||{};
        let a=num(x.aliquota);if(a!==null&&a>0&&a<1)a=+(a*100).toFixed(4);
        return {uf,pmpf:num(x.pmpf),aliquota:a,federal:num(x.federal),estadual:num(x.estadual)};});}
  }
  return o;
}
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
async function chamarGemini(key,pdf){
  const body={contents:[{role:"user",parts:[{inline_data:{mime_type:"application/pdf",data:pdf.toString("base64")}},{text:PROMPT}]}],
    generationConfig:{temperature:0,responseMimeType:"application/json"}};
  let ultimo;
  for(const m of FALLBACKS)for(let t=1;t<=3;t++){
    try{
      console.log(`Consultando ${m} (tentativa ${t}/3)…`);
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
        {method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify(body)});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){const e=new Error(j.error?.message||("HTTP "+r.status));e.status=r.status;throw e;}
      const txt=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought&&p.text).map(p=>p.text).join("");
      if(!txt)throw new Error("a IA não retornou conteúdo");
      return JSON.parse(txt.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim());
    }catch(e){
      ultimo=e;console.log(`${m}: ${e.message}`);
      if(e.status===400||e.status===401||e.status===403)throw new Error("Chave ou requisição inválida: "+e.message);
      if(e.status===404||e instanceof SyntaxError)break; // modelo inexistente ou JSON inválido → próximo modelo
      await dormir((e.status===429?20000:5000)*t);
    }
  }
  throw new Error("IA indisponível. Último erro: "+(ultimo?.message||""));
}

/* ---------- datas dos arquivos ---------- */
const MESES=["JANEIRO","FEVEREIRO","MARCO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
function dataDoPdf(nome){
  const m=nome.normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().match(/(\d{1,2})\s+([A-Z]+)\s+(\d{4})/);
  const i=m?MESES.indexOf(m[2]):-1;
  return i<0?"":`${m[3]}-${String(i+1).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
}
function dataDoXml(nome){const m=nome.match(/^TransparenciaTributos_(\d{4})(\d{2})(\d{2})\.xml$/);return m?`${m[1]}-${m[2]}-${m[3]}`:"";}
// datas dd/mm/aaaa citadas na MensagemPadrao que já passaram (ex.: "no período de 10/09/2026 a 09/10/2026")
function mensagensVencidas(msgs,ini){
  const out=[];
  for(const p of PRODUTOS){const m=msgs[p.key];if(!m)continue;
    const datas=[...m.matchAll(/(\d{2})\/(\d{2})\/(\d{2,4})/g)].map(x=>`${x[3].length===2?"20"+x[3]:x[3]}-${x[2]}-${x[1]}`);
    if(datas.length&&datas.every(d=>d<ini))out.push(`${p.nome}: "${m}"`);
  }
  return out;
}

(async()=>{
  const args=process.argv.slice(2),testar=args.includes("--testar");
  const dirXml=path.join(raiz,"xml");
  let pdfRel=args.find(a=>!a.startsWith("--"));
  if(!pdfRel){ // sem argumento: PDF mais recente pela data do nome
    const l=fs.readdirSync(path.join(raiz,"pdf")).filter(n=>/\.pdf$/i.test(n)&&dataDoPdf(n)).sort((a,b)=>dataDoPdf(b).localeCompare(dataDoPdf(a))||b.localeCompare(a));
    if(!l.length)throw new Error("nenhum PDF em pdf/");pdfRel=`pdf/${l[0]}`;
  }
  const doNome=dataDoPdf(path.basename(pdfRel));if(!doNome)throw new Error(`data não encontrada no nome do PDF: ${pdfRel}`);
  // --pendente: só gera se ainda não há XML da data do PDF mais recente (nova tentativa depois de uma falha)
  if(args.includes("--pendente")&&fs.readdirSync(dirXml).some(n=>dataDoXml(n)>=doNome)){console.log(`XML de ${br(doNome)} já existe em xml/. Nada a fazer.`);return;}
  const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("GEMINI_API_KEY não configurada");

  const novo=normalizar(await chamarGemini(key,fs.readFileSync(path.join(raiz,pdfRel))));
  // vale a data da capa quando ela é posterior à do nome (ex.: "…01 OUTUBRO 2026v2.pdf" com referência 10/10)
  const capa=/^\d{4}-\d{2}-\d{2}$/.test(novo.dataReferencia||"")?novo.dataReferencia:"";
  const ini=capa>doNome?capa:doNome;
  console.log(`PDF: ${pdfRel} | data no nome: ${doNome} | referência na capa: ${capa||"?"} | vigência nova a partir de ${ini}`);

  const xmls=fs.readdirSync(dirXml).filter(dataDoXml).sort().reverse();
  const baseNome=xmls.find(n=>dataDoXml(n)<ini);if(!baseNome)throw new Error(`nenhum XML em xml/ anterior a ${ini}`);
  const base=parseXml(fs.readFileSync(path.join(dirXml,baseNome),"utf8"));
  const {atual,msgs}=extrairAtual(base,ini);
  const saida=`TransparenciaTributos_${ini.replace(/-/g,"")}.xml`;

  const probs=problemas(novo),muds=mudancas(atual,novo),venc=mensagensVencidas(msgs,ini);
  const r=gerar(base,novo,msgs,ini);
  const L=[`PDF: ${path.basename(pdfRel)}`,`Base: xml/${baseNome}`,`Nova vigência: ${br(ini)} (blocos alterados terminam em ${br(addDays(ini,-1))})`,"",...r.log];
  if(muds.length)L.push("",`Valores alterados (${muds.length}):`,...muds.slice(0,80).map(s=>"  "+s),...(muds.length>80?[`  … e mais ${muds.length-80}`]:[]));
  if(venc.length)L.push("","ATENÇÃO: MensagemPadrao copiada da base cita período já vencido — revise no site:",...venc.map(s=>"  "+s));
  const grava=!probs.length&&!testar;
  if(probs.length)L.push("",`XML NÃO GRAVADO: ${probs.length} valor(es) não fecham a conta ou faltam — gere e revise no site:`,...probs.map(s=>"  "+s));
  else L.push("",testar?`(teste) XML não gravado: xml/${saida}`:`XML gravado: xml/${saida}. Confira com o PDF.`);
  const resumo=L.join("\n");
  console.log("\n"+resumo);

  if(grava)fs.writeFileSync(path.join(dirXml,saida),r.xml);
  else if(testar)fs.writeFileSync(path.join(raiz,"xml-teste.xml"),r.xml);
  if(process.env.GITHUB_OUTPUT){
    fs.writeFileSync(path.join(raiz,"xml-resumo.txt"),resumo+"\n");
    if(grava)fs.appendFileSync(process.env.GITHUB_OUTPUT,`xml=${saida}\n`);
  }
  if(probs.length)process.exitCode=2;
})().catch(e=>{
  console.error(e.message||e);
  if(process.env.GITHUB_OUTPUT)fs.writeFileSync(path.join(raiz,"xml-resumo.txt"),`XML NÃO GERADO: ${e.message||e}\nGere e revise no site.\n`);
  process.exit(1);
});
