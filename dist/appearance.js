const colors = [
  {id:'violet', name:'Фиолетовый', swatch:'#6b50d7'},
  {id:'red', name:'Красный', swatch:'#b72e45'},
  {id:'green', name:'Зелёный', swatch:'#126f51'},
  {id:'blue', name:'Синий', swatch:'#255ac2'}
];

export function initAppearance(tg, openModal) {
  let mode, color;
  try {
    mode = localStorage.getItem('numberly.theme');
    color = localStorage.getItem('numberly.color');
  } catch {}
  if (!['light','dark'].includes(mode)) mode = tg?.initData
    ? (tg.colorScheme === 'dark' ? 'dark' : 'light')
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (!colors.some(item => item.id === color)) color = 'violet';

  function apply() {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.dataset.color = color;
    const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]').content = background;
    try {
      if (tg?.initData) {
        tg.setHeaderColor(background);
        tg.setBackgroundColor(background);
      }
    } catch {}
  }

  function save() {
    try {
      localStorage.setItem('numberly.theme', mode);
      localStorage.setItem('numberly.color', color);
    } catch {}
  }

  function show() {
    openModal('Оформление', `
      <fieldset class="appearance-group"><legend>Режим</legend>
        <div class="mode-options">
          ${[['light','Светлый'],['dark','Тёмный']].map(([id,name]) => `
            <label class="mode-option"><input type="radio" name="appearance-mode" value="${id}" ${mode===id?'checked':''}>
              <span>${name}<span class="appearance-check" aria-hidden="true">✓</span></span>
            </label>`).join('')}
        </div>
      </fieldset>
      <fieldset class="appearance-group"><legend>Цвет приложения</legend>
        <div class="color-options">
          ${colors.map(item => `
            <label class="color-option"><input type="radio" name="appearance-color" value="${item.id}" ${color===item.id?'checked':''}>
              <span><span class="color-swatch" style="--swatch:${item.swatch}" aria-hidden="true"><span>✓</span></span>${item.name}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <p class="appearance-hint">Настройки сохраняются на этом устройстве.</p>
      <button class="primary-button" data-action="close">Готово</button>
    `);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-action="theme"]')) show();
  });
  document.addEventListener('change', event => {
    if (event.target.name === 'appearance-mode' && ['light','dark'].includes(event.target.value)) {
      mode = event.target.value;
      apply(); save();
    }
    if (event.target.name === 'appearance-color' && colors.some(item => item.id === event.target.value)) {
      color = event.target.value;
      apply(); save();
    }
  });
  apply();
}
