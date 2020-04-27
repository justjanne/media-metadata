import process from 'process';

import path from 'path';
import {promises as fsPromises} from 'fs';

import ImdbApi from './api/imdb_api';
import TmdbApi from './api/tmdb_api';
import TvdbApi from 'node-tvdb';
import FanartApi from './api/fanart_api';

import MetadataLoader from "./metadata_loader";
import FileManager from "./directory_walker";
import VideoMimeParser from "./util/video-mime";

async function main() {
    const args = process.argv.slice(2);
    const basePath = args[0];

    const imdbApi = new ImdbApi(process.env.IMDB_PATH);
    const tmdbApi = new TmdbApi(process.env.TMDB_API_KEY);
    await tmdbApi.updateConfiguration();
    const tvdbApi = new TvdbApi(process.env.TVDB_API_KEY);
    const fanartApi = new FanartApi(process.env.FANART_API_KEY);

    const videoMimeParser = new VideoMimeParser(process.env.MP4INFO_PATH || "mp4info", process.env.FFPROBE_PATH || "ffprobe");
    const loader = new MetadataLoader(imdbApi, tmdbApi, tvdbApi, fanartApi);
    const fileManager = new FileManager(basePath, videoMimeParser);
    await fileManager.updateConfiguration();

    async function processMovie(filePath) {
        const {name, year} = /^(?<name>.+) \((?<year>\d+)\)$/.exec(path.basename(filePath)).groups;

        const ids = (await fileManager.findIds(filePath)) || (await loader.identifyMovie(name, year));
        const [media, {metadata, images}] = await Promise.all([
            fileManager.findMedia(filePath),
            loader.loadMetadata(ids),
        ]);
        const imageData = await loader.processImages(basePath, filePath, images);

        await Promise.all([
            fsPromises.writeFile(path.join(filePath, "ids.json"), JSON.stringify(ids, null, 2)),
            fsPromises.writeFile(path.join(filePath, "metadata.json"), JSON.stringify({
                ...metadata,
                ...media,
                images: imageData.map(img => {
                    return {
                        type: img.type,
                        src: img.src,
                    }
                }),
            }, null, 2)),
        ]);
    }

    async function processEpisode(ids, episodeIdentifier, filePath) {
        const episodeIds = loader.identifyEpisode(ids, episodeIdentifier);
        const {episodeMetadata, _} = await loader.loadMetadata(episodeIds, true)

        await Promise.all([
            fsPromises.writeFile(path.join(filePath, "ids.json"), JSON.stringify(episodeIds, null, 2)),
            fsPromises.writeFile(path.join(filePath, "metadata.json"), JSON.stringify(episodeMetadata, null, 2)),
        ]);
    }

    async function processShow(filePath) {
        if (1) return;

        const {name, year} = /^(?<name>.+) \((?<year>\d+)\)$/.exec(path.basename(filePath)).groups;
        const ids = (await fileManager.findIds(filePath)) || (await loader.identifyShow(name, year));
        const episodes = fileManager.findEpisodes(filePath);

        const {metadata, rawImages} = await Promise.all([
            loader.loadMetadata(ids)
        ]);
        const images = await loader.processImages(basePath, filePath, rawImages);
        await Promise.all([
            ...episodes.map(async ({episodeIdentifier, filePath}) => await processEpisode(ids, episodeIdentifier, filePath)),
            fsPromises.writeFile(path.join(filePath, "ids.json"), JSON.stringify(ids, null, 2)),
            fsPromises.writeFile(path.join(filePath, "metadata.json"), JSON.stringify({
                ...metadata,
                episodes: episodes,
                images: images,
            }, null, 2)),
        ]);
    }

    const [movies, shows] = await Promise.all([fileManager.listMovies(), fileManager.listShows()]);
    await Promise.all([
        ...movies.map(processMovie),
        ...shows.map(processShow)
    ]);
}

(async function () {
    await main()
}());