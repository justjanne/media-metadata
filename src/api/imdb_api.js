import sqlite3 from 'sqlite3';

class ImdbApi {
    database;

    constructor(path) {
        this.database = new sqlite3.Database(path);
    }

    query(query, args) {
        return promisify(this.database, "get", query, args);
    }

    queryJson(query, args) {
        return this.query(query, args)
            .then((data) => data.json)
            .then((data) => JSON.parse(data));
    }

    findTypeById(id) {
        return this.query(ImdbApi.queryType, {
            1: id
        }).then(data => data.titleType);
    }

    findById(id) {
        return this.queryJson(ImdbApi.queryGet, {
            1: id
        });
    }

    findByIdAka(id) {
        return this.queryJson(ImdbApi.queryGetAka, {
            1: id
        });
    }

    findByIdEpisodes(id) {
        return this.queryJson(ImdbApi.queryGetEpisodes, {
            1: id
        });
    }

    findByIdPrincipals(id) {
        return this.queryJson(ImdbApi.queryGetPrincipals, {
            1: id
        });
    }

    findEpisodeById(id, seasonNumber, episodeNumber) {
        return this.queryJson(ImdbApi.queryGetEpisode, {
            1: id,
            2: seasonNumber,
            3: episodeNumber,
        });
    }

    search(type, title, year) {
        return this.query(ImdbApi.querySearch, {
            1: type,
            2: title, 3: title,
            4: year
        }).then(row => row.tconst);
    }

    static querySearch = `
        SELECT tconst
        FROM title
        WHERE title.titleType = ?
        AND (title.primaryTitle = ? OR title.originalTitle = ?)
        AND title.startYear = ?
        LIMIT 1
    `

    static queryType = `
        SELECT title.titleType
        FROM title
        WHERE title.tconst = ?
    `

    static queryGet = `
        SELECT json_object(
                       'id', title.tconst,
                       'titleType', title.titleType,
                       'primaryTitle', title.primaryTitle,
                       'originalTitle', title.originalTitle,
                       'isAdult', json(case when title.isAdult = 0 then 'false' else 'true' end),
                       'startYear', title.startYear,
                       'endYear', title.endYear,
                       'runtime', title.runtimeMinutes,
                       'genres', json('["' || replace(title.genres, ',', '","') || '"]'),
                       'rating', json_object(
                               'averageRating', title_ratings.averageRating,
                               'numVotes', title_ratings.numVotes
                           ),
                       'crew', json_object(
                               'directors', json('["' || replace(title_crew.directors, ',', '","') || '"]'),
                               'writers', json('["' || replace(title_crew.writers, ',', '","') || '"]')
                           )
                   ) AS json
        FROM title
                 LEFT OUTER JOIN title_ratings on title.tconst = title_ratings.tconst
                 LEFT OUTER JOIN title_crew on title.tconst = title_crew.tconst
        WHERE title.tconst = ?
    `;

    static queryGetAka = `
        SELECT json_group_array(json_object(
                'title', title_aka.title,
                'region', title_aka.region,
                'languages', title_aka.language,
                'types', json('["' || replace(title_aka.types, ',', '","') || '"]'),
                'attributes', json('["' || replace(title_aka.attributes, ',', '","') || '"]'),
                'isOriginalTitle', json(case when title_aka.isOriginalTitle = 0 then 'false' else 'true' end)
            )) AS json
        FROM title_aka
        WHERE title_aka.titleId = ?
        GROUP BY title_aka.titleId;
    `;

    static queryGetEpisodes = `
        SELECT json_group_array(json_object(
                 'tconst', title_episode.tconst,
                 'season', title_episode.seasonNumber,
                 'episode', title_episode.episodeNumber
            )) AS json
        FROM title_episode
        WHERE title_episode.parentTconst = ?
        GROUP BY title_episode.parentTconst;
    `;

    static queryGetPrincipals = `
        SELECT json_group_array(json_object(
                 'person', json_object(
                         'nconst', name.nconst,
                         'primaryName', name.primaryName,
                         'birthYear', name.birthYear,
                         'deathYear', name.deathYear,
                         'primaryProfession',
                         json('["' || replace(name.primaryProfession, ',', '","') || '"]'),
                         'knownForTitles',
                         json('["' || replace(name.knownForTitles, ',', '","') || '"]')
                     ),
                 'category', title_principals.category,
                 'job', title_principals.job,
                 'characters', json(title_principals.characters)
            )) AS json
        FROM title_principals
        LEFT OUTER JOIN name on title_principals.nconst = name.nconst
        WHERE title_principals.tconst = ?
        GROUP BY title_principals.tconst;
    `;

    static queryGetEpisode = `
        SELECT json_object(
                       'id', title.tconst,
                       'primaryTitle', title.primaryTitle,
                       'originalTitle', title.originalTitle,
                       'runtime', title.runtimeMinutes
                   ) AS json
        FROM title_episode
                 JOIN title ON title_episode.tconst = title.tconst
        WHERE title_episode.parentTconst = ?
          AND seasonNumber = ?
          AND episodeNumber = ?
    `;
}

function promisify(db, fun) {
    const args = Array.prototype.slice.call(arguments).slice(2);
    return new Promise((resolve, reject) => {
        db[fun](...args, function (err, row) {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        })
    });
}

export default ImdbApi;
