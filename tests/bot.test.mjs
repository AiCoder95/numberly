import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../bot/worker.js';
import {DedupStore} from '../bot/dedup.js';

const secret = 'test_secret_token_123456789012345';
const request = (body, token=secret, path='/webhook') => new Request(`https://worker.example${path}`, {
  method:'POST', headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':token}, body:JSON.stringify(body)
});
let nextId = 1;
const message = (text,type='private') => { const id=nextId++; return {update_id:id,message:{message_id:id,chat:{id:123,type},text}}; };
const db = new DatabaseSync(':memory:');
const store = new DedupStore({exec:(statement,...args)=>({rowsWritten:Number(db.prepare(statement).run(...args).changes)})});
const environment = {WEBHOOK_SECRET:secret, UPDATE_DEDUP:{getByName:()=>({fetch:(url,init)=>store.fetch(new Request(url,init))})}};
const deliver = body => worker.fetch(request(body),environment);

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
test('repeated delivery of the same update produces exactly one reply, even concurrently',async()=>{
  const update=message('Монетка');
  const replies=await Promise.all(Array.from({length:8},()=>deliver(update)));
  const bodies=await Promise.all(replies.map(response=>response.text()));
  assert.equal(bodies.filter(body=>body==='OK').length,7);
  assert.equal(bodies.filter(body=>body.includes('sendMessage')).length,1);
});
test('the same message with a different update ID is not answered twice',async()=>{
  const first=message('Пароли');
  assert.equal((await (await deliver(first)).json()).method,'sendMessage');
  const repeated={...first,update_id:nextId++};
  assert.equal(await (await deliver(repeated)).text(),'OK');
});
test('different messages and chats receive separate replies',async()=>{
  const first=message('Числа');
  const second=message('Числа');
  const otherChat={...first,update_id:nextId++,message:{...first.message,chat:{...first.message.chat,id:456}}};
  for(const item of [first,second,otherChat]) assert.equal((await (await deliver(item)).json()).method,'sendMessage');
});
test('deduplication stores only update IDs, message hashes and timestamps',()=>{
  const stored=db.prepare('SELECT update_id, message_hash, received_at FROM updates LIMIT 1').get();
  assert.match(stored.message_hash,/^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(stored),['update_id','message_hash','received_at']);
});
test('expired deduplication records are removed when a new message arrives',async()=>{
  db.prepare('INSERT INTO updates (update_id, message_hash, received_at) VALUES (?, ?, ?)').run(-1,'f'.repeat(64),0);
  assert.equal((await (await deliver(message('Помощь'))).json()).method,'sendMessage');
  assert.equal(db.prepare('SELECT count(*) AS n FROM updates WHERE update_id = -1').get().n,0);
});
