import fetch from 'node-fetch';

export default class FanartApi {
    apiKey;
    baseUrl;

    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || "https://webservice.fanart.tv/v3/";
    }

    request(path, options) {
        const url = new URL(path, this.baseUrl);
        const params = new URLSearchParams(options || {});
        params.append("api_key", this.apiKey);
        url.search = params.toString();
        return fetch(url.href, {
            options: {
                timeout: 2000,
            },
        }).then((response) => {
            if (response.status === 404) {
                return null;
            } else {
                return response.text().then(text => {
                    return {
                        ok: response.ok,
                        body: text,
                    }
                });
            }
        }).then((data) => {
            if (data === null) {
                return null;
            } else {
                const {ok, body} = data;
                if (!ok) {
                    throw new Error(`${url}: ${body}`);
                }
                return JSON.parse(body);
            }
        }).catch(err => {
            console.error(`Requesting data from Fanart.tv failed: ${url}`, err);
            return null;
        });
    }
}
