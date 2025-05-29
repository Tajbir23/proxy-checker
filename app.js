require('dotenv').config()
const express = require('express')
const multer = require('multer')
const PORT = process.env.PORT || 3000
const app = express()
const upload = multer({dest: "uploads/"})
const path = require('path')
const fs = require('fs');
const checkProxy = require('./proxy-checker');

app.use(express.urlencoded({extended: true}))
app.use(express.static('public'))
app.set('view engine', 'ejs')

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.get('/ping', (req, res) => {
    res.send('pong')
})

function getFastProxyCount() {
    const fastProxiesPath = path.join(__dirname, 'public', 'fast_proxies.txt');
    if (fs.existsSync(fastProxiesPath)) {
        const content = fs.readFileSync(fastProxiesPath, 'utf-8').trim();
        if (!content) return 0;
        return content.split('\n').filter(Boolean).length;
    }
    return 0;
}

app.get('/', (req, res) => {
    const fastProxiesPath = path.join(__dirname, 'public', 'fast_proxies.txt');
    const fastProxiesExists = fs.existsSync(fastProxiesPath);
    const fastProxyCount = getFastProxyCount();
    res.render('index', {results: null, fastProxiesExists, fastProxyCount, totalProxyCount: 0, latencyLimit: 1000})
})

app.post('/check', upload.single('proxyFile'), async(req, res) => {
    let proxyList = []
    let errorMsg = null;
    let latencyLimit = parseInt(req.body.latencyLimit);
    if (isNaN(latencyLimit) || latencyLimit < 1) latencyLimit = 1000;

    if (req.body.proxyText) {
        proxyList = req.body.proxyText.split('\n').map(p => p.trim()).filter(p => p);
    } else if (req.file) {
        try {
            const fileData = fs.readFileSync(req.file.path, 'utf-8');
            proxyList = fileData.split('\n').map(p => p.trim()).filter(p => p);
            fs.unlinkSync(req.file.path);
        } catch (err) {
            errorMsg = 'Failed to read uploaded file.';
        }
    } else {
        errorMsg = 'No proxies provided.';
    }

    if (errorMsg) {
        const fastProxiesPath = path.join(__dirname, 'public', 'fast_proxies.txt');
        const fastProxiesExists = fs.existsSync(fastProxiesPath);
        const fastProxyCount = getFastProxyCount();
        return res.render('index', { results: null, error: errorMsg, fastProxiesExists, fastProxyCount, totalProxyCount: 0, latencyLimit });
    }

    const results = []
    const fastProxies = [];

    for (const proxy of proxyList) {
        const result = await checkProxy(proxy);
        results.push({ proxy, ...result });
        if (result.status === 'success' && result.latency <= latencyLimit) {
          fastProxies.push(proxy);
        }
    }

    // Save fast proxies
  const filePath = path.join(__dirname, 'public', 'fast_proxies.txt');
  fs.writeFileSync(filePath, fastProxies.join('\n'), 'utf-8');
  const fastProxiesExists = fastProxies.length > 0;
  const fastProxyCount = fastProxies.length;
  const totalProxyCount = proxyList.length;
  res.render('index', { results, error: null, fastProxiesExists, fastProxyCount, totalProxyCount, latencyLimit });
})

app.post('/clear-fast-proxies', (req, res) => {
    const fastProxiesPath = path.join(__dirname, 'public', 'fast_proxies.txt');
    if (fs.existsSync(fastProxiesPath)) {
        fs.unlinkSync(fastProxiesPath);
        console.log('fast_proxies.txt deleted');
    }
    res.render('index', { results: null, fastProxiesExists: false, fastProxyCount: 0, totalProxyCount: 0 });
});

app.listen(PORT, () => {
    if (!process.env.BACKEND_URL) {
        console.warn('Warning: BACKEND_URL is not set in your .env file.');
    }
    console.log(`Server is running at http://localhost:${PORT}`);
})