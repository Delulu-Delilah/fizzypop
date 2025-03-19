// DOM Elements
const player = document.getElementById('player');
const videoTitle = document.getElementById('videoTitle');
const metaInfo = document.getElementById('metaInfo');
const downloadOptions = document.getElementById('downloadOptions');
const loading = document.getElementById('loading');
const error = document.getElementById('error');

// Get video ID from URL
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('v');

let availableFormats = [];

// Initialize video player and fetch video info
async function initializeVideo() {
    if (!videoId) {
        showError('No video ID provided');
        return;
    }

    // Create YouTube embed
    player.src = `https://www.youtube.com/embed/${videoId}`;
    loading.style.display = 'block';
    error.style.display = 'none';

    try {
        // Fetch video info and download options
        const response = await fetch(`/api/video-info?v=${videoId}`);
        const data = await response.json();
        
        // Detailed response logging
        console.log('Raw response status:', response.status);
        console.log('Raw response headers:', Object.fromEntries(response.headers.entries()));
        console.log('Raw data type:', typeof data);
        console.log('Raw data keys:', Object.keys(data));
        console.log('Formats type:', Array.isArray(data.formats) ? 'array' : typeof data.formats);
        console.log('Number of formats:', data.formats ? data.formats.length : 0);
        console.log('First format object:', data.formats ? data.formats[0] : null);
        console.log('Format properties:', data.formats ? Object.keys(data.formats[0] || {}) : []);
        console.log('Full response:', JSON.stringify(data, null, 2));
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch video info');
        }
        
        if (!data.formats || !Array.isArray(data.formats)) {
            throw new Error('Invalid format data received');
        }

        // Log each format individually
        console.log('Individual format details:');
        data.formats.forEach((format, index) => {
            console.log(`Format ${index}:`, {
                itag: format.itag,
                container: format.container,
                qualityLabel: format.qualityLabel,
                hasVideo: format.hasVideo,
                hasAudio: format.hasAudio,
                contentLength: format.contentLength,
                // Log all available properties
                allProps: Object.keys(format)
            });
        });

        // Validate each format object
        const validFormats = data.formats.filter(format => {
            // Check if format is a valid object with required properties
            if (!format || typeof format !== 'object') return false;
            
            // Log invalid formats for debugging
            if (!format.itag || !format.container) {
                console.log('Invalid format:', format);
                return false;
            }
            
            return true;
        });

        console.log('Valid formats:', validFormats); // Debug log
        
        // Update video metadata
        videoTitle.textContent = data.title || 'Untitled';
        metaInfo.textContent = `${data.author || 'Unknown'} • ${formatDuration(data.duration || 0)}`;
        
        // Store available formats with strict filtering
        availableFormats = validFormats.filter(format => {
            // Ensure all required properties exist
            const hasRequiredProps = format.itag && 
                                   format.container && 
                                   typeof format.hasVideo !== 'undefined' && 
                                   typeof format.hasAudio !== 'undefined';
            
            if (!hasRequiredProps) {
                console.log('Format missing required properties:', format);
                return false;
            }

            // Filter for valid MP4 formats
            return format.container === 'mp4' && (
                (format.hasVideo && format.hasAudio) || // Video formats
                (!format.hasVideo && format.hasAudio)   // Audio formats
            );
        });
        
        console.log('Filtered formats:', availableFormats); // Debug log
        
        if (availableFormats.length === 0) {
            throw new Error('No valid formats available for this video');
        }
        
        // Create download interface
        createDownloadInterface();
        
        loading.style.display = 'none';
    } catch (err) {
        console.error('Error:', err);
        showError(err.message || 'Failed to load video information');
        loading.style.display = 'none';
    }
}

function createDownloadInterface() {
    downloadOptions.innerHTML = `
        <div class="download-selectors">
            <select id="formatSelect" class="download-select">
                <option value="">Select Format</option>
                <option value="video">Highest Quality MP4</option>
                <option value="audio">Highest Quality MP3</option>
            </select>
        </div>
        <button id="downloadButton" class="download-button" disabled>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Download
        </button>
    `;

    const formatSelect = document.getElementById('formatSelect');
    const downloadButton = document.getElementById('downloadButton');

    // Handle format change
    formatSelect.addEventListener('change', () => {
        const selectedFormat = formatSelect.value;
        if (!selectedFormat) {
            downloadButton.disabled = true;
            return;
        }

        const format = availableFormats.find(f => 
            selectedFormat === 'video' ? f.hasVideo : !f.hasVideo
        );

        if (format) {
            // Update button to show quality and size
            let quality = format.quality || 'Best Quality';
            let size = format.contentLength ? ` (${formatFileSize(format.contentLength)})` : '';
            downloadButton.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Download ${quality}${size}
            `;
            downloadButton.disabled = false;
        } else {
            downloadButton.disabled = true;
            showError(`No ${selectedFormat} format available`);
        }
    });

    // Handle download button click
    downloadButton.addEventListener('click', () => {
        const selectedFormat = formatSelect.value;
        if (!selectedFormat) return;

        const format = availableFormats.find(f => 
            selectedFormat === 'video' ? f.hasVideo : !f.hasVideo
        );

        if (!format) return;

        // Create download link
        const a = document.createElement('a');
        a.href = `/api/download?v=${videoId}&itag=${format.itag}`;
        a.download = `${videoTitle.textContent}.${selectedFormat === 'video' ? 'mp4' : 'mp3'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

// Utility functions
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = parseInt(bytes);
    let unit = 0;
    
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }
    
    return `${size.toFixed(1)} ${units[unit]}`;
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    loading.style.display = 'none';
}

// Initialize the video player
initializeVideo(); 