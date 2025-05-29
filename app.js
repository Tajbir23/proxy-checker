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

app.get('/', (req, res) => {
    res.render('index', {results: null})
})

app.post('/check', upload.single('proxyFile'), async(req, res) => {
    let proxyList = []
    let errorMsg = null;

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
        return res.render('index', { results: null, error: errorMsg });
    }

    const results = []
    const fastProxies = [];

    for (const proxy of proxyList) {
        const result = await checkProxy(proxy);
        results.push({ proxy, ...result });
        if (result.status === 'success' && result.latency <= 1000) {
          fastProxies.push(proxy);
        }
    }

    // Save fast proxies
  const filePath = path.join(__dirname, 'public', 'fast_proxies.txt');
  fs.writeFileSync(filePath, fastProxies.join('\n'), 'utf-8');

  res.render('index', { results, error: null });
})

app.post('/clear-fast-proxies', (req, res) => {
    const fastProxiesPath = path.join(__dirname, 'public', 'fast_proxies.txt');
    if (fs.existsSync(fastProxiesPath)) {
        fs.unlinkSync(fastProxiesPath);
        console.log('fast_proxies.txt deleted');
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    if (!process.env.BACKEND_URL) {
        console.warn('Warning: BACKEND_URL is not set in your .env file.');
    }
    console.log(`Server is running at http://localhost:${PORT}`);
})