import fs from 'fs';
import path from 'path';
import https from 'https';

function downloadFile(url, filePath) {
    return new Promise(((resolve, reject) => {
        fs.mkdirSync(path.dirname(filePath), {recursive: true})
        const file = fs.createWriteStream(filePath);
        https.get(url, function (response) {
            response.pipe(file);
            file.on('close', function () {
                resolve();
            })
            file.on('finish', function () {
                file.close()
            });
        }).on('error', function (err) {
            fs.unlink(filePath, function () {
                reject(err);
            });
        });
    }));
}

export default downloadFile;