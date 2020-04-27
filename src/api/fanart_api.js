import fetch from 'node-fetch';

class FanartApi {
    apiKey;
    baseUrl;

    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || "http://webservice.fanart.tv/v3/";
    }

    request(path, options) {
        const url = new URL(path, this.baseUrl);
        const params = new URLSearchParams(options || {});
        params.append("api_key", this.apiKey);
        url.search = params.toString();
        return fetch(
            url.href
        ).then((response) => {
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
        });
    }
}

export default FanartApi;