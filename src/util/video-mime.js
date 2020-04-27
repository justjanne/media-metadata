import fs from 'fs';
import path from 'path';
import {exec} from "child_process";
import MP4Box from 'mp4box';
import promisify from "./promisify";

async function parseMediaInfoWebm(filePath) {
    const [stdout] = await promisify(exec, `ffprobe -print_format json -show_format -show_streams -bitexact "${filePath}"`);
    return JSON.parse(stdout);
}

function processMediaInfoWebm(info) {
    console.log(JSON.stringify(info, null, 2));
    return {
        container: "video/webm",
        tracks: {
            video: info.streams.filter(track => track.codec_type === "video").map(track => {
                return {
                    // FIXME: this is broken thanks to ffmpeg
                    codec: `${track.codec_name}.${track.profile}.${track.level}.`
                }
            }),
            audio: info.streams.filter(track => track.codec_type === "audio").map(track => {
                return {

                }
            })
        }
    };
}

function parseMediaInfoMp4(filePath) {
    return new Promise((resolve, reject) => {
        const mp4boxfile = MP4Box.createFile(); /* eslint-disable-line new-cap */
        const stream = fs.createReadStream(filePath);

        mp4boxfile.onReady = (info) => {
            resolve(info);
            stream.close();
        };

        mp4boxfile.onError = err => stream.destroy(err);

        let offset = 0;
        stream.on('data', function (chunk) {
            var arrayBuffer = new Uint8Array(chunk).buffer;
            arrayBuffer.fileStart = offset;
            offset += chunk.byteLength;
            mp4boxfile.appendBuffer(arrayBuffer);
        });
        stream.on('error', reject);
        stream.on('end', () => reject(new Error('Invalid file type.')));
    });
}

function processMediaInfoMp4(info) {
    return {
        container: "video/mp4",
        duration: info.duration,
        tracks: {
            video: info.videoTracks.map(track => {
                return {
                    id: track.id,
                    bitrate: Math.round(track.bitrate),
                    language: track.language,
                    codec: track.codec,
                }
            }),
            audio: info.audioTracks.map(track => {
                return {
                    id: track.id,
                    bitrate: Math.round(track.bitrate),
                    language: track.language,
                    codec: track.codec,
                }
            })
        }
    }
}

async function parseMediaInfo(filePath) {
    switch (path.extname(filePath)) {
        case '.mp4':
            return processMediaInfoMp4(await parseMediaInfoMp4(filePath));
        case '.webm':
            return processMediaInfoWebm(await parseMediaInfoWebm(filePath));
        default:
            console.error(`Invalid extension: ${path.extname(filePath)} for path ${filePath}`)
            return null;
    }
}

export default parseMediaInfo