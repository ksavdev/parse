// main.js
import getPageLinks from './modules/getPageLinks.js';
import parseTopics from './modules/parseTopics.js';
import getTopicPages from './modules/getTopicPages.js';
import getMessages from './modules/getMessages.js';

async function main() {
    try {
        await getPageLinks();
        await parseTopics();
        await getTopicPages();
        await getMessages();
        console.log('Все части программы выполнены успешно.');
    } catch (error) {
        console.error('Произошла ошибка:', error);
    }
}

main();
