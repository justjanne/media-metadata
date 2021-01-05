import ranking_confidence from './util/statistics';
import {v4 as uuidv4} from 'uuid';
import path from "path";
import downloadFile from "./util/download-file";
import encodePath from "./util/encode-path";
import {
    Genre,
    Person,
    Title,
    TitleCast,
    TitleDescription,
    TitleEpisode,
    TitleGenre,
    TitleImage,
    TitleMedia,
    TitleName,
    TitlePreview,
    TitleRating,
    TitleSubtitles
} from "./model";

class MetadataLoader {
    imdb;
    tmdb;
    fanart;
    storage;

    constructor(imdb, tmdb, fanart, storage) {
        this.imdb = imdb;
        this.tmdb = tmdb;
        this.fanart = fanart;
        this.storage = storage;
    }

    async transformData(ids, imdbResult, tmdbResult, tmdbContentRatings, tmdbTranslations, kind) {
        const [title] = await Title.upsert({
            id: ids.uuid,
            imdb_id: ids.imdb,
            tmdb_id: ids.tmdb,
            tvdb_id: ids.tvdb,
            kind,
            original_language: tmdbResult.original_language,
            runtime: imdbResult.runtime,
            year_start: imdbResult.startYear,
            year_end: imdbResult.endYear,
        }, {returning: true});
        await TitleName.destroy({
            where: {
                title_id: title.id,
            }
        })
        const primaryTitleName = await TitleName.build({
            region: null,
            languages: [],
            kind: "primary",
            name: imdbResult.primaryTitle,
        });
        await primaryTitleName.setTitle(title.id, {save: false});
        await primaryTitleName.save();
        const originalTitleName = await TitleName.build({
            region: null,
            languages: [],
            kind: "original",
            name: imdbResult.originalTitle,
        });
        await originalTitleName.setTitle(title.id, {save: false});
        await originalTitleName.save();
        for (let el of imdbResult.aka.filter(el => el.types !== null && el.types.includes("imdbDisplay") === true)) {
            const titleName = await TitleName.build({
                region: el.region,
                languages: el.languages ? el.languages.split(",") : [],
                kind: "localized",
                name: el.title,
            })
            await titleName.setTitle(title.id, {save: false});
            await titleName.save();
        }
        await TitleDescription.destroy({
            where: {
                title_id: title.id,
            }
        })
        const originalTitleDescription = await TitleDescription.build({
            region: null,
            languages: [],
            kind: "original",
            overview: tmdbResult.overview,
            tagline: tmdbResult.tagline,
        });
        await originalTitleDescription.setTitle(title.id, {save: false});
        await originalTitleDescription.save();
        for (let el of tmdbTranslations.translations) {
            const titleDescription = await TitleDescription.build({
                region: el.iso_3166_1,
                languages: el.iso_639_1 ? el.iso_639_1.split(",") : [],
                kind: "localized",
                overview: el.data.overview,
                tagline: el.data.tagline,
            })
            await titleDescription.setTitle(title.id, {save: false});
            await titleDescription.save();
        }
        await TitleCast.destroy({
            where: {
                title_id: title.id,
            }
        })
        for (let el of imdbResult.principals) {
            const [person] = await Person.upsert({
                imdb_id: el.person.nconst,
                name: el.person.primaryName,
            }, {returning: true});

            const titleCast = await TitleCast.build({
                category: el.category,
                characters: el.characters || [],
                credit: el.job,
            });
            await titleCast.setTitle(title.id, {save: false});
            await titleCast.setPerson(person.id, {save: false});
            await titleCast.save();
        }

        await TitleGenre.destroy({
            where: {
                title_id: title.id,
            }
        })
        for (let el of tmdbResult.genres) {
            const [genre] = await Genre.upsert({
                tmdb_id: el.id,
                name: el.name,
            }, {returning: true});

            const titleGenre = await TitleGenre.build({});
            await titleGenre.setTitle(title.id, {save: false});
            await titleGenre.setGenre(genre.id, {save: false});
            await titleGenre.save();
        }

        await TitleRating.destroy({
            where: {
                title_id: title.id,
            }
        })
        for (let el of tmdbContentRatings.results) {
            const certification =
                Array.isArray(el.release_dates) ? el.release_dates.sort((a, b) => b.type - a.type).map(el => el.certification)[0] :
                    el ? el.rating :
                        null;
            const titleRating = await TitleRating.build({
                region: el.iso_3166_1,
                certification: certification,
                title_id: title.id,
            });
            await titleRating.setTitle(title.id, {save: false});
            await titleRating.save();
        }

        return title;
    }

    async transformEpisodeData(ids, episodeIdentifier, imdbResult, tmdbResult, tmdbTranslations) {
        if (!imdbResult) return null;
        if (!tmdbResult) return null;
        if (!tmdbTranslations) return null;

        const showTitle = await Title.findByPk(ids.uuid);
        const [mapping] = await TitleEpisode.findOrBuild({
            where: {
                show_id: showTitle.id,
                season_number: episodeIdentifier.season,
                episode_number: episodeIdentifier.episode,
            },
            defaults: {
                episode_id: uuidv4(),
            }
        })
        const [episodeTitle] = await Title.upsert({
            id: mapping.episode_id,
            kind: "episode",
            imdb_id: imdbResult.id,
            tmdb_id: tmdbResult.id,
            original_language: showTitle.original_language,
            runtime: imdbResult.runtime,
        }, {returning: true});
        mapping.air_date = tmdbResult.air_date;
        await episodeTitle.save();
        await mapping.setEpisode(episodeTitle, {save: false});
        await mapping.setShow(showTitle, {save: false});
        await mapping.save();
        await TitleName.destroy({
            where: {
                title_id: episodeTitle.id,
            }
        })
        const primaryTitleName = await TitleName.build({
            region: null,
            languages: [],
            kind: "primary",
            name: imdbResult.primaryTitle,
        });
        await primaryTitleName.setTitle(episodeTitle.id, {save: false});
        await primaryTitleName.save();
        const originalTitleName = await TitleName.build({
            region: null,
            languages: [],
            kind: "original",
            name: imdbResult.originalTitle,
        });
        await originalTitleName.setTitle(episodeTitle.id, {save: false});
        await originalTitleName.save();
        for (let el of tmdbTranslations.translations) {
            if (el.data.name) {
                const titleName = await TitleName.build({
                    region: el.iso_3166_1,
                    languages: el.iso_639_1 ? el.iso_639_1.split(",") : [],
                    kind: "localized",
                    name: el.data.name,
                })
                await titleName.setTitle(episodeTitle.id, {save: false});
                await titleName.save();
            }
        }
        await TitleDescription.destroy({
            where: {
                title_id: episodeTitle.id,
            }
        })
        const originalTitleDescription = await TitleDescription.build({
            region: null,
            languages: [],
            kind: "original",
            overview: tmdbResult.overview,
            tagline: tmdbResult.tagline,
        });
        await originalTitleDescription.setTitle(episodeTitle.id, {save: false});
        await originalTitleDescription.save();
        for (let el of tmdbTranslations.translations) {
            if (el.data.overview && el.data.overview.trim() !== "") {
                const titleDescription = await TitleDescription.build({
                    region: el.iso_3166_1,
                    languages: el.iso_639_1 ? el.iso_639_1.split(",") : [],
                    kind: "localized",
                    overview: el.data.overview,
                    tagline: el.data.tagline,
                })
                await titleDescription.setTitle(episodeTitle.id, {save: false});
                await titleDescription.save();
            }
        }

        return episodeTitle;
    }

    chooseImages(originalLanguage, tmdbImages, fanartImages) {
        function calculateConfidenceAndQuality(element) {
            return {
                confidence: ranking_confidence(element.vote_average, element.vote_count),
                megapixels: (element.height * element.width) / 1000000,
                ...element
            }
        }

        function imageComparator(a, b) {
            function rank(element) {
                return (0.01 + element.confidence) * Math.sqrt(element.megapixels)
            }

            return rank(b) - rank(a)
        }

        function transformFanartImage(image) {
            if (!image) {
                return null;
            }

            const modifiedUrl = new URL(image.url);
            modifiedUrl.protocol = "http";
            return {
                ...image,
                url: modifiedUrl.href,
            }
        }

        const languages = Array.from(new Set([
            ...Object.values(tmdbImages)
                .flatMap(it => it)
                .map(it => it.iso_639_1),
            ...(fanartImages && fanartImages.hdmovielogo || [])
                .map(it => it.language)
        ]));

        const sortedLogos = (fanartImages && fanartImages.hdmovielogo || [])
            .sort((a, b) => b.likes - a.likes);

        const sortedPosters = (tmdbImages.posters || [])
            .map(calculateConfidenceAndQuality)
            .sort(imageComparator);

        const sortedBackdrops = (tmdbImages.backdrops || [])
            .map(calculateConfidenceAndQuality)
            .sort(imageComparator);

        const sortedStills = (tmdbImages.stills || [])
            .map(calculateConfidenceAndQuality)
            .sort(imageComparator);

        return {
            logo: languages
                .map(lang => sortedLogos.find(it => it.lang === lang))
                .filter(it => it !== undefined)
                .map(transformFanartImage),
            poster: languages
                .map(lang => sortedPosters.find(it => it.iso_639_1 === lang))
                .filter(it => it !== undefined),
            backdrop: languages
                .map(lang => sortedBackdrops.find(it => it.iso_639_1 === lang))
                .filter(it => it !== undefined),
            still: languages
                .map(lang => sortedStills.find(it => it.iso_639_1 === lang))
                .filter(it => it !== undefined),
        }
    }

    async identifyMovie(title, year) {
        const results = await this.tmdb.request(`search/movie`, {
            query: title,
            primary_release_year: year
        }).catch((e) => console.error(e));
        if (!results) return null;

        const result = results.results.sort((a, b) => {
            return b.popularity - a.popularity;
        })[0];
        if (!result) return null;

        const tmdbResult = await this.tmdb.request(`movie/${result.id}`);
        if (!tmdbResult) return null;

        return {
            uuid: uuidv4(),
            imdb: tmdbResult.imdb_id,
            tmdb: result.id,
            tvdb: null,
        }
    }

    async identifyShow(showTitle, showYear) {
        const results = await this.tmdb.request(`search/tv`, {
            query: showTitle,
            first_air_date_year: showYear
        }).catch((e) => console.error(e));
        if (!results) return null;

        const result = results.results.sort((a, b) => {
            return b.popularity - a.popularity;
        })[0];
        if (!result) return null;

        const tmdbResult = await this.tmdb.request(`tv/${result.id}/external_ids`);
        if (!tmdbResult) return null;

        return {
            uuid: uuidv4(),
            imdb: tmdbResult.imdb_id,
            tvdb: tmdbResult.tvdb_id,
            tmdb: result.id,
        }
    }

    async processImages(basePath, filePath, images) {
        const imageData = [
            ...images.logo.map(it => {
                return {
                    kind: "logo",
                    language: it.lang || null,
                    url: it.url,
                    src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `logo.${it.lang || null}${path.extname(it.url)}`)))
                }
            }),
            ...images.poster.map(it => {
                return {
                    kind: "poster",
                    language: it.iso_639_1 || null,
                    url: this.tmdb.getImageUrl(it.file_path),
                    src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `poster.${it.iso_639_1 || null}${path.extname(it.file_path)}`)))
                }
            }),
            ...images.backdrop.map(it => {
                return {
                    kind: "backdrop",
                    language: it.iso_639_1 || null,
                    url: this.tmdb.getImageUrl(it.file_path),
                    src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `backdrop.${it.iso_639_1 || null}${path.extname(it.file_path)}`)))
                }
            }),
            ...images.still.map(it => {
                return {
                    kind: "still",
                    language: it.iso_639_1 || null,
                    url: this.tmdb.getImageUrl(it.file_path),
                    src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `still.${it.iso_639_1 || null}${path.extname(it.file_path)}`)))
                }
            })
        ]

        return await Promise.all(imageData.map(async img => {
            console.log("Downloading image " + img.kind + " (" + img.language+") for " + filePath);
            const headers = await downloadFile(img.url, path.join(filePath, "metadata", img.kind + "." + img.language + path.extname(img.url)));
            return {
                mime: headers["content-type"],
                ...img,
            }
        }));
    }

    async processImageMetadata(title, images) {
        await TitleImage.destroy({
            where: {
                title_id: title.id,
            }
        })
        for (let image of images) {
            const titleImage = await TitleImage.build({
                kind: image.kind,
                language: image.language,
                mime: image.mime,
                src: image.src,
            })
            await titleImage.setTitle(title.id, {save: false});
            await titleImage.save();
        }
    }

    async processMediaMetadata(title, media) {
        await Promise.all([
            TitleMedia.destroy({
                where: {
                    title_id: title.id,
                }
            }),
            TitleSubtitles.destroy({
                where: {
                    title_id: title.id,
                }
            }),
            TitlePreview.destroy({
                where: {
                    title_id: title.id,
                }
            })
        ]);
        for (let format of media.media) {
            const titleMedia = await TitleMedia.build({
                mime: format.container,
                codecs: [...new Set(format.tracks.flatMap(track => track.codecs))],
                languages: [...new Set(format.tracks.map(track => track.language).filter(it => !!it))],
                src: format.src,
            })
            await titleMedia.setTitle(title.id, {save: false});
            await titleMedia.save();
        }
        for (let subtitle of media.subtitles) {
            const titleSubtitles = await TitleSubtitles.build({
                language: subtitle.language,
                region: subtitle.region,
                specifier: subtitle.specifier,
                format: subtitle.format,
                src: subtitle.src
            })
            await titleSubtitles.setTitle(title.id, {save: false});
            await titleSubtitles.save();
        }
        const titlePreview = await TitlePreview.build({
            src: media.preview,
        })
        await titlePreview.setTitle(title.id, {save: false});
        await titlePreview.save();
    }

    async loadEpisodeMetadata(ids, episodeIdentifier) {
        const {season, episode} = episodeIdentifier;
        const tmdbSources = [
            `tv/${ids.tmdb}/season/${season}/episode/${episode}`,
            `tv/${ids.tmdb}/season/${season}/episode/${episode}/translations`,
            `tv/${ids.tmdb}/season/${season}/episode/${episode}/images`
        ]

        const [imdbResult, tmdbResult, tmdbTranslations, tmdbImages] = await Promise.all([
            this.imdb.findEpisodeById(ids.imdb, season, episode).catch(_ => null),
            ...tmdbSources.map(url => this.tmdb.request(url).catch(_ => null)),
        ].filter(el => el !== null));

        const title = await this.transformEpisodeData(ids, episodeIdentifier, imdbResult, tmdbResult, tmdbTranslations);
        if (!title) return;
        return {
            title: title,
            images: this.chooseImages(title.original_language, tmdbImages),
        };
    }

    async loadMetadata(ids) {
        const titleType = await this.imdb.findTypeById(ids.imdb);

        function tmdbSources() {
            if (titleType !== "tvSeries") {
                return [`movie/${ids.tmdb}`, `movie/${ids.tmdb}/translations`, `movie/${ids.tmdb}/release_dates`, `movie/${ids.tmdb}/images`]
            } else {
                return [`tv/${ids.tmdb}`, `tv/${ids.tmdb}/translations`, `tv/${ids.tmdb}/content_ratings`, `tv/${ids.tmdb}/images`]
            }
        }

        const isShow = titleType === "tvSeries";
        const fanartSource = isShow ?
            `tv/${ids.tvdb}` :
            `movies/${ids.tmdb}`;

        const [
            imdbResult, imdbAka, imdbPrincipals, imdbEpisodes,
            tmdbResult, tmdbTranslations, tmdbContentRatings, tmdbImages,
            fanartImages
        ] = await Promise.all([
            this.imdb.findById(ids.imdb),
            this.imdb.findByIdAka(ids.imdb),
            this.imdb.findByIdPrincipals(ids.imdb),
            isShow ? this.imdb.findByIdEpisodes(ids.imdb) : new Promise((resolve) => resolve([])),
            ...tmdbSources().map(url => this.tmdb.request(url)),
            this.fanart.request(fanartSource),
        ].map(it => it.catch(err => {
            console.error(`Error while processing ${ids.imdb}`, err);
            process.abort();
            return null;
        })));
        const imdbData = {
            ...imdbResult,
            aka: imdbAka,
            principals: imdbPrincipals,
            episodes: imdbEpisodes,
        };

        const title = await this.transformData(ids, imdbData, tmdbResult, tmdbContentRatings, tmdbTranslations, isShow ? "show" : "movie");

        return {
            title: title,
            images: this.chooseImages(title.original_language, tmdbImages, fanartImages)
        };
    }
}

export default MetadataLoader;
