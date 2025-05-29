const { default: axios } = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

const checkProxy = async(proxy) => {
    console.log(proxy)
    try {
        const [host, port, username, password] = proxy.split(/[:]/)
    const proxyUrl = `http://${username}:${password}@${host}:${port}`;
    const agent = new HttpsProxyAgent(proxyUrl)
    const start = Date.now()

    const response = await axios.get(`${process.env.BACKEND_URL}/ping`,{
        httpAgent: agent,
        timeout: 5000
    })

    const latency = Date.now() - start;

    console.log(response.status, latency)
    return { status: 'success', statusCode: response.status, latency }
    } catch (error) {
        console.log(error.message)
        return { status: 'fail', statusCode: null, latency: null };
    }
}

module.exports = checkProxy