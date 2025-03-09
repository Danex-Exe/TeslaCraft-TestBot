const mineflayer = require('mineflayer');
const fs = require('fs');
const { google } = require('googleapis');

// Конфигурация Google Sheets
const SPREADSHEET_ID = 'Айди_таблицы';
const RANGE = 'Sheet1!A:E';

// Асинхронная инициализация
async function initialize() {
    try {
        // Проверка и создание data.json
        await checkConfigFile();
        
        // Загрузка конфигурации
        const config = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        
        // Запуск бота
        startBot(config);
    } catch (err) {
        console.error('Ошибка инициализации:', err);
        process.exit(1);
    }
}

function checkConfigFile() {
    return new Promise((resolve, reject) => {
        fs.open("data.json", "r", (err, fileHandle) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    const defaultData = {
                        "nickname": "",
                        "password": "",
                        "pin": "",
                        "admin": ""
                    };
                    
                    fs.writeFile("data.json", JSON.stringify(defaultData, null, 2), (writeErr) => {
                        if (writeErr) return reject(writeErr);
                        console.log('Файл data.json создан. Заполните его и перезапустите программу.');
                        process.exit(0);
                    });
                } else {
                    reject(err);
                }
            } else {
                fs.close(fileHandle, (closeErr) => {
                    if (closeErr) console.error('Ошибка закрытия файла:', closeErr);
                    resolve();
                });
            }
        });
    });
}

function startBot(config) {
    // Инициализация Google Sheets API
    let sheetLink;
    
    async function authorize() {
        const auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        return auth.getClient();
    }

    async function appendToSheet(values) {
        const auth = await authorize();
        const sheets = google.sheets({ version: 'v4', auth });
        
        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [values] }
        };
        
        return sheets.spreadsheets.values.append(request);
    }

    async function getSheetUrl() {
        const auth = await authorize();
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'spreadsheetUrl'
        });
        return res.data.spreadsheetUrl;
    }

    // Инициализация бота
    const bot = mineflayer.createBot({
        host: "play.teslacraft.org",
        username: config.nickname,
        password: config.password
    });

    // Обработчики команд
    bot.on('message', async (jsonMsg) => {
        const msg = jsonMsg.toString();
        console.log('[MESSAGE]', msg);

        // Обработка системных сообщений
        if (msg.includes('лимбо')) {
            console.log('[BOT] Возвращаемся в лобби...');
            bot.chat('/hub');
        }
        else if (msg === 'Нужно авторизоваться. Напишите в чат Ваш пароль') {
            bot.chat(config.password);
        }
        else if (msg === 'Напишите в чат Ваш пин-пароль (5 цифр)') {
            bot.chat(config.pin);
        }
        if (msg.split(' ')[0] == '[Новогодний' && msg.split(' ')[1] == 'кейс]') {
            let nick = msg.split(' ')[2]
            let hat = msg.split(' ').slice(4).join(' ').replace('!', '')

            try {
                await appendToSheet([
                    new Date().toLocaleString(),
                    nick,
                    hat,  // Предмет
                    1,  // Количество
                    '?'   // Цена
                ]);
            } catch (err) {
                console.error('[SHEETS ERROR]', err);
            }
        }

        // Обработка приватных сообщений
        const pmMatch = msg.match(/\[([^\]]+)\s->\s[^\]]+\]\s\/(\w+)(?:\s(.*))?/);
        if (pmMatch) {
            const [_, author, command, args] = pmMatch;
            console.log(`[COMMAND] ${author} использовал: /${command} ${args || ''}`);

            switch (command.toLowerCase()) {
                case 'help':
                    bot.chat(`/m ${author} Доступные команды: /list - получить ссылку на таблицу, /ad <предмет> = <количество> = <цена> - добавить объявление`);
                    break;

                case 'list':
                    try {
                        if (!sheetLink) sheetLink = await getSheetUrl();
                        bot.chat(`/m ${author} Таблица объявлений: ${sheetLink}`);
                        console.log(sheetLink)
                    } catch (err) {
                        console.error('[SHEETS ERROR]', err);
                        bot.chat(`/m ${author} Ошибка получения таблицы!`);
                    }
                    break;

                case 'ad':
                    if (!args) {
                        bot.chat(`/m ${author} Формат: /ad Предмет = Количество = Цена`);
                        return;
                    }
                    
                    const parts = args.split('=').map(p => p.trim());
                    if (parts.length !== 3) {
                        bot.chat(`/m ${author} Неверный формат! Нужно: Предмет = Количество = Цена`);
                        return;
                    }

                    try {
                        await appendToSheet([
                            new Date().toLocaleString(),
                            author,
                            parts[0],  // Предмет
                            parts[1],  // Количество
                            parts[2]   // Цена
                        ]);
                        bot.chat(`/m ${author} Объявление добавлено!`);
                    } catch (err) {
                        console.error('[SHEETS ERROR]', err);
                        bot.chat(`/m ${author} Ошибка добавления объявления!`);
                    }
                    break;

                case 'test':
                    if (config.admin.includes(author)) {
                        bot.chat(`/m ${author} Тестовая команда выполнена!`);
                    } else {
                        bot.chat(`/m ${author} У вас нет прав!`);
                    }
                    break;
            }
        }
    });

    // Обработчики событий бота
    bot.on('login', () => console.log('[BOT] Успешный вход!'));
    bot.on('kicked', reason => console.log('[BOT] Кикнут:', reason));
    bot.on('error', err => console.error('[BOT] Ошибка:', err));
}

// Запуск приложения
initialize();
