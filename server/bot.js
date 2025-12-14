import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';
import path from 'path';

/**
 * ELDERLY CARE WATCH AI - BOT AGENT
 * 
 * Instructions:
 * 1. Install dependencies: npm install
 * 2. Create a .env file with SUPABASE_URL and SUPABASE_ANON_KEY
 * 3. Run: node server/bot.js
 */

// --- DEPENDENCY CHECK ---
let Client, LocalAuth, MessageMedia, qrcode, express, cors, dotenv, createClient;

try {
    const ww = require('whatsapp-web.js');
    Client = ww.Client;
    LocalAuth = ww.LocalAuth;
    MessageMedia = ww.MessageMedia; // Required for images
    qrcode = require('qrcode-terminal');
    express = require('express');
    cors = require('cors');
    dotenv = require('dotenv');
    const supabasePkg = require('@supabase/supabase-js');
    createClient = supabasePkg.createClient;
} catch (e) {
    console.error('\n\n❌ ERROR: MISSING DEPENDENCIES ❌');
    console.error('-----------------------------------');
    console.error('Please run the following command:');
    console.error('\n    npm install\n');
    console.error('-----------------------------------\n');
    process.exit(1);
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Robust CORS to allow Localhost frontend and Production frontend
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
}));

// Increase limit for base64 images to 1GB to prevent "Payload Too Large" errors
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ limit: '1gb', extended: true }));

// --- IMMEDIATE SERVER START ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ AI Agent Server running on port ${PORT}`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://[YOUR_PC_IP]:${PORT}`);
    console.log(`\n💡 TIP: For stable mobile access, use Ngrok:`);
    console.log(`   Run: ngrok http ${PORT}`);
});

// --- SUPABASE SETUP ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zaiektkvhjfndfebolao.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphaWVrdGt2aGpmbmRmZWJvbGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTM3NTEsImV4cCI6MjA3OTM2OTc1MX0.34BB18goOvIpwPci2u25JLoC7l9PRfanpC9C4DS4RfQ';

if (!process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY) {
    console.warn("\n⚠️  WARNING: SUPABASE KEYS MISSING IN .env FILE");
}

let supabase = null;
if (createClient) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase connected for maintenance & error reporting');
}

// --- GLOBAL STATE & QUEUE ---
let client = null; // Defined globally
let isReady = false;
let currentQR = null;

// The Queue ensures we process one batch of updates at a time.
const jobQueue = [];
let isProcessingQueue = false;
let lastJobStartTime = 0; // Timestamp to track stuck jobs

// --- SCHEDULED MAINTENANCE ---
// 1. Database Image Cleanup (Every 1 Hour)
setInterval(async () => {
    if (!supabase) return;
    if (global.gc) global.gc();

    console.log('[MAINTENANCE] Running 15-Hour Image Cleanup...');
    const timeLimit = new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString();

    try {
        await supabase.from('activity_logs').update({ image_urls: [] }).lt('created_at', timeLimit);
    } catch (err) {
        console.error('[CLEANUP] Failed:', err.message);
    }
}, 60 * 60 * 1000);

// 2. VIDEO QUICK CLEANUP (Every 1 Minute)
setInterval(async () => {
    if (!supabase) return;
    // 5 minutes ago
    const timeLimit = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    try {
        await supabase
            .from('activity_logs')
            .update({ image_urls: [] }) 
            .eq('category', 'Video Message')
            .lt('created_at', timeLimit)
            .neq('image_urls', '{}'); 
    } catch (err) {
        // suppress
    }
}, 60 * 1000); 

// 3. Keep-Alive Ping (Every 4 Hours)
setInterval(async () => {
    if (isReady && client) {
        console.log('[MAINTENANCE] Sending Keep-Alive Ping...');
        try { await client.getState(); } catch (e) {}
    }
}, 4 * 60 * 60 * 1000);


// --- HEARTBEAT & SELF-HEALING ---
setInterval(async () => {
    const memUsage = process.memoryUsage();
    const ram = Math.round(memUsage.heapUsed / 1024 / 1024);
    const uptime = Math.floor(process.uptime());
    
    console.log(`[HEARTBEAT] Uptime: ${uptime}s | RAM: ${ram}MB | Queue: ${jobQueue.length} | Ready: ${isReady}`);

    // WATCHDOG: Check for STUCK JOBS
    if (isProcessingQueue && lastJobStartTime > 0) {
        const duration = Date.now() - lastJobStartTime;
        if (duration > 360000) { // 6 minutes
            console.error(`[WATCHDOG] 🚨 CRITICAL: Job stuck for ${Math.round(duration/1000)}s.`);
            console.error('[WATCHDOG] Force restarting server...');
            process.exit(1); 
        }
    }
}, 60000); 

// --- BROWSER DETECTION (THE FIX FOR VIDEOS) ---
function getChromeExecutablePath() {
    const platform = process.platform;
    const commonPaths = [];

    if (platform === 'win32') {
        commonPaths.push(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        );
    } else if (platform === 'linux') {
        commonPaths.push(
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        );
    } else if (platform === 'darwin') {
        commonPaths.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        );
    }

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            console.log(`[INIT] Found System Browser: ${p}`);
            return p;
        }
    }
    
    console.log('[INIT] No System Browser found. Using bundled Chromium (Video support may be limited).');
    return null;
}

// --- INITIALIZATION LOOP ---
async function startWhatsApp() {
    console.log('Initializing WhatsApp Client...');
    
    const authPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
        ? process.env.RAILWAY_VOLUME_MOUNT_PATH 
        : './.wwebjs_auth';

    console.log(`Using Auth Path: ${authPath}`);

    const executablePath = getChromeExecutablePath();

    try {
        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: authPath
            }), 
            puppeteer: {
                // IF WE FOUND A SYSTEM BROWSER, USE IT!
                executablePath: executablePath || undefined,
                
                // CRITICAL STABILITY SETTINGS:
                // We ENABLE GPU features here to ensure the browser can process media (like resizing video for GIFs)
                // without crashing or failing.
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--disable-extensions',
                    '--ignore-gpu-blocklist',
                    '--enable-gpu-rasterization',
                    '--enable-features=NetworkService'
                ],
                headless: true,
            },
            // Add WebVersionCache to ensure we load a stable version of WhatsApp Web
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
        });

        client.on('qr', (qr) => {
            currentQR = qr;
            isReady = false;
            console.log('QR RECEIVED. Scan this to login.');
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', () => {
            console.log('✅ Client is ready!');
            isReady = true;
            currentQR = null;
        });

        client.on('authenticated', () => {
            console.log('✅ AUTHENTICATED');
            isReady = true;
            currentQR = null;
        });

        client.on('auth_failure', (msg) => {
            console.error('❌ AUTHENTICATION FAILURE', msg);
            isReady = false;
            process.exit(1);
        });

        client.on('disconnected', (reason) => {
            console.log('⚠️ Client was logged out:', reason);
            isReady = false;
            console.log('RESTARTING SERVER TO REFRESH SESSION...');
            process.exit(1); 
        });

        await client.initialize();
        
    } catch (err) {
        console.error("Client initialization failed. Retrying in 10 seconds...", err);
        isReady = false;
        setTimeout(startWhatsApp, 10000);
    }
}

// Start the loop
startWhatsApp();


// --- QUEUE PROCESSOR ---
async function processQueue() {
    if (isProcessingQueue || jobQueue.length === 0) return;

    if (!client) {
        console.warn('[QUEUE] Client not defined yet. Waiting...');
        setTimeout(processQueue, 2000);
        return;
    }

    isProcessingQueue = true;
    lastJobStartTime = Date.now(); 
    
    const job = jobQueue.shift(); 

    console.log(`[QUEUE] Processing job for Group ${job.groupId} (${job.imageUrls?.length || 0} images)`);

    try {
        await processJob(job);
    } catch (err) {
        console.error(`[QUEUE] Job Failed:`, err);
        
        // --- ERROR FEEDBACK LOOP ---
        if (job.logId && supabase) {
             console.log(`[QUEUE] Reporting failure back to DB for log ${job.logId}...`);
             supabase.from('activity_logs').update({ status: 'FAILED' }).eq('id', job.logId)
                .then(() => console.log('   -> DB Updated to FAILED'))
                .catch(e => console.error('   -> DB Update Failed:', e));
        }

    } finally {
        isProcessingQueue = false;
        lastJobStartTime = 0; 
        if (global.gc) { global.gc(); }
        setTimeout(processQueue, 1000); 
    }
}

async function processJob(job) {
    const { groupId, message, imageUrls, isMuted } = job;
    const hasImages = imageUrls && imageUrls.length > 0;
    const hasText = message && message.trim().length > 0;

    // SCENARIO 1: Media (Images or Video)
    if (hasImages) {
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            let media = null; 

            try {
                if (url.startsWith('data:')) {
                    const parts = url.split(',');
                    const mimeMatch = parts[0].match(/:(.*?);/);
                    let mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                    const data = parts[1];

                    // --- MIME HANDLING ---
                    // Detect file extension from MIME type
                    let ext = 'bin';
                    if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
                    else if (mime.includes('png')) ext = 'png';
                    else if (mime.includes('webp')) ext = 'webp';
                    else if (mime.includes('mp4')) ext = 'mp4';
                    else if (mime.includes('webm')) ext = 'webm';
                    else if (mime.includes('quicktime')) ext = 'mov';
                    else if (mime.includes('pdf')) ext = 'pdf';
                    
                    const filename = `update_${Date.now()}_${i}.${ext}`;
                    media = new MessageMedia(mime, data, filename);
                    console.log(`[QUEUE] Created Media Object: ${mime} size=${Math.round(data.length/1024)}KB`);

                } else {
                    media = await MessageMedia.fromUrl(url);
                }
                
                if (media) {
                    const options = {};
                    if (hasText && i === imageUrls.length - 1) {
                         options.caption = message;
                    }
                    
                    const isVideo = media.mimetype.includes('video');
                    
                    if (isVideo) {
                        // FORCE VIDEO PLAYER PREFERENCE
                        options.sendMediaAsDocument = false; 
                        
                        // MUTE LOGIC
                        if (isMuted) {
                             console.log('[QUEUE] 🔇 Video set to Muted (GIF Mode)');
                             options.sendVideoAsGif = true;
                        }
                    }

                    console.log(`[QUEUE] Sending media to ${groupId}...`);
                    
                    const timeoutSeconds = isVideo ? 300000 : 30000; // 5 Minutes for Video
                    
                    // --- SMART RETRY LOOP ---
                    let sent = false;
                    let lastError = null;

                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            const sendPromise = client.sendMessage(groupId, media, options);
                            const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Timeout sending media')), timeoutSeconds)
                            );
                            
                            await Promise.race([sendPromise, timeoutPromise]);
                            
                            sent = true;
                            console.log(`[QUEUE] ✅ Sent media ${i + 1}/${imageUrls.length} (Attempt ${attempt})`);
                            break; 
                        } catch (attemptError) {
                            console.warn(`[QUEUE] ⚠️ Attempt ${attempt} failed: ${attemptError.message}`);
                            
                            // --- SMART FALLBACK LOGIC ---
                            // If sending as Video failed, we MUST switch to Document mode for the next attempt.
                            // The error "Evaluation failed" means the browser couldn't render the video preview/gif.
                            if (isVideo && !options.sendMediaAsDocument) {
                                console.log('[QUEUE] 🔄 Switching to Document Mode to ensure delivery (System Browser might be missing codecs).');
                                options.sendMediaAsDocument = true;
                                options.sendVideoAsGif = false; // Disable GIF mode in fallback to ensure regular file delivery
                            }

                            lastError = attemptError;
                            
                            if (attempt < 3) {
                                const waitTime = attempt * 3000; 
                                await new Promise(r => setTimeout(r, waitTime));
                            }
                        }
                    }

                    if (!sent) {
                        throw lastError || new Error("Failed to send media after 3 attempts");
                    }
                }
            } catch (imgErr) {
                console.error(`[QUEUE] ❌ Error sending media ${i+1}:`, imgErr.message);
                throw imgErr; // Rethrow to trigger the 'catch' block in processQueue (updating DB to FAILED)
            } finally {
                media = null; 
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    } 
    // SCENARIO 2: Text Only (No Media)
    else if (hasText) {
        try {
            await client.sendMessage(groupId, message);
            console.log('[QUEUE] Text message sent.');
        } catch (e) {
            console.error('[QUEUE] Failed to send text:', e.message);
            throw e;
        }
    }
}


// --- API ENDPOINTS ---
app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/', (req, res) => {
    const uptime = process.uptime();
    res.send(`Elderly Care Watch AI Bot Server is Running! Uptime: ${Math.floor(uptime)}s | Queue: ${jobQueue.length}`);
});

app.get('/status', (req, res) => {
    res.json({ 
        status: isReady ? 'connected' : 'disconnected',
        hasQR: !!currentQR
    });
});

app.get('/qr', (req, res) => {
    res.json({ qr: currentQR });
});

app.get('/groups', async (req, res) => {
    if (!isReady || !client) {
        return res.json([]); 
    }
    try {
        let groups = [];
        const chats = await client.getChats();
        groups = chats
            .filter(chat => chat.isGroup || chat.id._serialized.endsWith('@g.us'))
            .map(chat => ({
                id: chat.id._serialized,
                name: chat.name || 'Unknown Group'
            }));
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.json([]);
    }
});

app.post('/send-update', (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp not connected' });
    }

    const { logId, groupId, message, imageUrls, isMuted } = req.body;

    if (!groupId) {
        return res.status(400).json({ error: 'Missing groupId' });
    }

    jobQueue.push({ logId, groupId, message, imageUrls, isMuted });
    console.log(`[API] Job added to queue. Queue length: ${jobQueue.length}`);
    
    processQueue();

    res.json({ success: true, status: 'queued' });
});