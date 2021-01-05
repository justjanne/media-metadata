import fetch from 'node-fetch';

export default class TmdbApi {
    apiKey;
    baseUrl;

    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || "https://api.themoviedb.org/3/";
    }

    async updateConfiguration() {
        this.configuration = await this.request('configuration');
        return this.configuration;
    }

    getImageUrl(path) {
        return new URL(`original${path}`, this.configuration.images.secure_base_url).href;
    }

    request(path, options) {
        const url = new URL(path, this.baseUrl);
        url.search = new URLSearchParams(options || {}).toString();
        return fetch(url.href, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json;charset=utf-8',
            },
            options: {
                timeout: 2000,
            },
        }).then((response) => {
            return response.text().then(text => {
                return {
                    ok: response.ok,
                    body: text,
                }
            });
        }).then((data) => {
            const {ok, body} = data;
            if (!ok) {
                throw new Error(`${url}: ${body}`);
            }
            return JSON.parse(body);
        }).catch(err => {
            console.error(`Requesting data from TMDB failed: ${url}`, err);
            return null;
        });
    }
}
