import path from 'path';

function encodePath(filePath) {
    return path.join(...filePath.split(path.sep).map(encodeURIComponent))
}

export default encodePath;