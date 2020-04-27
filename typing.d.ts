interface TvdbSeriesResponse {
    "data": {
        "added": string,
        "airsDayOfWeek": string,
        "airsTime": string,
        "aliases": Array<String>,
        "banner": string,
        "firstAired": string,
        "genre": Array<String>,
        "id": number,
        "imdbId": string,
        "lastUpdated": number,
        "network": string,
        "networkId": string,
        "overview": string,
        "rating": string,
        "runtime": string,
        "seriesId": string,
        "seriesName": string,
        "siteRating": number,
        "siteRatingCount": number,
        "slug": string,
        "status": string,
        "zap2itId": string
    } | null,
    "errors": {
        "invalidFilters": [
            string
        ],
        "invalidLanguage": string,
        "invalidQueryParams": [
            string
        ]
    } | null
}