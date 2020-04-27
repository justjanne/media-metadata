// FIXME: Implement all this over to the metadata loader, and clean it up meanwhile

async function identifyMovie(api, imdb, tvdb, title, year) {
    const results = await api.request(`search/movie`, {
        query: title,
        primary_release_year: year
    }).catch((e) => console.error(e));

    const result = results.results.sort((a, b) => {
        return b.popularity - a.popularity;
    })[0];

    return result ? {
        tmdb: result.id
    } : null;
}

async function identifyShow(tmdbApi, imdbApi, tvdbApi, title, showYear) {
    const imdbId = await utils.promisify(imdbApi, "get", idQuery, {1: "tvSeries", 2: title, 3: title, 4: showYear})
        .then((data) => data.tconst);

    const tvdbResults = await tvdbApi.getSeriesByImdbId(imdbId).catch((e) => console.error(e));
    const tvdbResult = tvdbResults[0];

    if (!tvdbResult) return null;

    const tmdbResults = await tmdbApi.request(`find/${imdbId}`, {
        "external_source": "imdb_id",
    }).catch((e) => console.error(e));

    const tmdbResult = tmdbResults.tv_results.sort((a, b) => {
        return b.popularity - a.popularity;
    })[0];

    if (!tmdbResult) return null;

    return {
        imdb: imdbId,
        tvdb: tvdbResult.id,
        tmdb: tmdbResult.id,
    };
}

function downloadImage(url, filePath) {
    return new Promise(((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(() => {
                    resolve();
                });
            });
        }).on('error', function (err) {
            fs.unlink(filePath);
            reject(err);
        });
    }));
}

async function processSubtitles(filePath) {
    const subtitlesPath = path.join(filePath, 'subtitles');
    let subtitles;
    if (fs.existsSync(subtitlesPath)) {
        const files = await fs.promises.readdir(subtitlesPath);
        subtitles = files.map((filename) => {
            const match = /^(?<language>.+)(?<specifier>-.+)?\.(?<type>.*)$/.exec(path.basename(filename));
            if (match) {
                const {language, specifier, type} = match.groups;
                return {
                    language: language,
                    specifier: specifier,
                    type: type,
                }
            } else {
                return null;
            }
        }).filter(el => el);
    }
    return subtitles;
}

async function processFile(isShow, tmdbApi, fanartApi, imdb, tvdbApi, uuid, filePath) {
    const {name, year} = /^(?<name>.+) \((?<year>\d+)\)$/.exec(path.basename(filePath)).groups;

    const identifyFunction = isShow ? identifyShow : identifyMovie;
    const ids = await identifyFunction(tmdbApi, imdb, tvdbApi, name, year);
    if (ids === null) {
        console.error(`No item in TMDB found for "${name}" from year "${year}" at path "${filePath}"`);
        return
    }

    function processImage(type, imageUrl) {
        const ending = path.extname(imageUrl);
        return downloadImage(imageUrl, path.join(filePath, `metadata/${type}${ending}`));
    }

    data.data.subtitles = processSubtitles(filePath);
    data.data.hasLogo = !!hdMovieLogo;
    data.data.src = path.join("/api/", isShow ? "Shows" : "Movies", encodeURIComponent(path.basename(filePath)));

    // Write metadata
    await utils.promisify(fs, "writeFile", path.join(filePath, "metadata.json"), JSON.stringify(data.data));

    // Creating metadata folder
    if (!fs.existsSync(path.join(filePath, 'metadata'))) {
        await fs.promises.mkdir(path.join(filePath, 'metadata'));
    }

    // Writing images
    await Promise.all([
        poster ? processImage("poster", tmdbApi.getImageUrl(poster.file_path)) : null,
        backdrop ? processImage("backdrop", tmdbApi.getImageUrl(backdrop.file_path)) : null,
        hdMovieLogo ? processImage("logo", hdMovieLogo.url) : null,
    ].filter(el => el));
}