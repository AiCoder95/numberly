import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../bot/worker.js';

const secret = 'test_secret_token_123456789012345';
const request = (body, token=secret, path='/webhook') => new Request(`https://worker.example${path}`, {
  method:'POST', headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':token}, body:JSON.stringify(body)
});
const message = (text,type='private') => ({message:{chat:{id:123,type},text}});
const deliver = body => worker.fetch(request(body),{WEBHOOK_SECRET:secret});

test('only the configured webhook accepts updates',async()=>{
  assert.equal((await worker.fetch(request(message('/start'),'wrong'),{WEBHOOK_SECRET:secret})).status,401);
  assert.equal((await worker.fetch(request(message('/start')),{WEBHOOK_SECRET:''})).status,503);
  assert.equal((await worker.fetch(request(message('/start'),secret,'/'),{WEBHOOK_SECRET:secret})).status,404);
  assert.equal((await worker.fetch(new Request('https://worker.example/webhook'),{WEBHOOK_SECRET:secret})).status,405);
});
test('start produces a Telegram response and a Mini App keyboard',async()=>{
  const data=await (await deliver(message('/start'))).json();
  assert.equal(data.method,'sendMessage'); assert.equal(data.chat_id,123);
  assert.match(data.text,/Numberly/);
  assert.equal(data.reply_markup.keyboard[0][0].web_app.url,'https://aicoder95.github.io/numberly/');
});
test('commands, buttons and natural questions select the intended answer',async()=>{
  for(const [input,expected] of [['/help',/тему в меню/],['/start@NumberGenTgBot',/Привет/],['Привет',/Numberly/],['Пароли',/не сохраняются/],['как найти историю?',/30 результатов/],['как провести конкурс',/победителей/],['Монетка',/орёл или решка/],['как распределить участников по командам',/распределит/],['Случайный выбор',/два варианта/],['/privacy',/пароли/i],['погода',/выберите тему/i]]){
    const data=await (await deliver(message(input))).json();assert.match(data.text,expected,input);
  }
});
test('messages in groups, channel updates and non-text messages are ignored',async()=>{
  for(const update of [message('/start','group'),{channel_post:{chat:{id:3,type:'channel'},text:'/start'}},{message:{chat:{id:4,type:'private'},sticker:{}}}]){
    const response=await deliver(update);assert.equal(response.status,200);assert.equal(await response.text(),'OK');
  }
});
test('malformed JSON is rejected after authentication',async()=>{
  const response=await worker.fetch(new Request('https://worker.example/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:'{'}),{WEBHOOK_SECRET:secret});
  assert.equal(response.status,400);
});
