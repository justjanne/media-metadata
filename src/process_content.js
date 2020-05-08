import path from "path";
import {promises as fsPromises} from "fs";

async function processContent(basePath, fileManager, loader) {
    async function processMovie(filePath) {
        const {name, year} = /^(?<name>.+) \((?<year>\d+)\)$/.exec(path.basename(filePath)).groups;

        const ids = (await fileManager.findIds(filePath)) || (await loader.identifyMovie(name, year));
        if (!ids) {
            console.error(`Could not identify movie ${name} (${year}) at ${filePath}`)
            return;
        }
        const [media, {title, images}] = await Promise.all([
            fileManager.findMedia(filePath),
            loader.loadMetadata(ids),
        ]);
        const imageData = await loader.processImages(basePath, filePath, images);
        await loader.processImageMetadata(title, imageData);
await loader.processMediaMetadata(title, media);

        await fsPromises.writeFile(path.join(filePath, "ids.json"), JSON.stringify(ids, null, 2));
    }

    async function processEpisode(showIds, episodeIdentifier, filePath) {
        const [media, {title, images}] = await Promise.all([
            fileManager.findMedia(filePath),
            loader.loadEpisodeMetadata(showIds, episodeIdentifier),
        ]);
        const imageData = await loader.processImages(basePath, filePath, images);
        await loader.processImageMetadata(title, imageData);
        await loader.processMediaMetadata(title, media);
    }

    async function processShow(filePath) {
        const {name, year} = /^(?<name>.+) \((?<year>\d+)\)$/.exec(path.basename(filePath)).groups;
        const ids = (await fileManager.findIds(filePath)) || (await loader.identifyShow(name, year));
        if (!ids) {
            console.error(`Could not identify show ${name} (${year}) at ${filePath}`)
            return;
        }
        const episodes = await fileManager.listEpisodes(filePath);

        const {title, images} = await loader.loadMetadata(ids);
        const imageData = await loader.processImages(basePath, filePath, images);
        await loader.processImageMetadata(title, imageData);
        await Promise.all([
            ...episodes.map(async ({episodeIdentifier, filePath}) => await processEpisode(ids, episodeIdentifier, filePath).catch(err => {
                console.error(`Error processing episode ${JSON.stringify(episodeIdentifier)} of show ${JSON.stringify(ids)}: `, err);
            })),
            fsPromises.writeFile(path.join(filePath, "ids.json"), JSON.stringify(ids, null, 2)),
        ]);
    }

    const [movies, shows] = await Promise.all([fileManager.listMovies(), fileManager.listShows()]);
    await Promise.all([
        ...movies.map(processMovie),
        ...shows.map(processShow)
    ]);
}

export default processContent;