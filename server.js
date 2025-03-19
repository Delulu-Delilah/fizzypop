const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const port = 3000;

// Define request options for ytdl
const requestOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1'
    }
};

app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Helper function to get format info
function getFormatInfo(format) {
    return {
        itag: format.itag,
        type: format.hasVideo && format.hasAudio ? 'video' : (format.hasAudio ? 'audio' : 'video'),
        qualityLabel: format.qualityLabel || (format.hasAudio ? `${format.audioBitrate}kbps` : 'N/A'),
        container: format.container,
        contentLength: format.contentLength,
        audioBitrate: format.audioBitrate
    };
}

app.get('/api/video-info', async (req, res) => {
    try {
        const videoUrl = `https://www.youtube.com/watch?v=${req.query.v}`;
        const info = await ytdl.getInfo(videoUrl);

        // Get highest quality video format (MP4 with both video and audio)
        const highestQualityVideo = info.formats
            .filter(format => format.container === 'mp4' && format.hasVideo && format.hasAudio)
            .sort((a, b) => {
                const getQualityNumber = (quality) => parseInt(quality?.qualityLabel?.replace(/[^\d]/g, '') || '0');
                return getQualityNumber(b) - getQualityNumber(a);
            })[0];

        // Get highest quality audio format (MP4 audio only)
        const highestQualityAudio = info.formats
            .filter(format => format.container === 'mp4' && !format.hasVideo && format.hasAudio)
            .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

        // Create formats array with only the highest quality options
        const formats = [];
        
        if (highestQualityVideo) {
            formats.push({
                itag: highestQualityVideo.itag,
                container: highestQualityVideo.container,
                hasVideo: true,
                hasAudio: true,
                quality: highestQualityVideo.qualityLabel || 'Highest Quality',
                contentLength: highestQualityVideo.contentLength
            });
        }

        if (highestQualityAudio) {
            formats.push({
                itag: highestQualityAudio.itag,
                container: highestQualityAudio.container,
                hasVideo: false,
                hasAudio: true,
                quality: `${highestQualityAudio.audioBitrate}kbps Audio`,
                contentLength: highestQualityAudio.contentLength
            });
        }

        console.log('Highest quality formats:', formats); // Debug log

        res.json({
            title: info.videoDetails.title,
            formats: formats,
            thumbnail: info.videoDetails.thumbnails[0].url,
            duration: parseInt(info.videoDetails.lengthSeconds),
            author: info.videoDetails.author.name
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information' });
    }
});

app.get('/api/download', async (req, res) => {
    try {
        const { v: videoId, itag } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Get video info to verify format exists
        const info = await ytdl.getInfo(videoUrl);
        const format = info.formats.find(f => f.itag === parseInt(itag));

        if (!format) {
            return res.status(400).json({ error: 'Invalid format selected' });
        }

        // Sanitize the filename
        const sanitizedTitle = info.videoDetails.title ? 
            info.videoDetails.title.replace(/[<>:"/\\|?*]/g, '') : 'download'; // Default to 'download' if title is empty
        const fileExtension = format.hasVideo ? 'mp4' : 'mp3'; // Determine file extension based on format
        const filename = `${sanitizedTitle}.${fileExtension}`;

        // Set headers for video download
        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        res.header('Content-Type', format.hasVideo ? 'video/mp4' : 'audio/mpeg');

        // Create download stream
        const stream = ytdl(videoUrl, {
            quality: itag,
            filter: format => format.itag === parseInt(itag)
        });

        // Pipe the video stream to response
        stream.pipe(res);

        stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
        });

    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed' });
        }
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 