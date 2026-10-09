"use strict";
// Seletor de tema (claro / escuro / sistema), compartilhado pelas páginas. O tema salvo é aplicado no <head> de cada página.
function aplicarTema(t){
  if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;
  try{t==="system"?localStorage.removeItem("tema"):localStorage.setItem("tema",t);}catch(e){}
  document.querySelectorAll(".tema button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tema===t)));
  const bg=getComputedStyle(document.body).getPropertyValue("--bg").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.content=t==="system"?(m.media.includes("dark")?"#0d1016":"#f4f6f9"):bg);
}
document.querySelectorAll(".tema button").forEach(b=>b.onclick=()=>aplicarTema(b.dataset.tema));
aplicarTema(document.documentElement.dataset.theme||"system");
