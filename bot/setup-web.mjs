// Local setup page. The bot token is held only in process memory and is never logged.
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const host = '127.0.0.1';
const port = 4178;
const origin = `http://${host}:${port}`;
const workerUrl = 'https://numberly-bot.jhnnscjhnngmlcm.workers.dev/webhook';
const wrangler = fileURLToPath(new URL('../.tools/node_modules/wrangler/bin/wrangler.js', import.meta.url));
const config = fileURLToPath(new URL('./wrangler.jsonc', import.meta.url));
let candidate = null;
let busy = false;

const page = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Подключить Numberly</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#25252e;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{max-width:560px;margin:7vh auto;padding:28px}section{background:white;border:1px solid #dedee5;border-radius:12px;padding:28px}h1{font-size:25px;letter-spacing:-.5px;margin:0 0 12px}p{color:#55555f;margin:0 0 16px}label{display:block;font-weight:600;font-size:14px;margin:24px 0 8px}input{width:100%;font:inherit;font-size:16px;padding:13px;border:1px solid #aaaab4;border-radius:7px}button{font:inherit;font-weight:600;font-size:15px;border:0;border-radius:7px;padding:14px 18px;min-height:48px;background:#6b50d7;color:#fff;cursor:pointer}button:disabled{opacity:.5}button.secondary{background:#eeeef3;color:#25252e;margin-right:8px}button:focus-visible,input:focus-visible{outline:3px solid #6b50d7;outline-offset:2px}.small{font-size:13px;margin-top:8px}#message{margin:18px 0 0;font-size:14px;white-space:pre-line}#message.error{color:#a3293e}.note{border-left:3px solid #6b50d7;padding-left:14px;margin:20px 0}.actions{display:flex;flex-wrap:wrap;gap:8px}[hidden]{display:none!important}@media(max-width:600px){main{margin:0;padding:16px}section{padding:20px}}
</style></head><body><main><section>
<h1>Подключить Numberly к боту</h1>
<div id="step-token">
<p>Откройте @BotFather → /mybots → @NumberGenTgBot → API Token и скопируйте новый токен.</p>
<p>Вставьте токен <strong>в поле ниже</strong>. Он передаётся с этой страницы локальной программе и Telegram и не сохраняется в файлах проекта.</p>
<form id="check-form"><label for="token">Новый токен бота</label><input id="token" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" required><p class="small">Токен не отображается при вводе.</p><button id="check" type="submit">Проверить бота</button></form>
</div>
<div id="step-confirm" hidden><p id="bot-info"></p><p class="note" id="warning"></p><p>После подключения бот начнёт отвечать в личных сообщениях. Предыдущий обработчик или программа, получающая сообщения через getUpdates, перестанет их получать.</p><div class="actions"><button id="back" type="button" class="secondary">Назад</button><button id="connect" type="button">Подключить бота</button></div></div>
<div id="step-done" hidden><p>Бот подключён. Откройте @NumberGenTgBot и отправьте /start.</p><a href="https://t.me/NumberGenTgBot" target="_blank" rel="noopener">Открыть бота в Telegram ↗</a></div>
<p id="message" role="status" hidden></p>
</section></main>
<script>
const $=s=>document.querySelector(s);const msg=(text,error=false)=>{const el=$('#message');el.hidden=!text;el.textContent=text;el.className=error?'error':'';};
async function post(path,data){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось выполнить действие.');return result;}
$('#check-form').addEventListener('submit',async e=>{e.preventDefault();$('#check').disabled=true;msg('Проверяем бота…');try{const result=await post('/check',{token:$('#token').value.trim()});$('#token').value='';$('#step-token').hidden=true;$('#step-confirm').hidden=false;$('#bot-info').textContent='Найден бот @'+result.username+'.';$('#warning').textContent=result.existing?'У бота уже есть webhook. При продолжении он будет заменён. Если старый webhook использует этот же Worker, при ошибке настройки ответы могут временно остановиться.':'Активный webhook не найден. Подключение также отключит получение сообщений через getUpdates.';msg('');}catch(error){msg(error.message,true);}finally{$('#check').disabled=false;}});
$('#back').addEventListener('click',()=>{$('#step-confirm').hidden=true;$('#step-token').hidden=false;msg('');});
$('#connect').addEventListener('click',async()=>{$('#connect').disabled=true;$('#back').disabled=true;msg('Подключаем бота. Это может занять около минуты…');try{await post('/connect',{});$('#step-confirm').hidden=true;$('#step-done').hidden=false;msg('');}catch(error){msg(error.message,true);}finally{$('#connect').disabled=false;$('#back').disabled=false;}});
</script></body></html>`;

function json(res, status, data) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(data));
}

async function telegram(token, method, body={}) {
  let response, data;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(20000)
    });
    data = await response.json();
  } catch { throw new Error('Не удалось связаться с Telegram. Проверьте интернет и повторите попытку.'); }
  if (!response.ok || !data.ok) throw new Error(`Telegram отклонил запрос ${method} (HTTP ${response.status}). Проверьте токен и настройки.`);
  return data.result;
}

function installSecret(secret) {
  return new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[wrangler,'secret','put','WEBHOOK_SECRET','--config',config],{stdio:['pipe','pipe','pipe']});
    child.stdout.resume(); child.stderr.resume();
    child.on('error',()=>reject(new Error('Не удалось запустить Wrangler.')));
    child.on('close',code=>code === 0 ? resolve() : reject(new Error('Не удалось сохранить секрет в Cloudflare. Проверьте авторизацию Wrangler.')));
    child.stdin.on('error',()=>{}); child.stdin.end(`${secret}\n`);
  });
}

async function readJson(req) {
  let input = '';
  for await (const chunk of req) {
    input += chunk;
    if (input.length > 8192) throw new Error('Запрос слишком большой.');
  }
  try { return JSON.parse(input); } catch { throw new Error('Не удалось прочитать запрос.'); }
}

const server = http.createServer(async (req,res) => {
  if (req.headers.host !== `${host}:${port}`) return json(res,403,{error:'Неверный адрес.'});
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
    return res.end(page);
  }
  if (req.method !== 'POST' || !['/check','/connect'].includes(req.url)) return json(res,404,{error:'Не найдено.'});
  if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return json(res,403,{error:'Запрос отклонён.'});
  if (busy) return json(res,409,{error:'Дождитесь завершения текущей операции.'});
  busy = true;
  try {
    const body = await readJson(req);
    if (req.url === '/check') {
      candidate = null;
      const token = body.token;
      if (typeof token !== 'string' || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error('Проверьте формат токена.');
      const bot = await telegram(token,'getMe');
      if (bot.username?.toLowerCase() !== 'numbergentgbot') throw new Error('Этот токен принадлежит другому боту. Нужен токен @NumberGenTgBot.');
      const info = await telegram(token,'getWebhookInfo');
      candidate = {token, expires:Date.now()+10*60*1000};
      return json(res,200,{username:bot.username, existing:Boolean(info.url)});
    }
    if (!candidate || candidate.expires < Date.now()) { candidate=null; throw new Error('Проверка истекла. Вернитесь назад и введите токен снова.'); }
    const token = candidate.token;
    const secret = randomBytes(32).toString('base64url');
    await installSecret(secret);
    let healthy = false;
    for (let attempt=0; attempt<5; attempt++) {
      try {
        const health = await fetch(workerUrl,{method:'POST',headers:{'content-type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},body:'{}',signal:AbortSignal.timeout(5000)});
        if (health.ok && (await health.text()).trim() === 'OK') { healthy=true; break; }
      } catch {}
      if (attempt<4) await new Promise(resolve=>setTimeout(resolve,2000));
    }
    if (!healthy) throw new Error('Worker не принял проверочный запрос. Проверьте конфигурацию Cloudflare и повторите попытку.');
    await telegram(token,'setWebhook',{url:workerUrl,secret_token:secret,allowed_updates:['message']});
    candidate = null;
    return json(res,200,{ok:true});
  } catch(error) {
    return json(res,400,{error:error.message || 'Не удалось выполнить действие.'});
  } finally { busy=false; }
});

server.listen(port,host,()=>console.log(`Страница подключения: ${origin}`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
