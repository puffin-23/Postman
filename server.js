const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8581;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const SAVED_REQUESTS_FILE = path.join(__dirname, 'saved-requests.json');
// Обработчик главной страницы
app.get('/', (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.sendFile(path.resolve(mainPage));
});
// Обработчик сохранения запроса
app.post('/save-config', (req, res) => {
    saveFile(req.body, (err, allData) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.json(allData); 
    });
});
// Обработчик отправки запроса
app.post('/send-request', async (req, res) => {
    const {method, url, params, body, headers} = req.body;
    let resBody;
    let resHeaders = {};

    try {
        let query = '';
        if (Object.values(params).length) {
            query = objectToQueryString(params);
        }

        const response = await fetch(url + query, {
            method: method,
            headers: headers,
            body: method === 'POST' || method === 'PUT' ? JSON.stringify(body) : undefined,
            redirect: 'manual'
        });

        // Преобразуем заголовки в обычный объект
        response.headers.forEach((value, key) => {
            resHeaders[key] = value;
        });

        // Проверяем тип контента
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('text/css')) {
            // Для CSS-файлов возвращаем как текст
            resBody = await response.text();
        } else {
            // Для других типов пробуем получить как arrayBuffer и конвертировать в base64
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            resBody = buffer.toString('base64');
        }

        console.log({
            info: {
                status: response.status,
                message: response.statusText,
            },
            headers: resHeaders,
            body: resBody.substring(0, 100) + '...' // Логируем только первые 100 символов
        });

        res.send({
            info: {
                status: response.status,
                message: response.statusText,
            },
            headers: resHeaders,
            body: resBody
        });

    } catch (e) {
        console.error('Ошибка fetch:', e);
        return res.status(500).json({ error: 'Не удалось получить данные', details: e.message });
    }
});

// Обработчик получения сохраненных запросов
app.get('/saved-requests', (req, res) => {
   fs.access(SAVED_REQUESTS_FILE, fs.constants.F_OK, (err) => {
           if (err) {
               console.log('File does not exist, returning empty array.');
               return res.json([]);
           }
           fs.readFile(SAVED_REQUESTS_FILE, 'utf8', (err, fileData) => {
               if (err) {
                   console.error('Error reading file:', err);
                   return res.status(500).json({ error: 'Failed to read saved requests' });
               }
               if (fileData) {
                   const allData = fileData.trim().split('\n').map(line => JSON.parse(line));
                   res.json(allData);
               } else {
                   res.json([]);
               }
   
           });
       });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер работает на порту 8581`);
});


// Функция сохранения данных в файл
 function saveFile(data, callback) {
     const dataString = JSON.stringify(data) + '\n';
 
     fs.appendFile(SAVED_REQUESTS_FILE, dataString, (err) => {
         if (err) {
             console.error('Error writing to file:', err);
             return callback(err);
         }
         console.log('Data has been added to file!');
 
         fs.readFile(SAVED_REQUESTS_FILE, 'utf8', (err, fileData) => {
             if (err) {
                 console.error('Error reading file:', err);
                 return callback(err);
             }

             const allData = fileData.trim().split('\n').map(line => JSON.parse(line));
             callback(null, allData);
         });
     });
 }
// Функция преобразования объекта в строку запроса
 function objectToQueryString(obj) {
    let queryString = "?";
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (queryString !== "") {
                queryString += "&";
            }
            queryString += encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]);
        }
    }
    return queryString;
}
 

