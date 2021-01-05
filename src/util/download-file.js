import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

export default function downloadFile(url, filePath) {
    return new Promise(((resolve, reject) => {
        fs.mkdirSync(path.dirname(filePath), {recursive: true})
        const file = fs.createWriteStream(filePath);
        const backend = url.startsWith("https") ? https : http;
        backend.get(url, function (response) {
            response.pipe(file);
            file.on('close', function () {
                resolve(response.headers);
            })
            file.on('finish', function () {
                file.close()
            });
        }).on('error', function (err) {
            console.error(`Downloading file failed: ${url}`, err);
            fs.unlink(filePath, function () {
                reject(err);
            });
        });
    }));
}
