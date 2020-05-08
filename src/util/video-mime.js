import {promises as fsPromises} from 'fs';
import path from 'path';
import xml2json from 'xml2json';
import {exec} from 'child_process';
import promisify from "./promisify";

class VideoMimeParser {
    mp4boxPath;
    ffprobePath;

    constructor(mp4boxPath, ffprobePath) {
        this.mp4boxPath = mp4boxPath;
        this.ffprobePath = ffprobePath;
    }

    async parseMediaInfoDash(filePath) {
        const info = xml2json.toJson(await fsPromises.readFile(filePath), {object: true});
        return {
            container: "application/dash+xml",
            tracks: info.MPD.Period.AdaptationSet.map((track, i) => {
                const representations = track.Representation instanceof Array ? track.Representation : [track.Representation];

                return {
                    id: i,
                    type: track.mimeType.substr(0, track.mimeType.indexOf('/')),
                    codecs: [...new Set(representations.map(r => r.codecs))],
                    bitrate: representations.map(r => r.bandwidth).sort()[0],
                    language: track.lang
                }
            })
        };
    }

    async parseMediaInfoWebm(filePath) {
        const [stdout] = await exec(`${this.ffprobePath} -print_format json -show_format -show_streams -bitexact -- "${filePath}"`)
        const info = JSON.parse(stdout);
        return {
            container: "video/webm",
            duration: +info.format.duration,
            tracks: info.streams.filter(track => ["audio", "video"].includes(track.codec_type.toLowerCase())).map(track => {
                return {
                    id: track.index,
                    type: track.type.toLowerCase(),
                    codecs: [
                        track.codec_name
                    ],
                    language: null,
                }
            })
        };
    }

    async parseMediaInfoMp4(filePath) {
        const [stdout] = await promisify(exec, `${this.mp4boxPath} --format json "${filePath}"`);
        const info = JSON.parse(stdout.replace(/,\s*([\]}])/g, "$1"));
        const audioTrack = info.tracks.filter(track => track.type.toLowerCase() === "audio")[0];
        const videoTrack = info.tracks.filter(track => track.type.toLowerCase() === "video")[0];
        return {
            container: "video/mp4",
            duration: +info.movie.duration,
            tracks: [audioTrack, videoTrack].map(track => {
                return {
                    id: track.id,
                    type: track.type.toLowerCase(),
                    codecs: [
                        track.sample_descriptions[0].codecs_string ||
                        track.sample_descriptions[0].coding
                    ],
                    language: track.language === "und" ? null : track.language,
                }
            })
        };
    }

    async parseMediaInfo(filePath) {
        switch (path.extname(filePath)) {
            case '.mpd':
                return await this.parseMediaInfoDash(filePath);
            case '.mp4':
            case '.mp4v':
            case '.mp4a':
            case '.mv4':
            case '.m4a':
            case '.m4b':
                return await this.parseMediaInfoMp4(filePath);
            case '.webm':
                return await this.parseMediaInfoWebm(filePath);
            default:
                console.error(`Invalid extension: ${path.extname(filePath)} for path ${filePath}`)
                return null;
        }
    }
}

export default VideoMimeParser