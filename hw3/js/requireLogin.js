// js/requireLogin.js
// 一進頁面就檢查，沒登入就直接導去 login
// 適合：user.html、admin.html 這種本來就不該公開的頁面。
function sanitizeNext(raw){
  if(!raw) return "index.html";
  const s = String(raw).trim();
  if(/^[a-zA-Z0-9_\-/]+\.html$/.test(s)) return s;
  return "index.html";
}

async function requireLoginOrRedirect(){
  const resp = await fetch('api/me.php', { credentials: 'include' });
  if(resp.ok) return; // 已登入
  const page = sanitizeNext(location.pathname.split('/').pop() || 'index.html');
  location.href = `login.html?next=${encodeURIComponent(page)}`;
}

document.addEventListener('DOMContentLoaded', requireLoginOrRedirect);
