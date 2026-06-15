# Deployment на Railway с PostgreSQL

## Проблема
На Railway эфемерная файловая система - каждый редеплой удаляет все файлы. Поэтому SQLite база данных `data.sqlite` теряется при каждом перезапуске.

## Решение
Используйте PostgreSQL на Railway с переменной окружения `DATABASE_URL`.

## Как настроить на Railway

### 1. Добавьте PostgreSQL плагин
- В Railway Dashboard перейдите в свой проект
- Нажмите "+ New" -> "Database" -> "PostgreSQL"
- Railway автоматически создаст переменную окружения `DATABASE_URL`

### 2. Переменные окружения
Railway автоматически добавит:
- `DATABASE_URL` - строка подключения к PostgreSQL (вводится автоматически)
- `ADMIN_KEY` - (опционально) ваш админ ключ для API

### 3. Deploy
```bash
git push origin main
```
Railway автоматически:
- Обнаружит `package.json`
- Установит зависимости (включая `pg`)
- Запустит `npm start`
- Сервер автоматически переключится на PostgreSQL

## Локальная разработка

### Использование SQLite локально
```bash
npm install
npm start
```
Сервер создаст `data.sqlite` автоматически.

### Использование PostgreSQL локально
```bash
export DATABASE_URL="postgres://user:password@localhost:5432/katyshka"
npm start
```

## Как работает автоматическое переключение

В `server.js`:
```javascript
const usePostgres = !!process.env.DATABASE_URL;
```

- Если `DATABASE_URL` существует → используется PostgreSQL
- Если `DATABASE_URL` отсутствует → используется SQLite

## Проверка подключения

Сервер выведет при старте:
```
📊 Using PostgreSQL database
✅ PostgreSQL tables initialized
```

Или для SQLite:
```
📁 Using SQLite database (local development)
✅ SQLite tables initialized
```

## Важно

- **Не используйте** эфемерное хранилище файлов (как data.sqlite) на Railway
- Данные в PostgreSQL **сохранятся** между редеплоями
- Баланс игроков загружается из БД при запуске сервера
- Все измене вания баланса отправляются в БД через `POST /api/users`

## Миграция данных

Если у вас были данные в SQLite локально и вы хотите их перенести в PostgreSQL:

1. Экспортируйте из SQLite:
   ```bash
   sqlite3 data.sqlite ".mode json" "SELECT * FROM users;" > users_backup.json
   ```

2. Импортируйте в PostgreSQL через админ API или скрипт
