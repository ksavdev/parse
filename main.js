import getPageLinks from './modules/getPageLinks.js';
import parseTopics from './modules/parseTopics.js';
import getTopicPages from './modules/getTopicPages.js';
import getMessages from './modules/getMessages.js';
import chalk from 'chalk'; // Импортируем библиотеку chalk

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

async function main() {
    console.log(chalk.blueBright(`[${new Date().toISOString()}] >>> Программа запущена.`));
    const startTime = Date.now();

    const intervalId = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const formattedTime = formatTime(elapsedTime);
        console.log(chalk.green(`[${new Date().toISOString()}] >>> Прошло времени с запуска: ${formattedTime}`));
    }, 600000); // Каждые 10 минут

    try {
        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Начинаем сбор ссылок на страницы форума.`));
        const pageLinks = await getPageLinks();
        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Ссылки на страницы собраны: ${pageLinks.length} ссылок.`));

        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Начинаем парсинг тем.`));
        const topics = await parseTopics();
        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Темы форума спарсены: ${topics.length} тем.`));

        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Начинаем получение страниц тем.`));
        const topicPages = await getTopicPages();
        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Страницы тем собраны: ${Object.keys(topicPages).length} тем, ${Object.values(topicPages).flat().length} страниц.`));

        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Начинаем сбор сообщений.`));
        const messages = await getMessages();
        console.log(chalk.yellow(`[${new Date().toISOString()}] >>> Сообщения собраны: ${Object.keys(messages).length} тем, всего ${Object.values(messages).flat(2).length} сообщений.`));

        console.log(chalk.blueBright(`[${new Date().toISOString()}] >>> Все этапы программы успешно завершены.`));
    } catch (error) {
        console.error(chalk.red(`[${new Date().toISOString()}] >>> Произошла ошибка во время выполнения:`, error));
    } finally {
        clearInterval(intervalId);
        const totalTime = formatTime(Date.now() - startTime);
        console.log(chalk.blueBright(`[${new Date().toISOString()}] >>> Программа завершена. Общее время выполнения: ${totalTime}`));
    }
}

main();
