// Page behaviour. Kept in a file (no inline <script> or on* handlers) so the
// Content-Security-Policy can use script-src 'self' without 'unsafe-inline'.
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
// mobile menu
document.getElementById('burger').addEventListener('click',function(){
  document.getElementById('links').classList.toggle('open');
});
// recruiter PDF = print the page
document.getElementById('printPdf').addEventListener('click',function(e){
  e.preventDefault();
  window.print();
});
// project tabs
function showTab(i){
  var tabs=document.querySelectorAll('.tab'),panels=document.querySelectorAll('.panel');
  tabs.forEach(function(t,j){t.classList.toggle('on',j===i)});
  panels.forEach(function(p,j){p.classList.toggle('show',j===i)});
}
document.querySelectorAll('.tab').forEach(function(t,i){
  t.addEventListener('click',function(){showTab(i)});
});
// scroll progress
var prog=document.getElementById('prog');
addEventListener('scroll',function(){
  var h=document.documentElement,sc=h.scrollTop/(h.scrollHeight-h.clientHeight);
  prog.style.width=(sc*100)+'%';
});
// reveal
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
document.querySelectorAll('.rv').forEach(function(el){io.observe(el)});
// close mobile menu on click
document.querySelectorAll('#links a').forEach(function(a){a.addEventListener('click',function(){document.getElementById('links').classList.remove('open')})});
document.getElementById('yr').textContent=new Date().getFullYear();
(function(){var s='en';try{s=localStorage.getItem('lang')||'en'}catch(e){} if(s!=='en')setLang(s)})();
