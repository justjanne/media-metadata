import ranking_confidence from './util/statistics';
import uuid from 'uuid';
import path from "path";
import downloadFile from "./util/download-file";
import encodePath from "./util/encode-path";

class MetadataLoader {
    imdb;
    tmdb;
    tvdb;
    fanart;

    constructor(imdb, tmdb, tvdb, fanart) {
        this.imdb = imdb;
        this.tmdb = tmdb;
        this.tvdb = tvdb;
        this.fanart = fanart;
    }

    transformData(ids, imdbResult, tmdbResult, tmdbContentRatings, tmdbTranslations) {
        return {
            ids: ids,
            originalLanguage: tmdbResult.original_language,
            originalTitle: imdbResult.originalTitle,
            primaryTitle: imdbResult.primaryTitle,
            titles: imdbResult.aka
                .filter(el => el.types !== null && el.types.includes("imdbDisplay") === true)
                .map(el => {
                    return {
                        title: el.title,
                        region: el.region,
                        languages: el.languages ? el.languages.split(",") : [],
                    }
                }),
            primaryDescription: {
                overview: tmdbResult.overview,
                tagline: tmdbResult.tagline,
            },
            descriptions: tmdbTranslations.translations.map(el => {
                return {
                    region: el.iso_3166_1,
                    languages: el.iso_639_1 ? el.iso_639_1.split(",") : [],
                    overview: el.data.overview,
                    tagline: el.data.tagline,
                }
            }).filter(el => el.overview),
            yearStart: imdbResult.startYear,
            yearEnd: imdbResult.endYear,
            runtime: imdbResult.runtimeMinutes,
            seasons: imdbResult.seasons,
            episodes: imdbResult.episodes,
            genres: tmdbResult.genres.map(el => el.name),
            cast: imdbResult.principals.map(el => {
                return {
                    id: el.person.nconst,
                    name: el.person.primaryName,
                    category: el.category,
                    job: el.job,
                    characters: el.characters,
                }
            }),
            ratings: tmdbContentRatings.results.map(el => {
                const certification =
                    Array.isArray(el.release_dates) ? el.release_dates.sort((a, b) => b.type - a.type).map(el => el.certification)[0] :
                    el ? el.rating :
                    null;
                return {
                    region: el.iso_3166_1,
                    certification: certification,
                }
            }).filter(el => el.certification)
        }
    }

    transformEpisodeData(ids, imdbResult, tmdbResult, tmdbTranslations) {
        if (!imdbResult) return null;
        if (!tmdbResult) return null;
        if (!tmdbTranslations) return null;

        return {
            ids: ids,
            originalLanguage: tmdbResult.original_language,
            originalTitle: imdbResult.originalTitle,
            primaryTitle: imdbResult.primaryTitle,
            titles: tmdbTranslations.translations.map(el => {
                return {
                    title: el.data.name,
                    region: el.iso_3166_1,
                    languages: el.iso_639_1 ? el.iso_639_1.split(",") : [],
                }
            }).filter(el => el.overview),
            primaryDescription: {
                overview: tmdbResult.overview,
            },
            descriptions: tmdbTranslations.translations.map(el => {
                return {
                    region: el.iso_3166_1,
                    languages: el.iso_639_1 ? el.iso_639_1.split(",") : [],
                    overview: el.data.overview,
                }
            }).filter(el => el.overview),
            runtime: imdbResult.runtimeMinutes
        }
    }

    chooseImages(originalLanguage, tmdbImages, fanartImages) {
        function findbest(list) {
            let sorted = list.sort((a, b) => b.likes - a.likes);
            return sorted.find(el => el.language === originalLanguage) || sorted[0];
        }

        function calculateConfidenceAndQuality(containsText, originalLanguage) {
            return (element) => {
                return {
                    confidence: ranking_confidence(element.vote_average, element.vote_count),
                    lang_quality: containsText ? (
                        element.iso_639_1 === originalLanguage ? 1.5 :
                        element.iso_639_1 === null ? 1 :
                        0
                    ) : (
                        element.iso_639_1 === null ? 1.5 :
                        element.iso_639_1 === originalLanguage ? 1 :
                        0
                    ),
                    megapixels: (element.height * element.width) / 1000000,
                    ...element
                }
            }
        }

        function imageComparator(a, b) {
            function rank(element) {
                return element.lang_quality * (0.01 + element.confidence) * Math.sqrt(element.megapixels)
            }

            return rank(b) - rank(a)
        }

        return {
            logo: fanartImages && fanartImages.hdmovielogo ? findbest(fanartImages.hdmovielogo) : null,
            poster: tmdbImages.posters && tmdbImages.posters.map(calculateConfidenceAndQuality(true, originalLanguage))
                .sort(imageComparator)[0],
            backdrop: tmdbImages.backdrops && tmdbImages.backdrops.map(calculateConfidenceAndQuality(false, originalLanguage))
                .sort(imageComparator)[0],
            still: tmdbImages.stills && tmdbImages.stills.map(calculateConfidenceAndQuality(false, originalLanguage))
                .sort(imageComparator)[0],
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
            uuid: uuid.v4(),
            imdb: tmdbResult.imdb_id,
            tmdb: result.id,
            tvdb: null,
        }
    }

    async identifyShow(showTitle, showYear) {
        const tvdbResults = await this.tvdb.getSeriesByName(showTitle)
        if (!tvdbResults) return null;

        const result = tvdbResults.find(show => {
            const {year} = /^(?<year>\d+)(?:-(?<month>\d+)(?:-(?<day>\d+))?)?$/.exec(show.firstAired).groups;
            return year === showYear;
        });
        if (!result) return null;

        const tvdbId = result.id;
        if (!tvdbId) return null;

        const tvdbSeries = await this.tvdb.getSeriesById(tvdbId);
        if (!tvdbSeries) return null;

        const imdbId = tvdbSeries.imdbId;
        const tmdbResults = (await this.tmdb.request(`find/${imdbId}`, {
            external_source: "imdb_id"
        })) || (await this.tmdb.request(`find/${tvdbId}`, {
            external_source: "tvdb_id"
        }))
        if (!tmdbResults) return null;

        const tmdbSeries = tmdbResults.tv_results ? tmdbResults.tv_results[0] : null;
        if (!tmdbSeries) return null;

        const tmdbId = tmdbSeries.id;

        return {
            uuid: uuid.v4(),
            imdb: imdbId,
            tvdb: tvdbId,
            tmdb: tmdbId,
        }
    }

    async processImages(basePath, filePath, images) {
        const imageData = !images ? [] : [
            !images.logo ? null : !images.logo.url ? null : {
                type: "logo",
                url: images.logo.url,
                src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `logo${path.extname(images.logo.url)}`)))
            },
            !images.poster ? null : !images.poster.file_path ? null : {
                type: "poster",
                url: this.tmdb.getImageUrl(images.poster.file_path),
                src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `poster${path.extname(images.poster.file_path)}`)))
            },
            !images.backdrop ? null : !images.backdrop.file_path ? null : {
                type: "backdrop",
                url: this.tmdb.getImageUrl(images.backdrop.file_path),
                src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `backdrop${path.extname(images.backdrop.file_path)}`)))
            },
            !images.still ? null : !images.still.file_path ? null : {
                type: "still",
                url: this.tmdb.getImageUrl(images.still.file_path),
                src: encodePath(path.relative(basePath, path.join(filePath, "metadata", `still${path.extname(images.still.file_path)}`)))
            }
        ].filter(el => el !== null);

        await Promise.all(imageData.map(img => downloadFile(img.url, path.join(filePath, "metadata", img.type + path.extname(img.url)))))

        return imageData;
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

        const metadata = this.transformEpisodeData(ids, imdbResult, tmdbResult, tmdbTranslations);
        if (!metadata) {
            return null;
        }
        return {
            metadata: metadata,
            images: this.chooseImages(metadata.originalLanguage, tmdbImages),
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

        const fanartSource = titleType === "tvSeries" ?
            `tv/${ids.tmdb}` :
            `movies/${ids.tmdb}`;

        const [imdbResult, tmdbResult, tmdbTranslations, tmdbContentRatings, tmdbImages, fanartImages] = await Promise.all([
            this.imdb.findById(ids.imdb).catch(_ => null),
            ...tmdbSources().map(url => this.tmdb.request(url).catch(_ => null)),
            this.fanart.request(fanartSource).catch(_ => null) // do nothing, it just means it wasn’t found
        ].filter(el => el !== null));

        const metadata = this.transformData(ids, imdbResult, tmdbResult, tmdbContentRatings, tmdbTranslations);
        return {
            metadata: metadata,
            images: this.chooseImages(metadata.originalLanguage, tmdbImages, fanartImages),
        };
    }
}

export default MetadataLoader;