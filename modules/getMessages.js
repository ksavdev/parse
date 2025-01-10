// modules/getMessages.js
import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const TOPIC_PAGES_JSON_PATH = './data/topicPages.json';
const MESSAGES_JSON_PATH = './data/messages.json';
const FORUM_BASE_URL = 'https://forum.onliner.by';

// Функция для получения случайного User-Agent
function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/112.0',
        // Добавьте больше User-Agent по необходимости
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Функция для случайных задержек
function randomDelay(min = 1000, max = 3000) {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function getMessages() {
    // 1. Проверяем наличие файла topicPages.json
    if (!await fs.pathExists(TOPIC_PAGES_JSON_PATH)) {
        throw new Error(`Файл ${TOPIC_PAGES_JSON_PATH} не найден. Сначала выполните парсинг страниц подтем.`);
    }

    // 2. Читаем topicPages.json
    const topicPages = await fs.readJson(TOPIC_PAGES_JSON_PATH);
    console.log(`Найдено ${Object.keys(topicPages).length} подтем для парсинга сообщений.`);

    const messages = {};

    // 3. Удаляем старый messages.json, если он существует
    if (await fs.pathExists(MESSAGES_JSON_PATH)) {
        await fs.remove(MESSAGES_JSON_PATH);
        console.log(`Старый файл ${MESSAGES_JSON_PATH} удалён.`);
    }

    // 4. Определение Прокси (если требуется)
    const proxy = 'http://your-proxy-server:port'; // Замените на ваш прокси или оставьте пустым

    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // `--proxy-server=${proxy}` // Раскомментируйте и настройте при необходимости
        ]
    };

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // 5. Устанавливаем случайный User-Agent
    let randomUserAgent = getRandomUserAgent();
    await page.setUserAgent(randomUserAgent);
    console.log(`Используем User-Agent: ${randomUserAgent}`);

    // 6. Оптимизация: отключаем загрузку ненужных ресурсов
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
            req.abort();
        } else {
            req.continue();
        }
    });

    // 7. Обработка каждой подтемы
    const topicEntries = Object.entries(topicPages);
    for (const [topicLink, pageLinks] of topicEntries) {
        try {
            console.log(`Парсинг сообщений для подтемы: ${topicLink}`);
            messages[topicLink] = [];

            for (const [pageIndex, pageLink] of pageLinks.entries()) {
                try {
                    console.log(`Парсинг страницы ${pageIndex + 1}/${pageLinks.length}: ${pageLink}`);

                    // Перед переходом устанавливаем новый случайный User-Agent
                    randomUserAgent = getRandomUserAgent();
                    await page.setUserAgent(randomUserAgent);
                    console.log(`Обновлён User-Agent для страницы: ${randomUserAgent}`);

                    await page.goto(pageLink, { waitUntil: 'networkidle2' });

                    // Прокрутка страницы вниз для имитации человеческого поведения
                    await page.evaluate(() => {
                        window.scrollBy(0, window.innerHeight);
                    });

                    // Дополнительная задержка после прокрутки
                    await randomDelay(500, 1500);

                    // Извлечение сообщений из <ul class="b-messages-thread">
                    const pageMessages = await page.evaluate(() => {
                        const messageList = [];
                        const threads = document.querySelectorAll('ul.b-messages-thread > li.msgpost');

                        threads.forEach(msg => {
                            // ID сообщения
                            const message_id = msg.getAttribute('id') || '';

                            // Автор
                            const authorElement = msg.querySelector('.b-mtauthor .mtauthor-nickname a._name');
                            const author_name = authorElement ? authorElement.textContent.trim() : 'Неизвестный';
                            const author_id = msg.querySelector('.b-mtauthor')?.getAttribute('data-user_id') || '';

                            // Авторские титулы
                            const author_titles = [];
                            const titleElements = msg.querySelectorAll('.b-mtauthor .sts-prof');
                            titleElements.forEach(el => {
                                author_titles.push(el.textContent.trim());
                            });
                            const author_title = author_titles.join(', ');

                            // Аватар
                            const avatar_url = msg.querySelector('.b-mtauthor .ava-box img')?.getAttribute('src') || '';

                            // Количество сообщений автора
                            const posts_count = msg.querySelector('.b-mtauthor .msg')?.textContent.trim() || '0';

                            // Регистрационный возраст и номер пользователя
                            const registration_info = msg.querySelector('.b-mtauthor .mta-card-txt > p')?.textContent.trim() || '';
                            const user_number = msg.querySelector('.b-mtauthor .mta-card-txt > p:nth-child(2)')?.textContent.trim() || '';

                            // Статус пользователя
                            const status = msg.querySelector('.b-mta-card .user-status')?.textContent.trim() || '';

                            // Дата сообщения
                            const message_date = msg.querySelector('.b-msgpost-txt .msgpost-date span[title]')?.getAttribute('title') || '';

                            // Содержание сообщения
                            const message_content = msg.querySelector('.b-msgpost-txt .content')?.innerHTML.trim() || '';

                            // Ссылка на профиль
                            const profile_url = msg.querySelector('.b-mta-profile')?.getAttribute('href') || '';

                            // Ссылка на сообщение
                            const message_url = msg.querySelector('.b-forum-social-btns')?.getAttribute('data-url') || '';

                            messageList.push({
                                message_id,
                                author_id,
                                author_name,
                                author_title,
                                avatar_url,
                                posts_count,
                                registration_info,
                                user_number,
                                status,
                                message_date,
                                message_content,
                                profile_url: profile_url.startsWith('http') ? profile_url : `https://forum.onliner.by/${profile_url}`,
                                message_url: message_url.startsWith('http') ? message_url : `https://forum.onliner.by/${message_url}`
                            });
                        });

                        return messageList;
                    });

                    // Добавляем извлечённые сообщения в общий список
                    messages[topicLink].push(...pageMessages);

                    // Случайная задержка между запросами (1-3 секунды)
                    await randomDelay(1000, 3000);

                } catch (pageError) {
                    console.error(`Ошибка при парсинге страницы ${pageLink}:`, pageError);
                    // Можно продолжить с следующей страницей
                }
            }

            // После парсинга всех страниц подтемы, можно сохранить промежуточные данные
            await fs.outputJson(MESSAGES_JSON_PATH, messages, { spaces: 2 });
            console.log(`Сообщения для подтемы ${topicLink} сохранены.`);

        } catch (topicError) {
            console.error(`Ошибка при парсинге подтемы ${topicLink}:`, topicError);
            // Можно продолжить с следующей подтемой
        }
    }

    await browser.close();

    // 8. Финальное сохранение всех сообщений
    await fs.outputJson(MESSAGES_JSON_PATH, messages, { spaces: 2 });
    console.log(`Все собранные сообщения сохранены в ${MESSAGES_JSON_PATH}`);
}

export default getMessages;
