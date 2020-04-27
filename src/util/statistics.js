import pnormaldist from 'pnormaldist';

const DEFAULT_CONFIDENCE = 0.9;

function ranking_confidence(value, n, confidence) {
    if (n === 0) return 0;
    if (confidence === undefined) confidence = DEFAULT_CONFIDENCE;

    const z = pnormaldist(1 - (1 - confidence) / 2);
    const phat = 1.0 * value / n;
    const result = (phat + z * z / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) / (1 + z * z / n);
    if (isNaN(result) || !isFinite(result)) {
        return 0;
    } else {
        return result;
    }
}

export default ranking_confidence;