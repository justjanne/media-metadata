import process from 'process';
import sequelize from "sequelize";

import ImdbApi from './api/imdb_api';
import TmdbApi from './api/tmdb_api';
import TvdbApi from 'node-tvdb';
import FanartApi from './api/fanart_api';

import MetadataLoader from "./metadata_loader";
import FileManager from "./directory_walker";
import VideoMimeParser from "./util/video-mime";

import Backend from "./storage";
import processContent from "./process_content";
import {Genre} from "./model";

async function main() {
    console.info("Processing arguments");
    const args = process.argv.slice(2);
    const basePath = args[0];

    console.info("Setting up API clients");
    const imdbApi = new ImdbApi(process.env.IMDB_PATH);
    const tmdbApi = new TmdbApi(process.env.TMDB_API_KEY);
    await tmdbApi.updateConfiguration();
    const tvdbApi = new TvdbApi(process.env.TVDB_API_KEY);
    const fanartApi = new FanartApi(process.env.FANART_API_KEY);

    console.info("Setting up backend");
    const storage = new Backend(new sequelize.Sequelize(
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        {
            dialect: "postgres",
            host: process.env.DB_HOST,
            port: +process.env.DB_PORT,
            ssl: !!process.env.DB_SSL,
        }
    ));
    console.info("Migrating backend database");
    console.log(await Genre.sync());
    await storage.sync();

    console.info("Setting up media ingestion tools");
    const videoMimeParser = new VideoMimeParser(process.env.MP4INFO_PATH || "mp4info", process.env.FFPROBE_PATH || "ffprobe");
    const loader = new MetadataLoader(imdbApi, tmdbApi, tvdbApi, fanartApi, storage);
    const fileManager = new FileManager(basePath, videoMimeParser);
    await fileManager.updateConfiguration();

    console.info("Processing content");
    await processContent(basePath, fileManager, loader);
}

(async function () {
    await main()
}());
