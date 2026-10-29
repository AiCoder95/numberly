// Cloudflare Worker: Telegram delivers private messages to /webhook.
// WEBHOOK_SECRET is a Cloudflare secret, never a value in the source code.
const APP_URL = 'https://aicoder95.github.io/numberly/';

const keyboard = {
  keyboard: [
    [{text:'Открыть Numberly', web_app:{url:APP_URL}}],
    [{text:'Розыгрыш'}, {text:'Числа'}, {text:'Пароли'}],
    [{text:'Случайный выбор'}, {text:'Команды'}, {text:'Монетка'}],
    [{text:'История'}, {text:'Данные'}, {text:'Помощь'}]
  ],
  resize_keyboard:true,
  is_persistent:true,
  input_field_placeholder:'Выберите тему или напишите вопрос'
};

const answers = {
  start: 'Привет! Я помогу с Numberly — приложением для случайных чисел, розыгрышей и других задач.\n\nНажмите «Открыть Numberly» или выберите тему в меню.',
  help: 'Выберите тему в меню: розыгрыш, числа, пароли, случайный выбор, команды, монетка, история или данные.\n\nТакже можно написать вопрос словами.',
  draw: 'Чтобы провести розыгрыш:\n1. Откройте Numberly и выберите «Розыгрыш».\n2. Вставьте участников — по одному на строку.\n3. Укажите число победителей и нажмите «Выбрать победителей».\n\nОдинаковые строки удаляются. Проверки подписок и публичного подтверждения результата пока нет.',
  numbers: 'В разделе «Числа» укажите границы диапазона и количество чисел. Включите «Без повторений», если каждое число должно встретиться не больше одного раза, и нажмите «Сгенерировать».',
  passwords: 'В разделе «Пароли» укажите длину и выберите нужные символы. Затем нажмите «Создать пароль» и скопируйте результат.\n\nПароли не сохраняются в истории приложения.',
  choice: 'В разделе «Выбор» введите минимум два варианта — каждый с новой строки. Нажмите «Сделать выбор», чтобы получить один случайный вариант.',
  teams: 'В разделе «Команды» введите участников — по одному на строку — и укажите число команд. Приложение распределит участников случайно и постарается сделать команды одинакового размера.',
  coin: 'В разделе «Монетка» укажите количество бросков и нажмите «Подбросить монетку». Для каждого броска появится орёл или решка.',
  history: 'История открывается кнопкой в верхней части приложения. Она хранится на текущем устройстве и не переносится на другие устройства. В истории доступны последние 30 результатов; пароли не сохраняются.',
  privacy: 'Списки и результаты обрабатываются в браузере. История хранится на текущем устройстве; её можно очистить в приложении. Пароли в историю не записываются.\n\nДля защиты от повторных ответов бот временно хранит технические идентификаторы событий и хэши идентификаторов сообщений. Тексты сообщений не сохраняются.\n\nНе отправляйте пароли и списки участников в чат бота.',
  unknown: 'Я отвечаю на вопросы о работе Numberly. Выберите тему в меню или напишите, что именно хотите сделать.'
};

function topicFor(text) {
  const normalized = text.trim().toLowerCase().replace(/ё/g, 'е');
  const command = normalized.match(/^\/(start|help|privacy|app)(?:@[a-z0-9_]+)?(?:\s|$)/)?.[1];
  if (command === 'start' || command === 'app') return 'start';
  if (command === 'help') return 'help';
  if (command === 'privacy') return 'privacy';
  if (/^(привет|здравств|добрый день|доброе утро|добрый вечер)/.test(normalized)) return 'start';
  if (/парол/.test(normalized)) return 'passwords';
  if (/истори|результат.*хран|где.*результат/.test(normalized)) return 'history';
  if (/данн|конфиденц|приватн|безопасн/.test(normalized)) return 'privacy';
  if (/команд|распредел/.test(normalized)) return 'teams';
  if (/розыгр|конкурс|победител|участник/.test(normalized)) return 'draw';
  if (/числ|диапазон|рандом/.test(normalized)) return 'numbers';
  if (/монет|орел|решк/.test(normalized)) return 'coin';
  if (/выбор|выбрать|вариант/.test(normalized)) return 'choice';
  if (/помощ|помог|инструкц|как пользоваться|что уме/.test(normalized)) return 'help';
  return 'unknown';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/webhook') return new Response('Not found', {status:404});
    if (request.method !== 'POST') return new Response('Method not allowed', {status:405, headers:{Allow:'POST'}});
    if (!env.WEBHOOK_SECRET || !/^[A-Za-z0-9_-]{24,256}$/.test(env.WEBHOOK_SECRET)) {
      return new Response('Webhook is not configured', {status:503});
    }
    if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', {status:401});
    }

    let update;
    try { update = await request.json(); } catch { return new Response('Invalid JSON', {status:400}); }
    const message = update?.message;
    if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id) || typeof message.text !== 'string') {
      return new Response('OK');
    }
    if (!Number.isSafeInteger(update.update_id) || !Number.isSafeInteger(message.message_id)) return new Response('OK');
    const answer = answers[topicFor(message.text)];
    // Store only a digest of the message identity, never the chat ID or message text.
    const identity = new TextEncoder().encode(`${message.chat.id}:${message.message_id}`);
    const digest = await crypto.subtle.digest('SHA-256', identity);
    const messageHash = Array.from(new Uint8Array(digest), n=>n.toString(16).padStart(2,'0')).join('');
    const dedup = env.UPDATE_DEDUP.getByName('telegram-updates');
    return dedup.fetch('https://dedup.internal/', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({updateId:update.update_id, messageHash,
        reply:{method:'sendMessage', chat_id:message.chat.id, text:answer, reply_markup:keyboard}})
    });
  }
};
