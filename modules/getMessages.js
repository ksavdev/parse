import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const TOPIC_PAGES_JSON_PATH = './data/topicPages.json';
const MESSAGES_JSON_PATH = './data/messages.json';

async function getMessages() {
    console.log(`[${new Date().toISOString()}] >>> Проверяем наличие файла ${TOPIC_PAGES_JSON_PATH}`);
    if (!await fs.pathExists(TOPIC_PAGES_JSON_PATH)) {
        throw new Error(`Файл ${TOPIC_PAGES_JSON_PATH} не найден.`);
    }

    const topicPages = await fs.readJson(TOPIC_PAGES_JSON_PATH);
    let existingMessages = {};
    if (await fs.pathExists(MESSAGES_JSON_PATH)) {
        console.log(`[${new Date().toISOString()}] >>> Загружаем существующие сообщения из ${MESSAGES_JSON_PATH}`);
        existingMessages = await fs.readJson(MESSAGES_JSON_PATH);
    }

    console.log(`[${new Date().toISOString()}] >>> Запуск браузера Puppeteer.`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const months = {
        'января': '01',
        'февраля': '02',
        'марта': '03',
        'апреля': '04',
        'мая': '05',
        'июня': '06',
        'июля': '07',
        'августа': '08',
        'сентября': '09',
        'октября': '10',
        'ноября': '11',
        'декабря': '12',
    };

    for (const [topicLink, pages] of Object.entries(topicPages)) {
        if (!existingMessages[topicLink]) {
            existingMessages[topicLink] = {};
        }

        console.log(`[${new Date().toISOString()}] >>> Обрабатываем тему: ${topicLink} (${pages.length} страниц).`);
        let totalMessages = 0;

        for (let i = 0; i < pages.length; i++) {
            const pageLink = pages[i];

            if (existingMessages[topicLink][pageLink]) {
                console.log(`[${new Date().toISOString()}] >>> Пропускаем уже обработанную страницу: ${pageLink}`);
                continue;
            }

            try {
                console.log(`[${new Date().toISOString()}] >>> Переход на страницу: ${pageLink}`);
                await page.goto(pageLink, { waitUntil: 'networkidle2' });

                const messages = await page.evaluate((months) => {
                    const formatDate = (rawDate) => {
                        const [day, month, year] = rawDate.split(' ');
                        return `${day.padStart(2, '0')}.${months[month]}.${year}`;
                    };

                    return Array.from(document.querySelectorAll('.msgpost')).map(el => {
                        const dateElement = el.querySelector('.msgpost-date span[title]');
                        const rawDate = dateElement?.textContent.trim();
                        const formattedDate = rawDate ? formatDate(rawDate.split(' ')[0] + ' ' + rawDate.split(' ')[1] + ' ' + rawDate.split(' ')[2]) : null;

                        return {
                            message_id: el.id,
                            author_name: el.querySelector('.mtauthor-nickname')?.textContent.trim(),
                            message_date: formattedDate,
                            message_content: el.querySelector('.content')?.innerHTML.trim(),
                        };
                    });
                }, months);

                existingMessages[topicLink][pageLink] = messages;
                totalMessages += messages.length;

                console.log(`[${new Date().toISOString()}] >>> Добавлены ${messages.length} сообщений со страницы ${i + 1}/${pages.length}.`);
                await fs.outputJson(MESSAGES_JSON_PATH, existingMessages, { spaces: 2 });
            } catch (error) {
                console.error(`[${new Date().toISOString()}] >>> Ошибка при обработке страницы ${pageLink}:`, error);
            }
        }

        console.log(`[${new Date().toISOString()}] >>> Тема завершена. Всего сообщений: ${totalMessages}.`);
    }

    console.log(`[${new Date().toISOString()}] >>> Закрытие браузера Puppeteer.`);
    await browser.close();
}

export default getMessages;
