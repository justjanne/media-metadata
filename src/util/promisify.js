function promisify(fun) {
    const args = Array.prototype.slice.call(arguments).slice(1);
    return new Promise((resolve, reject) => {
        fun(...args, function (err) {
            const args = Array.prototype.slice.call(arguments).slice(1);
            if (err) {
                reject(err);
            } else {
                resolve(args);
            }
        })
    });
}

export default promisify;