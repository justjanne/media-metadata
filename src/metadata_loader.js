import ranking_confidence from './util/statistics';
import uuid from 'uuid';
import path from "path";
import downloadFile from "./util/download-file";

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
                    Array.isArray(el) ? el.release_dates.sort((a, b) => b.type - a.type).map(el => el.certification) :
                        el ? el.rating :
                            null;
                return {
                    region: el.iso_3166_1,
                    certification: certification,
                }
            }).filter(el => el.certification)
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
            poster: tmdbImages.posters.map(calculateConfidenceAndQuality(true, originalLanguage))
                .sort(imageComparator)[0],
            backdrop: tmdbImages.backdrops.map(calculateConfidenceAndQuality(false, originalLanguage))
                .sort(imageComparator)[0],
        }
    }

    async identifyMovie(title, year) {
        const results = await this.tmdb.request(`search/movie`, {
            query: title,
            primary_release_year: year
        }).catch((e) => console.error(e));

        const result = results.results.sort((a, b) => {
            return b.popularity - a.popularity;
        })[0];

        return result ? {
            uuid: uuid.v4(),
            tmdb: result.id,
            imdb: (await this.tmdb.request(`movie/${result.id}`)).imdb_id
        } : null;
    }

    async processImages(basePath, filePath, images) {
        const imageData = !images ? [] : [
            !images.logo ? null : !images.logo.url ? null : {
                type: "logo",
                url: images.logo.url,
                src: encodeURI(path.relative(basePath, path.join(filePath, "metadata", `logo${path.extname(images.logo.url)}`)))
            },
            !images.poster ? null : !images.poster.file_path ? null : {
                type: "poster",
                url: this.tmdb.getImageUrl(images.poster.file_path),
                src: encodeURI(path.relative(basePath, path.join(filePath, "metadata", `poster${path.extname(images.poster.file_path)}`)))
            },
            !images.backdrop ? null : !images.backdrop.file_path ? null : {
                type: "backdrop",
                url: this.tmdb.getImageUrl(images.backdrop.file_path),
                src: encodeURI(path.relative(basePath, path.join(filePath, "metadata", `backdrop${path.extname(images.backdrop.file_path)}`)))
            }
        ].filter(el => el !== null);

        await Promise.all(imageData.map(img => downloadFile(img.url, path.join(filePath, "metadata", img.type + path.extname(img.url)))))

        return imageData;
    }

    async loadMetadata(ids, isEpisode) {
        const titleType = await this.imdb.findTypeById(ids.imdb);

        function tmdbSources() {
            if (titleType !== "tvSeries") {
                return [`movie/${ids.tmdb}`, `movie/${ids.tmdb}/translations`, `movie/${ids.tmdb}/release_dates`, `movie/${ids.tmdb}/images`]
            } else if (!isEpisode) {
                return [`tv/${ids.tmdb}`, `tv/${ids.tmdb}/translations`, `tv/${ids.tmdb}/content_ratings`, `tv/${ids.tmdb}/images`]
            } else {
                return [`tv/${ids.tmdb}`, `tv/${ids.tmdb}/translations`]
            }
        }

        const fanartSource = titleType === "tvSeries" ?
            `tv/${ids.tmdb}` :
            `movies/${ids.tmdb}`;

        const [imdbResult, tmdbResult, tmdbTranslations, tmdbContentRatings, tmdbImages, fanartImages] = await Promise.all([
            this.imdb.findById(ids.imdb).catch(_ => null),
            ...tmdbSources().map(url => this.tmdb.request(url).catch(_ => null)),
            isEpisode ? null : this.fanart.request(fanartSource).catch(_ => null) // do nothing, it just means it wasn’t found
        ].filter(el => el !== null));

        const metadata = this.transformData(ids, imdbResult, tmdbResult, tmdbContentRatings, tmdbTranslations);
        return {
            metadata: metadata,
            // also use tvdb for images
            images: isEpisode ? null : this.chooseImages(metadata.originalLanguage, tmdbImages, fanartImages),
        };
    }
}

export default MetadataLoader;