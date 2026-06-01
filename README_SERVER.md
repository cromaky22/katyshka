Локальный сервер для хранения данных пользователей (Express + SQLite).

Запуск локально:

1) Установите зависимости:

```bash
npm install
```

2) Запустите сервер:

```bash
npm start
```

Сервер откроет сайт и API на `http://localhost:3000`.

API:
- `POST /api/users` — сохранить/обновить пользователя (JSON с полями `id`, `first_name`, `last_name`, `username`, `avatar`)
- `GET /api/users/:id` — получить данные пользователя

Примечание: для продакшена требуется валидация и проверка подписи Telegram initData.
