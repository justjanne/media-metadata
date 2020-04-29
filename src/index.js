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
        if (!ids) {
            console.error(`Could not identify movie ${name} (${year}) at ${filePath}`)
            return;
        }
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

    async function processEpisode(showIds, episodeIdentifier, filePath) {
        const [media, {metadata, images}] = await Promise.all([
            fileManager.findMedia(filePath),
            loader.loadEpisodeMetadata(showIds, episodeIdentifier),
        ]);
        const imageData = await loader.processImages(basePath, filePath, images);

        await Promise.all([
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

    async function processShow(filePath) {
        const {name, year} = /^(?<name>.+) \((?<year>\d+)\)$/.exec(path.basename(filePath)).groups;
        const ids = (await fileManager.findIds(filePath)) || (await loader.identifyShow(name, year));
        if (!ids) {
            console.error(`Could not identify show ${name} (${year}) at ${filePath}`)
            return;
        }
        const episodes = await fileManager.listEpisodes(filePath);

        const {metadata, images} = await loader.loadMetadata(ids);
        const imageData = await loader.processImages(basePath, filePath, images);
        await Promise.all([
            ...episodes.map(async ({episodeIdentifier, filePath}) => await processEpisode(ids, episodeIdentifier, filePath).catch(err => {
                console.error(`Error processing episode ${JSON.stringify(episodeIdentifier)} of show ${JSON.stringify(ids)}: `, err);
            })),
            fsPromises.writeFile(path.join(filePath, "ids.json"), JSON.stringify(ids, null, 2)),
            fsPromises.writeFile(path.join(filePath, "metadata.json"), JSON.stringify({
                ...metadata,
                episodes: episodes.map(episode => {
                    return {
                        src: episode.src,
                        episodeIdentifier: episode.episodeIdentifier,
                    }
                }),
                images: imageData,
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