import {numbers,draw,password,parseList,teams,randomInt} from './core.js';
import {initAppearance} from './appearance.js';
const $=s=>document.querySelector(s);
const paths={hash:'M5 9h14M4 15h14M11 3 7 21M17 3l-4 18',gift:'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z',key:'M14 14a6 6 0 1 0-4-4L3 17v4h4v-3h3v-3l4-1ZM17 7h.01',shuffle:'M3 5h3c4 0 8 14 12 14h3M18 16l3 3-3 3M3 19h3c1 0 3-2 5-5M14 9c2-3 3-4 4-4h3M18 2l3 3-3 3',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',coin:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 6v2m0 8v2',moon:'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z',history:'M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7M12 7v5l3 2',copy:'M9 9h12v12H9zM5 15H3V3h12v2',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'};
const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n]||paths.hash}"/></svg>`;
function icons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tools=[
 {id:'numbers',name:'Числа',nav:'Генератор чисел',icon:'hash',description:'Целые числа в заданном диапазоне.'},
 {id:'draw',name:'Розыгрыш',nav:'Розыгрыш',icon:'gift',description:'Выбор победителей из списка без повторений.'},
 {id:'password',name:'Пароли',nav:'Генератор паролей',icon:'key',description:'Выберите длину пароля и наборы символов.'},
 {id:'choice',name:'Выбор',nav:'Случайный выбор',icon:'shuffle',description:'Один случайный вариант из вашего списка.'},
 {id:'teams',name:'Команды',nav:'Разделить на команды',icon:'users',description:'Случайное распределение участников по командам.'},
 {id:'games',name:'Монетка',nav:'Подбросить монетку',icon:'coin',description:'Орёл или решка.'}
];
let mode='numbers',resultText='',history=[],modalFocus=null,toastTimer;const formCache={};
try{const saved=JSON.parse(localStorage.getItem('numberly.history')||'[]');if(Array.isArray(saved))history=saved.filter(x=>x&&typeof x.text==='string'&&typeof x.title==='string'&&Number.isFinite(x.time)).slice(0,30);}catch{}
function persist(){try{localStorage.setItem('numberly.history',JSON.stringify(history));}catch{toast('История недоступна в этом браузере');}}
const tg=window.Telegram?.WebApp;
initAppearance(tg,openModal);if(tg?.initData){tg.ready();tg.expand();}
function input(name,label,value,extra='',hint=''){return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="number" inputmode="numeric" value="${value}" ${extra} ${hint?`aria-describedby="${name}-hint"`:''}>${hint?`<small id="${name}-hint">${hint}</small>`:''}</div>`;}
function listField(label,placeholder){return `<div class="field"><label for="list">${label}</label><textarea name="list" id="list" aria-describedby="list-count" maxlength="200000" placeholder="${placeholder}" spellcheck="false"></textarea><small id="list-count">${mode==='choice'?'По одному варианту':'По одному участнику'} на строку. Повторы удаляются.</small></div>`;}
function toggle(name,label,desc='',checked=true){return `<label class="switch-row"><span><strong>${label}</strong>${desc?`<small>${desc}</small>`:''}</span><input name="${name}" type="checkbox" ${checked?'checked':''} aria-label="${label}"></label>`;}
function renderFields(){
 const fields={numbers:()=>`<div class="field-row">${input('min','От',1,'min="-1000000000" max="1000000000"')}${input('max','До',100,'min="-1000000000" max="1000000000"')}</div>${input('count','Количество чисел',1,'min="1" max="1000"')}${toggle('unique','Без повторений','Каждое число выпадет только один раз')}`,
 draw:()=>`${listField('Участники','@anna\n@mikhail\n@daria')}${input('count','Количество победителей',1,'min="1" max="1000"','Каждый участник может выиграть только один раз.')}`,
 password:()=>`${input('length','Длина пароля',16,'min="8" max="128"','От 8 до 128 символов. Без 0, 1, I, O и l.')}${toggle('lower','Строчные буквы','a–z')}${toggle('upper','Заглавные буквы','A–Z')}${toggle('digits','Цифры','2–9')}${toggle('symbols','Специальные символы','! @ # $ % &',false)}`,
 choice:()=>`${listField('Варианты на выбор','Пицца\nСуши\nПаста')}<p class="field"><small>Добавьте от 2 до 10 000 разных вариантов.</small></p>`,
 teams:()=>`${listField('Участники','Аня\nМиша\nДаша\nСаша')}${input('count','Количество команд',2,'min="2" max="50"','Размеры команд отличаются не больше чем на одного участника.')}`,
 games:()=>`<p class="coin-note">Каждый бросок независим: вероятность орла и решки — 50%.</p>${input('count','Количество бросков',1,'min="1" max="20"','От 1 до 20 независимых бросков за один раз.')}`};
 $('#fields').innerHTML=fields[mode]();const cached=formCache[mode];if(cached)for(const el of $('#generator-form').elements)if(el.name&&cached[el.name]!==undefined){if(el.type==='checkbox')el.checked=cached[el.name];else el.value=cached[el.name];}
 $('#generate-label').textContent=({draw:'Выбрать победителей',choice:'Сделать выбор',teams:'Разделить на команды',games:'Подбросить монетку',password:'Создать пароль'})[mode]||'Сгенерировать';
 $('#form-error').textContent='';updateListCount();
}
function updateListCount(){const el=$('#list');if(!el)return;const count=parseList(el.value).length;$('#list-count').textContent=count?`${mode==='choice'?'Вариантов':'Участников'} без повторов: ${count}`:`${mode==='choice'?'По одному варианту':'По одному участнику'} на строку. Повторы удаляются.`;}
function cacheForm(){const cache={};for(const el of $('#generator-form').elements)if(el.name)cache[el.name]=el.type==='checkbox'?el.checked:el.value;formCache[mode]=cache;}
function selectTool(id){
 if(!tools.some(x=>x.id===id))return;
 const focusGroup=document.activeElement?.closest('#navigation')?'#navigation':document.activeElement?.closest('#tools')?'#tools':null;
 cacheForm(); mode=id; const tool=tools.find(t=>t.id===id);
 $('#navigation').innerHTML=tools.map(t=>`<button class="nav-item ${t.id===mode?'active':''}" data-tool="${t.id}" ${t.id===mode?'aria-current="page"':''}>${icon(t.icon)}${t.name}</button>`).join('');
 $('#tools').innerHTML=tools.map(t=>`<button class="tool-card ${t.id===mode?'active':''}" data-tool="${t.id}" aria-pressed="${t.id===mode}">${icon(t.icon)}<span>${t.name}</span></button>`).join('');
 $('#tool-title').textContent=tool.nav; $('#breadcrumb').textContent=tool.name; $('#tool-description').textContent=tool.description;
 renderFields(); resetResult();
 if(focusGroup)document.querySelector(`${focusGroup} [data-tool="${id}"]`)?.focus({preventScroll:true});
}
function resetResult(){
 resultText='';
 $('#result').innerHTML=`<p class="result-placeholder">Нажмите «${esc($('#generate-label').textContent)}», чтобы получить результат.</p>`;
 $('#result-meta').textContent=''; $('#result-meta').hidden=true;
 $('.result-actions').hidden=true; $('#copy-result').disabled=true; $('#save-result').disabled=true;
 $('#save-result').hidden=mode==='password';
}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3000);}
function int(data,key){const raw=data.get(key);if(raw===null||!String(raw).trim())throw Error('Заполните все числовые поля.');const n=Number(raw);if(!Number.isSafeInteger(n))throw Error('Введите целые числа.');return n;}
$('#generator-form').addEventListener('submit',e=>{e.preventDefault();$('#form-error').textContent='';try{
 const data=new FormData(e.currentTarget);let values,html,meta;const tool=tools.find(x=>x.id===mode);
 if(mode==='numbers'){const min=int(data,'min'),max=int(data,'max');if(Math.abs(min)>1e9||Math.abs(max)>1e9)throw Error('Границы диапазона: от −1 000 000 000 до 1 000 000 000.');values=numbers(min,max,int(data,'count'),data.has('unique'));html=values.length===1?`<span class="big-number ${String(values[0]).length>6?'long-number':''}">${values[0]}</span>`:values.map(n=>`<span class="number-chip">${n}</span>`).join('');meta=`От ${min} до ${max} · ${values.length} шт. · ${data.has('unique')?'без повторений':'повторы возможны'}`;resultText=values.join(', ');}
 if(mode==='draw'){if(int(data,'count')>1000)throw Error('Максимум 1 000 победителей.');values=draw(data.get('list'),int(data,'count'));html=`<ol class="winner-list">${values.map((v,i)=>`<li><span>${i+1}.</span> ${esc(v)}</li>`).join('')}</ol>`;meta=`Участников: ${parseList(data.get('list')).length} · победителей: ${values.length}`;resultText=values.map((v,i)=>`${i+1}. ${v}`).join('\n');}
 if(mode==='password'){const pass=password(int(data,'length'),Object.fromEntries(['lower','upper','digits','symbols'].map(k=>[k,data.has(k)])));html=`<span class="password-result">${esc(pass)}</span>`;meta=`Символов: ${pass.length} · в историю не сохраняется`;resultText=pass;}
 if(mode==='choice'){const list=parseList(data.get('list'));if(list.length<2||list.length>10000)throw Error('Добавьте от 2 до 10 000 разных вариантов.');const value=list[randomInt(0,list.length-1)];html=`<span class="choice-result">${esc(value)}</span>`;meta=`Выбрано из ${list.length} вариантов`;resultText=value;}
 if(mode==='teams'){values=teams(data.get('list'),int(data,'count'));html=`<div class="team-list">${values.map((g,i)=>`<p><strong>Команда ${i+1}</strong><br>${g.map(esc).join(', ')}</p>`).join('')}</div>`;meta=`Участников: ${parseList(data.get('list')).length} · команд: ${values.length}`;resultText=values.map((g,i)=>`Команда ${i+1}: ${g.join(', ')}`).join('\n');}
 if(mode==='games'){const count=int(data,'count');if(count<1||count>20)throw Error('Количество бросков: от 1 до 20.');values=Array.from({length:count},()=>['Орёл','Решка'][randomInt(0,1)]);html=values.map(v=>`<span class="${count===1?'coin-result':'number-chip'}">${v}</span>`).join('');meta=`Бросков: ${count} · орлов: ${values.filter(v=>v==='Орёл').length} · решек: ${values.filter(v=>v==='Решка').length}`;resultText=values.join(', ');}
 $('#result').innerHTML=html;$('#result-meta').textContent=meta;$('#result-meta').hidden=false;$('.result-actions').hidden=false;$('#copy-result').disabled=false;$('#save-result').disabled=false;
 if(mode!=='password'){history.unshift({title:tool.nav,text:resultText.slice(0,15000),meta,time:Date.now()});history=history.slice(0,30);persist();}
 try{if(tg?.initData)tg.HapticFeedback?.impactOccurred('light');}catch{}
 }catch(error){$('#form-error').textContent=error.message;}});
$('#fields').addEventListener('input',updateListCount);
$('#copy-result').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(resultText);toast('Результат скопирован');}catch{toast('Выделите результат и скопируйте его вручную');}});
$('#save-result').addEventListener('click',()=>{if(!resultText||mode==='password')return;const title=tools.find(x=>x.id===mode).nav;const blob=new Blob([`${title} · Numberly\n${new Date().toLocaleString('ru-RU')}\n${$('#result-meta').textContent}\n\n${resultText}\n\nСгенерировано на устройстве. Публичной проверки результата нет.`],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`numberly-${mode}-${Date.now()}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Файл результата подготовлен');});
function openModal(title,content){
 if($('#modal-overlay').hidden)modalFocus=document.activeElement;
 $('#modal-title').textContent=title; $('#modal-content').innerHTML=content; $('#modal-content').scrollTop=0;
 $('#modal-overlay').hidden=false; $('.shell').inert=true; $('.sidebar').inert=true;
 document.body.style.overflow='hidden'; $('[data-action="close"]').focus();
}
function closeModal(){
 $('#modal-overlay').hidden=true; $('.shell').inert=false; $('.sidebar').inert=false;
 document.body.style.overflow=''; if(modalFocus?.isConnected)modalFocus.focus();
}
function showHistory(){
 const entries=history.map(item=>`<article class="history-entry"><strong>${esc(item.title)}</strong><small>${new Date(item.time).toLocaleString('ru-RU')}</small>${item.text.length>300?`<p>${esc(item.text.slice(0,180))}…</p><details><summary>Показать полностью</summary><p>${esc(item.text)}</p></details>`:`<p>${esc(item.text)}</p>`}</article>`).join('');
 openModal('История',history.length?`<p>Последние 30 результатов на этом устройстве. Пароли не сохраняются.</p>${entries}<button class="delete-history" data-action="clear-history">Очистить историю</button>`:'<p>Сохранённых результатов пока нет. После генерации они появятся здесь. Пароли в историю не попадают.</p>');
}
document.addEventListener('click',e=>{const tool=e.target.closest('[data-tool]');if(tool){selectTool(tool.dataset.tool);return;}if(e.target.closest('.brand')){e.preventDefault();selectTool('numbers');return;}const action=e.target.closest('[data-action]')?.dataset.action;if(action==='close')closeModal();if(action==='history')showHistory();if(action==='clear-history'){history=[];persist();showHistory();toast('История очищена');}
 if(action==='privacy')openModal('Данные и хранение','<p>Списки обрабатываются в браузере. История последних 30 результатов хранится на этом устройстве и не синхронизируется. Удалить её можно кнопкой «Очистить историю».</p><p>Пароли не сохраняются и не отправляются на сервер. При копировании пароль попадает в системный буфер обмена.</p><p>Приложение загружает Telegram SDK. Хостинг и Telegram получают технические данные запросов. В приложении нет аналитики и рекламы.</p>');
 if(action==='about')openModal('Numberly','<p>Генераторы чисел и паролей, розыгрыши по списку, случайный выбор, команды и монетка.</p><p>Результаты создаются на устройстве. Розыгрыш можно повторить, поэтому сохранённый результат не подтверждает, что это была первая попытка.</p><p><a href="https://t.me/NumberGenTgBot" target="_blank" rel="noopener">Открыть @NumberGenTgBot ↗</a></p>');
});
$('#modal-overlay').addEventListener('click',e=>{if(e.target===$('#modal-overlay'))closeModal();});
document.addEventListener('keydown',e=>{if($('#modal-overlay').hidden)return;if(e.key==='Escape')closeModal();if(e.key==='Tab'){const items=[...$('.modal').querySelectorAll('button,a[href],input,textarea,select')].filter(x=>!x.disabled);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
icons();selectTool('numbers');
