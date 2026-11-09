// Case study pages: EN/ES toggle shared with the portfolio (same localStorage key), no inline code (CSP).
function setLang(l){
  document.documentElement.lang=l;
  document.querySelectorAll('[data-en]').forEach(function(el){
    var v=el.getAttribute('data-'+l); if(v!==null) el.innerHTML=v;
  });
  document.getElementById('bEN').classList.toggle('on',l==='en');
  document.getElementById('bES').classList.toggle('on',l==='es');
  try{localStorage.setItem('lang',l)}catch(e){}
}
document.getElementById('bEN').addEventListener('click',function(){setLang('en')});
document.getElementById('bES').addEventListener('click',function(){setLang('es')});
document.getElementById('yr').textContent=new Date().getFullYear();
(function(){var s='en';try{s=localStorage.getItem('lang')||'en'}catch(e){}
  if(location.hash==='#caso')s='es';
  if(s!=='en')setLang(s)})();
