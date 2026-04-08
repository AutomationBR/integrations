let cachedToken = null;
let tokenExpiry = null;

function isExpired() {
    return !cachedToken || !tokenExpiry || tokenExpiry <= Date.now();
}

function getCachedToken() {
    return isExpired() ? null : cachedToken;
}

function setCachedToken(token, expiresIn) {
    cachedToken = token;
    tokenExpiry = Date.now() + Math.max(expiresIn - 60, 0) * 1000;
}

function clearToken() {
    cachedToken = null;
    tokenExpiry = null;
}

function getToken() {
    return getCachedToken();
}

function setToken(token, expiresIn) {
    setCachedToken(token, expiresIn);
}

module.exports = {
    clearToken,
    getCachedToken,
    getToken,
    isExpired,
    setCachedToken,
    setToken
};
