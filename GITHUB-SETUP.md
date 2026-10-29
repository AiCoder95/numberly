# Бесплатный запуск Numberly в Telegram

## Что подготовлено

Приложение находится в `dist/`. Workflow `.github/workflows/pages.yml` проверяет генераторы и публикует эту папку через GitHub Pages после отправки изменений в ветку `main`. Секреты и токен бота не нужны.

## Способ 1: автоматическая публикация

1. Создайте в своём GitHub новый публичный репозиторий `numberly`. На GitHub Free Pages доступен для публичных репозиториев: исходный код будет виден всем. Не загружайте токен Telegram-бота.
2. Поместите в корень репозитория `dist/`, `tests/`, `package.json` и `.github/workflows/pages.yml`. Удобнее сделать это через Git, чтобы не потерять скрытую папку `.github`. Не загружайте `.git/` и `.openai/` из локального проекта.
3. В репозитории откройте Settings → Pages → Build and deployment → Source → GitHub Actions.
4. На вкладке Actions откройте Test and deploy Numberly и запустите Run workflow для `main`, если автоматическая публикация ещё не началась.
5. Дождитесь зелёного результата. Настоящий адрес появится в Settings → Pages и в успешном задании deploy. Обычно формат адреса: `https://ВАШ-ЛОГИН.github.io/numberly/`.

## Способ 2: через сайт GitHub без Git

1. Создайте публичный репозиторий `numberly` с README в ветке `main`.
2. Распакуйте `Numberly-ready.zip` с пятью файлами интерфейса. Загрузите эти файлы в корень репозитория через Add file → Upload files, затем сохраните изменения кнопкой Commit changes. Загружать нужно файлы, а не сам ZIP.
3. Settings → Pages → Source → Deploy from a branch → Branch: main → папка /(root) → Save.
4. Дождитесь публикации. Этот способ не использует автоматические тесты из workflow. Последующие изменения пяти файлов также будут публиковаться автоматически.

Выберите один способ, не смешивайте две настройки Source.

## Подключение бота

1. Откройте официальный @BotFather в Telegram.
2. Отправьте `/setmenubutton`.
3. Выберите @NumberGenTgBot.
4. Задайте текст кнопки: `Открыть Numberly`.
5. Отправьте реальный HTTPS-адрес из GitHub Pages.
6. Откройте чат с вашим ботом и нажмите появившуюся кнопку меню.

Приватная ссылка `chatgpt.site` предназначена для предпросмотра и требует входа в ChatGPT. Для публичного Telegram Mini App используйте опубликованный адрес GitHub Pages.

## Проверка запуска

На телефоне проверьте числа, розыгрыш, пароли, темы, работу клавиатуры, копирование и скачивание. Для проверки пароля достаточно убедиться, что он появляется и не попадает в историю; не используйте тестовый пароль в реальном аккаунте.

## Официальные инструкции

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://core.telegram.org/bots/webapps#launching-mini-apps-from-the-menu-button
