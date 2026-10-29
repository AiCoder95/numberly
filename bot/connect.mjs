import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createInterface, emitKeypressEvents} from 'node:readline';
import {stdin, stdout} from 'node:process';

function ask(question) {
  return new Promise(resolve => {
    const line = createInterface({input:stdin, output:stdout});
    line.question(question, value => { line.close(); resolve(value.trim()); });
  });
}

function askSecret(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Откройте обычный терминал для скрытого ввода.');
  stdout.write(question);
  return new Promise((resolve,reject) => {
    let value = '';
    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    function finish(error) {
      stdin.off('keypress', onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error); else resolve(value.trim());
    }
    function onKey(chars,key={}) {
      if (key.ctrl && key.name === 'c') return finish(new Error('Отменено.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') { value = value.slice(0,-1); return; }
      if (!key.ctrl && !key.meta && chars && !/[\x00-\x1f\x7f]/.test(chars)) value += chars;
    }
    stdin.on('keypress', onKey);
  });
}

async function telegram(token, method, body) {
  let response, data;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body ?? {})
    });
    data = await response.json();
  } catch { throw new Error('Не удалось связаться с Telegram. Проверьте подключение и повторите попытку.'); }
  if (!response.ok || !data.ok) throw new Error(`Telegram отклонил запрос ${method} (HTTP ${response.status}). Проверьте токен и настройки.`);
  return data.result;
}

function installSecret(secret) {
  const wrangler = fileURLToPath(new URL('../.tools/node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const config = fileURLToPath(new URL('./wrangler.jsonc', import.meta.url));
  return new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[wrangler,'secret','put','WEBHOOK_SECRET','--config',config],{stdio:['pipe','pipe','pipe']});
    child.stdout.resume();
    child.stderr.resume();
    child.on('error',()=>reject(new Error('Не удалось запустить Wrangler. Убедитесь, что он установлен и подключён к Cloudflare.')));
    child.on('close',code=>code === 0 ? resolve() : reject(new Error('Не удалось сохранить секрет в Cloudflare. Проверьте вход в Wrangler и настройки Worker.')));
    child.stdin.on('error',()=>{});
    child.stdin.end(`${secret}\n`);
  });
}

async function main() {
  const address = process.argv[2] || 'https://numberly-bot.jhnnscjhnngmlcm.workers.dev';
  let url;
  try { url = new URL(address); } catch { throw new Error('Введите полный HTTPS-адрес Worker.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['/','/webhook'].includes(url.pathname)) {
    throw new Error('Нужен HTTPS-адрес Worker без параметров и дополнительного пути.');
  }
  url.pathname = '/webhook';
  const token = await askSecret('Токен @NumberGenTgBot (ввод не отображается): ');
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error('Токен бота имеет неверный формат.');
  const bot = await telegram(token,'getMe');
  if (bot.username?.toLowerCase() !== 'numbergentgbot') throw new Error('Этот токен принадлежит другому боту. Подключение отменено.');
  const existing = await telegram(token,'getWebhookInfo');
  if (existing.url) {
    stdout.write('У бота уже есть webhook. Подключение заменит его; старый обработчик перестанет получать сообщения. Если прежний webhook направлен на этот Worker, при ошибке настройки сообщения могут временно не обрабатываться.\n');
    if (!['YES','ДА'].includes((await ask('Продолжить? Введите YES: ')).toUpperCase())) {
      stdout.write('Изменения не внесены.\n'); return;
    }
  } else {
    stdout.write('После подключения webhook другие программы, использующие getUpdates, перестанут получать сообщения этого бота.\n');
    if (!['YES','ДА'].includes((await ask('Подключить новый обработчик? Введите YES: ')).toUpperCase())) {
      stdout.write('Изменения не внесены.\n'); return;
    }
  }
  const secret = randomBytes(32).toString('base64url');
  stdout.write('Настраиваю защиту webhook в Cloudflare...\n');
  await installSecret(secret);
  let healthy = false;
  for (let attempt=0; attempt<5; attempt++) {
    try {
      const health = await fetch(url, {method:'POST',headers:{'content-type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},body:'{}',signal:AbortSignal.timeout(5000)});
      if (health.ok && (await health.text()).trim() === 'OK') { healthy=true; break; }
    } catch {}
    if (attempt<4) await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if (!healthy) {
    throw new Error('Worker не принял проверочный запрос. Убедитесь, что указан верный адрес опубликованного Worker.');
  }
  await telegram(token,'setWebhook',{url:url.toString(),secret_token:secret,allowed_updates:['message']});
  stdout.write('Webhook подключён. Откройте @NumberGenTgBot и отправьте /start.\n');
}

try { await main(); } catch(error) { stdout.write(`${error.message}\n`); process.exitCode = 1; }
