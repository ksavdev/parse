import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const TOPIC_PAGES_JSON_PATH = './data/topicPages.json';
const MESSAGES_JSON_PATH = './data/messages.json';

async function getMessages() {
    if (!await fs.pathExists(TOPIC_PAGES_JSON_PATH)) {
        throw new Error(`Файл ${TOPIC_PAGES_JSON_PATH} не найден.`);
    }

    const topicPages = await fs.readJson(TOPIC_PAGES_JSON_PATH);
    console.log(`Найдено ${Object.keys(topicPages).length} подтем для парсинга сообщений.`);

    let existingMessages = {};
    if (await fs.pathExists(MESSAGES_JSON_PATH)) {
        existingMessages = await fs.readJson(MESSAGES_JSON_PATH);
        console.log(`Найдено ${Object.keys(existingMessages).length} уже собранных сообщений.`);
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
            req.abort();
        } else {
            req.continue();
        }
    });

    for (const [topicLink, pageLinks] of Object.entries(topicPages)) {
        if (existingMessages[topicLink]) {
            console.log(`Пропускаем уже собранные сообщения для подтемы: ${topicLink}`);
            continue;
        }

        existingMessages[topicLink] = [];

        for (const pageLink of pageLinks) {
            try {
                console.log(`Парсинг страницы ${pageLink}`);
                await page.goto(pageLink, { waitUntil: 'networkidle2' });

                const pageMessages = await page.evaluate(() => {
                    const messageList = [];
                    const threads = document.querySelectorAll('ul.b-messages-thread > li.msgpost');

                    threads.forEach(msg => {
                        const message_id = msg.getAttribute('id') || '';
                        const authorElement = msg.querySelector('.b-mtauthor .mtauthor-nickname a._name');
                        const author_name = authorElement ? authorElement.textContent.trim() : 'Неизвестный';
                        const message_date = msg.querySelector('.b-msgpost-txt .msgpost-date span[title]')?.getAttribute('title') || '';
                        const message_content = msg.querySelector('.b-msgpost-txt .content')?.innerHTML.trim() || '';

                        messageList.push({ message_id, author_name, message_date, message_content });
                    });

                    return messageList;
                });

                existingMessages[topicLink].push(...pageMessages);
            } catch (error) {
                console.error(`Ошибка при парсинге страницы ${pageLink}:`, error);
            }
        }
    }

    await browser.close();

    await fs.outputJson(MESSAGES_JSON_PATH, existingMessages, { spaces: 2 });
    console.log(`Собранные данные сохранены в ${MESSAGES_JSON_PATH}`);
}

export default getMessages;
