export function randomInt(min,max){
 if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||max<min)throw Error('Проверьте границы диапазона.');
 const size=max-min+1;if(size>4294967296)throw Error('Диапазон не должен превышать 4 294 967 296 чисел.');
 const limit=Math.floor(4294967296/size)*size;const buffer=new Uint32Array(1);let n;
 do{crypto.getRandomValues(buffer);n=buffer[0];}while(n>=limit);return min+n%size;
}
export function numbers(min,max,count,unique=true){
 if(!Number.isInteger(count)||count<1||count>1000)throw Error('Количество: от 1 до 1 000.');
 randomInt(min,max);
 if(unique&&count>max-min+1)throw Error('В диапазоне недостаточно уникальных чисел.');
 if(!unique)return Array.from({length:count},()=>randomInt(min,max));
 const selected=new Set();for(let j=max-count+1;j<=max;j++){const n=randomInt(min,j);selected.add(selected.has(n)?j:n);}return shuffle([...selected]);
}
export function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=randomInt(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function parseList(text){return [...new Set(text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];}
export function draw(text,count){const list=parseList(text);if(list.length>10000)throw Error('Максимум 10 000 участников.');if(!Number.isInteger(count)||count<1||count>list.length)throw Error('Победителей должно быть от 1 до количества участников.');return shuffle(list).slice(0,count);}
export function password(length,options){
 if(!Number.isInteger(length)||length<8||length>128)throw Error('Длина пароля: от 8 до 128 символов.');
 const groups=[options.lower?'abcdefghijkmnopqrstuvwxyz':null,options.upper?'ABCDEFGHJKLMNPQRSTUVWXYZ':null,options.digits?'23456789':null,options.symbols?'!@#$%&*+-=?':null].filter(Boolean);
 if(!groups.length)throw Error('Выберите хотя бы один набор символов.');
 const alphabet=groups.join('');let result;
 do{result=Array.from({length},()=>alphabet[randomInt(0,alphabet.length-1)]).join('');}while(!groups.every(g=>[...result].some(c=>g.includes(c))));return result;
}
export function teams(text,count){const list=parseList(text);if(!Number.isInteger(count)||count<2||count>Math.min(50,list.length))throw Error('Укажите от 2 до 50 команд, не больше числа участников.');const out=Array.from({length:count},()=>[]);shuffle(list).forEach((x,i)=>out[i%count].push(x));return out;}
