/**
 * Seedr API Service
 * Cloud-based torrent downloading for direct file access
 */

import axios from 'axios';

const SEEDR_API = 'https://www.seedr.cc/rest';

// Create authenticated client
function createClient() {
    const username = process.env.SEEDR_USERNAME;
    const password = process.env.SEEDR_PASSWORD;

    if (!username || !password) {
        throw new Error('SEEDR_USERNAME and SEEDR_PASSWORD environment variables are required');
    }

    return axios.create({
        baseURL: SEEDR_API,
        auth: {
            username,
            password
        },
        timeout: 30000,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}

/**
 * Add magnet link to Seedr
 * @returns {Promise<{id: number, name: string}>} Transfer info
 */
export async function addMagnet(magnetLink) {
    const client = createClient();

    console.log('🌱 Adding magnet to Seedr...');

    const response = await client.post('/transfer/magnet',
        `magnet=${encodeURIComponent(magnetLink)}`
    );

    if (response.data.error) {
        throw new Error(response.data.error);
    }

    console.log('✅ Magnet added to Seedr:', response.data);
    return response.data;
}

/**
 * Get folder contents
 * @param {number} folderId - Folder ID (empty for root)
 */
export async function getFolder(folderId = '') {
    const client = createClient();
    const endpoint = folderId ? `/folder/${folderId}` : '/folder';

    const response = await client.get(endpoint);
    return response.data;
}

/**
 * Wait for torrent download to complete
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{folder: object, files: array}>}
 */
export async function waitForDownload(onProgress = null, maxWaitMs = 600000) {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds

    console.log('⏳ Waiting for Seedr download...');

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const folder = await getFolder();

            // Check if there's an active transfer
            if (folder.transfers && folder.transfers.length > 0) {
                const transfer = folder.transfers[0];
                const progress = transfer.progress || 0;

                if (onProgress) {
                    onProgress(progress, transfer.name);
                }

                console.log(`📥 Download progress: ${progress}%`);

                // 100% = downloaded, 101% = moved to folder
                if (progress >= 100) {
                    // Wait a bit for file to be ready
                    await sleep(2000);
                    break;
                }
            }

            // Check if download completed and folder has files
            if (folder.folders && folder.folders.length > 0) {
                const subFolder = folder.folders[0];
                const subFolderContents = await getFolder(subFolder.id);

                if (subFolderContents.files && subFolderContents.files.length > 0) {
                    console.log('✅ Download complete!');
                    return {
                        folder: subFolder,
                        files: subFolderContents.files
                    };
                }
            }

            // Also check root files
            if (folder.files && folder.files.length > 0) {
                console.log('✅ Download complete! (root file)');
                return {
                    folder: null,
                    files: folder.files
                };
            }

        } catch (error) {
            console.error('Error checking download status:', error.message);
        }

        await sleep(pollInterval);
    }

    throw new Error('Download timeout - took too long');
}

/**
 * Get direct download URL for a file
 */
export async function getFileUrl(fileId) {
    const client = createClient();

    // The file endpoint returns the download URL when accessed with proper auth
    const response = await client.get(`/file/${fileId}`, {
        maxRedirects: 0,
        validateStatus: (status) => status === 200 || status === 302
    });

    // If we get a redirect, that's the download URL
    if (response.status === 302 && response.headers.location) {
        return response.headers.location;
    }

    // Otherwise, construct the URL manually
    const username = process.env.SEEDR_USERNAME;
    const password = process.env.SEEDR_PASSWORD;
    return `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@www.seedr.cc/rest/file/${fileId}`;
}

/**
 * Delete a file from Seedr
 */
export async function deleteFile(fileId) {
    const client = createClient();

    console.log(`🗑️ Deleting file ${fileId} from Seedr...`);

    const response = await client.post(`/file/${fileId}/delete`);
    console.log('✅ File deleted');
    return response.data;
}

/**
 * Delete a folder from Seedr
 */
export async function deleteFolder(folderId) {
    const client = createClient();

    console.log(`🗑️ Deleting folder ${folderId} from Seedr...`);

    const response = await client.post(`/folder/${folderId}/delete`);
    console.log('✅ Folder deleted');
    return response.data;
}

/**
 * Get user account info
 */
export async function getAccountInfo() {
    const client = createClient();
    const response = await client.get('/user');
    return response.data;
}

/**
 * Clean up all files and folders in Seedr
 */
export async function cleanupAll() {
    try {
        const folder = await getFolder();

        // Delete all folders
        if (folder.folders) {
            for (const f of folder.folders) {
                await deleteFolder(f.id);
            }
        }

        // Delete all files
        if (folder.files) {
            for (const file of folder.files) {
                await deleteFile(file.id);
            }
        }

        console.log('✅ Seedr cleanup complete');
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}

/**
 * Full download flow - add magnet, wait, get file, cleanup
 */
export async function downloadTorrent(magnetLink, onProgress = null) {
    // First cleanup any existing files
    await cleanupAll();

    // Add the magnet
    await addMagnet(magnetLink);

    // Wait for download
    const result = await waitForDownload(onProgress);

    // Find the video file (largest file, or .mp4/.mkv/.avi)
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm'];
    let videoFile = null;

    for (const file of result.files) {
        const fileName = file.name.toLowerCase();
        if (videoExtensions.some(ext => fileName.endsWith(ext))) {
            if (!videoFile || file.size > videoFile.size) {
                videoFile = file;
            }
        }
    }

    // If no video found, take the largest file
    if (!videoFile && result.files.length > 0) {
        videoFile = result.files.reduce((a, b) => a.size > b.size ? a : b);
    }

    if (!videoFile) {
        throw new Error('No video file found in torrent');
    }

    // Get download URL
    const downloadUrl = await getFileUrl(videoFile.id);

    return {
        file: videoFile,
        url: downloadUrl,
        folder: result.folder,
        cleanup: async () => {
            // Cleanup after download is complete
            if (result.folder) {
                await deleteFolder(result.folder.id);
            } else {
                await deleteFile(videoFile.id);
            }
        }
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    addMagnet,
    getFolder,
    waitForDownload,
    getFileUrl,
    deleteFile,
    deleteFolder,
    getAccountInfo,
    cleanupAll,
    downloadTorrent
};
