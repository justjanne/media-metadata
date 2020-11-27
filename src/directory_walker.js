import path from 'path';
import {promises as fsPromises} from 'fs';
import encodePath from "./util/encode-path";

class FileManager {
    basePath;
    videoMimeParser;

    moviesPath;
    showsPath;

    constructor(basePath, videoMimeParser) {
        this.basePath = basePath;
        this.videoMimeParser = videoMimeParser;
    }

    async updateConfiguration() {
        this.moviesPath = await this.findPath(this.basePath, "movies");
        this.showsPath = await this.findPath(this.basePath, "shows");
    }

    async findPath(base, name) {
        const children = await fsPromises.readdir(base);
        const result = children.find(child => {
            return child.localeCompare(name, "en", {
                sensitivity: "base", usage: "search", ignorePunctuation: true
            }) === 0
        })
        return result ? path.join(base, result) : null;
    }

    async listMovies() {
        return fsPromises
            .readdir(this.moviesPath, {withFileTypes: true})
            .then(result => result
                .filter(dir => dir.isDirectory())
                .map(dir => {
                    return path.join(this.moviesPath, dir.name)
                })
            );
    }

    async listShows() {
        return fsPromises
            .readdir(this.showsPath, {withFileTypes: true})
            .then(result => result
                .filter(dir => dir.isDirectory())
                .map(dir => {
                    return path.join(this.showsPath, dir.name)
                })
            );
    }

    async listEpisodes(showPath) {
        const files = await fsPromises
            .readdir(showPath, {withFileTypes: true});
        const dirs = files.filter(it => {
            return it.isDirectory();
        });
        const matched = dirs.map(it => {
            return {
                name: it.name,
                match: /^(?:(?:(?<year>\d+)-(?<month>\d+)-(?<day>\d+))|(?:(?:S(?<season>\d+(?:[.\-–—&]\d+)?))?\p{L}*[\t\f ]*(?<episode>\d+(?:[.\-–—&]\d+)?)))(?:(?:[\t\f ]+(?:[\-–—:][\t\f ]*)?)(?<title>\S.*))?$/u.exec(it.name)?.groups
            };
        }).filter(it => it.match !== undefined);
        const mapped = matched.map(it => {
            const {season, episode, year, month, day} = it.match
            return {
                filePath: path.join(showPath, it.name),
                src: encodePath(path.relative(this.basePath, path.join(showPath, it.name))),
                episodeIdentifier: {
                    season: season,
                    episode: episode,
                    year: year,
                    month: month,
                    day: day,
                },
            }
        });
        return mapped;
    }

    async findIds(filePath) {
        return await fsPromises
            .readFile(path.join(filePath, "ids.json"))
            .then(result => {
                if (!result) return null;
                return JSON.parse(result);
            }).catch(_ => null);
    }

    async findMedia(base) {
        const files = await fsPromises
            .readdir(base, {withFileTypes: true})
            .then(result => result
                .filter(dir => !dir.isDirectory())
                .map(dir => dir.name)
            );

        const dashManifest = files.find(fileName => fileName.endsWith(".mpd"))

        const subtitleBase = path.join(base, "subtitles");
        const subtitleFiles = (await fsPromises
                .readdir(subtitleBase, {withFileTypes: true})
                .then(result => result
                    .filter(dir => dir.isFile())
                    .map(dir => dir.name)
                ).catch(_ => null)) // Do nothing, just means file does not exist
            || [];
        const subtitles = subtitleFiles.filter(fileName =>
            fileName.endsWith(".srt") ||
            fileName.endsWith(".ttml") ||
            fileName.endsWith(".ass") ||
            fileName.endsWith(".vtt")
        )

        const previewFilePath = path.join(base, "spritesheets", "preview.vtt");
        const previewFileExists = (await fsPromises.stat(previewFilePath).catch(() => null))?.isFile() === true;
        const previewFile = previewFileExists ? previewFilePath : null;

        const mediaFiles = dashManifest ? [dashManifest] : files.filter(fileName =>
            fileName.endsWith(".mp4") ||
            fileName.endsWith(".webm") ||
            fileName.endsWith(".ogg")
        )

        const media = await Promise.all(mediaFiles.map(fileName => this.videoMimeParser.parseMediaInfo(path.join(base, fileName)).then(metadata => {
            return {
                src: encodePath(path.relative(this.basePath, path.join(base, fileName))),
                ...metadata
            }
        })));

        return {
            subtitles: subtitles.map(name => {
                const {language, region, specifier, format} = /^(?<language>\p{L}+)(?:-(?<region>\p{L}+))?(?:\.(?<specifier>.+))?\.(?<format>[^.]+)$/u.exec(name).groups;
                return {
                    language: language,
                    region: region,
                    specifier: specifier,
                    format: format,
                    src: encodePath(path.relative(this.basePath, path.join(base, "subtitles", name)))
                }
            }),
            preview: previewFile !== null ? encodePath(path.relative(this.basePath, previewFile)) : null,
            media
        }
    }
}

export default FileManager;
