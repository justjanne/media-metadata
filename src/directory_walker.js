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
                    return path.join(this.moviesPath, dir.name)
                })
            );
    }

    async findIds(filePath) {
        return await fsPromises
            .readFile(path.join(filePath, "metadata.json"))
            .then(result => {
                if (!result) return null;
                const json = JSON.parse(result)
                if (!json) return null;
                return json.ids
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
            media: media
        }
    }
}

export default FileManager;