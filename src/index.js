import process from 'process';

import path from 'path';

import ImdbApi from './api/imdb_api';
import TmdbApi from './api/tmdb_api';
import TvdbApi from 'node-tvdb';
import FanartApi from './api/fanart_api';

import MetadataLoader from "./metadata_loader";
import FileManager from "./directory_walker";
import parseMediaInfo from "./util/video-mime";

async function main() {
    const args = process.argv.slice(2);
    const basePath = args[0];

    const imdbApi = new ImdbApi(process.env.IMDB_PATH);
    const tmdbApi = new TmdbApi(process.env.TMDB_API_KEY);
    await tmdbApi.updateConfiguration();
    const tvdbApi = new TvdbApi(process.env.TVDB_API_KEY);
    const fanartApi = new FanartApi(process.env.FANART_API_KEY);

    const loader = new MetadataLoader(imdbApi, tmdbApi, tvdbApi, fanartApi);
    const fileManager = new FileManager(basePath);
    await fileManager.updateConfiguration();

    console.log(JSON.stringify(
        await fileManager.findMedia(path.join(fileManager.moviesPath, "Avengers: Endgame (2019)")),
        null, 2
    ));
    console.log(JSON.stringify(
        await fileManager.findMedia(path.join(fileManager.showsPath, "Steins;Gate (2011)", "S01E01")),
        null, 2
    ));
    console.log(JSON.stringify(
        await parseMediaInfo(path.join(fileManager.showsPath, "Steins;Gate (2011)", "S01E01", "1080-fragment.mp4")),
        null, 2
    ));

    /*
    let directoryPath = args[0];
    if (directoryPath) {
        const showsPath = path.join(directoryPath, "Shows");
        const moviesPath = path.join(directoryPath, "Movies");

        if (fs.existsSync(showsPath)) {
            const shows = await fs.promises.readdir(showsPath);
            for (let fileName of shows) {
                const filePath = path.join(showsPath, fileName);
                try {
                    console.log("Processing show ", filePath);
                    loader.processFile(true, tmdbApi, fanartApi, imdb, tvdbApi, uuid.v4(), filePath);
                } catch (e) {
                    console.error(e);
                }
            }
        }
        if (fs.existsSync(moviesPath)) {
            const movies = await fs.promises.readdir(moviesPath);
            for (let fileName of movies) {
                const filePath = path.join(moviesPath, fileName);
                try {
                    console.log("Processing movie ", filePath);
                    loader.processFile(false, tmdbApi, fanartApi, imdb, tvdbApi, uuid.v4(), filePath);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }
     */
}

(async function () {
    await main()
}());