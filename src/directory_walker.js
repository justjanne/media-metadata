import path from 'path';
import {promises as fsPromises} from 'fs';
import parseMediaInfo from "./util/video-mime";

class FileManager {
    basePath;

    moviesPath;
    showsPath;

    constructor(basePath) {
        this.basePath = basePath;
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
                .map(dir => dir.name)
            );
    }

    async listShows() {
        return fsPromises
            .readdir(this.showsPath, {withFileTypes: true})
            .then(result => result
                .filter(dir => dir.isDirectory())
                .map(dir => dir.name)
            );
    }

    async findMedia(base) {
        const files = await fsPromises
            .readdir(base, {withFileTypes: true})
            .then(result => result
                .filter(dir => dir.isFile())
                .map(dir => dir.name)
            );

        const dashManifest = files.find(fileName => fileName.endsWith(".mpd"))

        const subtitleBase = path.join(base, "subtitles");
        const subtitleFiles = (await fsPromises
            .readdir(subtitleBase, {withFileTypes: true})
            .then(result => result
                .filter(dir => dir.isFile())
                .map(dir => dir.name)
            ).catch(err => {
                // Do nothing, just means file does not exist
            })) || [];
        const subtitles = subtitleFiles.filter(fileName =>
            fileName.endsWith(".srt") ||
            fileName.endsWith(".ttml") ||
            fileName.endsWith(".ass") ||
            fileName.endsWith(".vtt")
        )

        const mediaFiles = dashManifest ? [] : files.filter(fileName =>
            fileName.endsWith(".mp4") ||
            fileName.endsWith(".webm") ||
            fileName.endsWith(".ogg")
        )

        return {
            subtitles: subtitles.map(name => {
                const {language, region, specifier, format} = /^(?<language>\p{L}+)(?:-(?<region>\p{L}+))?(?:\.(?<specifier>.+))?\.(?<format>[^.]+)$/u.exec(name).groups;
                return {
                    language: language,
                    region: region,
                    specifier: specifier,
                    format: format,
                    src: path.join("subtitles", name)
                }
            }),
            media: dashManifest ? [{
                src: dashManifest,
                container: "application/xml+dash"
            }] : await Promise.all(mediaFiles.map(fileName => parseMediaInfo(path.join(base, fileName)).then(metadata => {
                return {
                    src: fileName,
                    ...metadata
                }
            })))
        }
    }
}

export default FileManager;