# Mini Casino (мини-приложение)

Откройте `splash.html` в браузере (или `home.html`) чтобы увидеть начальный экран и главную страницу.

Файлы:
- splash.html — экран загрузки (редирект в `home.html`)
- home.html, games.html, wallet.html, bonus.html, menu.html — отдельные страницы
- css/style.css — общий стиль
- js/app.js — небольшой скрипт для редиректа и активной навигации

Далее: реализуем игровые режимы (Mincky, Bubbles, Нвути). Напишите, с какого режима начнём.

Как развернуть сайт на GitHub Pages (быстро):

1. Установите `git` и (опционально) `gh` (GitHub CLI).
2. Создайте репозиторий на GitHub вручную или через `gh`:

```bash
gh repo create <USERNAME>/<REPO> --public --source=. --remote=origin --push
```

3. Если не используете `gh`, выполните локально:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPO>.git
git push -u origin main
```

После пуша GitHub Actions в репозитории (workflow `.github/workflows/pages.yml`) автоматически соберёт и опубликует сайт на GitHub Pages. Через несколько минут сайт будет доступен по адресу `https://<USERNAME>.github.io/<REPO>/`.

Если хотите, могу добавить workflow в репозиторий сейчас — скажите "да, добавь" и я создаю файлы автоматически.
