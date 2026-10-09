"use strict";
// Seletor de tema (claro / escuro / sistema) e menu hambúrguer do mobile, compartilhados pelas páginas.
// O tema salvo é aplicado no <head> de cada página.
function aplicarTema(t){
  if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;
  try{t==="system"?localStorage.removeItem("tema"):localStorage.setItem("tema",t);}catch(e){}
  document.querySelectorAll(".tema button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tema===t)));
  const bg=getComputedStyle(document.body).getPropertyValue("--bg").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.content=t==="system"?(m.media.includes("dark")?"#0d1016":"#f4f6f9"):bg);
}
document.querySelectorAll(".tema button").forEach(b=>b.onclick=()=>aplicarTema(b.dataset.tema));
aplicarTema(document.documentElement.dataset.theme||"system");

/* menu hambúrguer (mobile) */
(function(){
  const topo=document.querySelector(".top"),hb=topo&&topo.querySelector(".hamb");if(!hb)return;
  const abrir=a=>{topo.classList.toggle("aberto",a);hb.setAttribute("aria-expanded",String(a));hb.setAttribute("aria-label",a?"Fechar menu":"Abrir menu");};
  hb.onclick=()=>abrir(!topo.classList.contains("aberto"));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&topo.classList.contains("aberto")){abrir(false);hb.focus();}});
  document.addEventListener("click",e=>{if(!topo.contains(e.target))abrir(false);});
  topo.querySelectorAll(".navwrap a").forEach(a=>a.addEventListener("click",()=>abrir(false)));
  matchMedia("(min-width:761px)").addEventListener("change",e=>{if(e.matches)abrir(false);});
})();
