import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface FileEntry {
  name: string;
  key: string;
  customId: string | null;
  url: string;
  size: number;
  uploadedAt: string;
}

const OUTPUT_DIR = 'E:\\uploadthing-files\\ahmed-samir';
const JSON_FILES = [
  'selected-rows.json',
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

// Read and combine all JSON files
function loadAllFiles(): FileEntry[] {
  const allFiles: FileEntry[] = [];
  
  for (const jsonFile of JSON_FILES) {
    const filePath = path.join(process.cwd(), jsonFile);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: ${jsonFile} not found, skipping...`);
      continue;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const entries: FileEntry[] = JSON.parse(content);
      allFiles.push(...entries);
      console.log(`Loaded ${entries.length} entries from ${jsonFile}`);
    } catch (error) {
      console.error(`Error reading ${jsonFile}:`, error);
    }
  }
  
  return allFiles;
}

// Get unique filename, handling duplicates
function getUniqueFileName(fileName: string, key: string, existingFiles: Set<string>): string {
  if (!existingFiles.has(fileName)) {
    existingFiles.add(fileName);
    return fileName;
  }
  
  // File with same name exists, append key suffix
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  const uniqueName = `${baseName}_${key.substring(0, 8)}${ext}`;
  existingFiles.add(uniqueName);
  return uniqueName;
}

// Download a single file
async function downloadFile(
  entry: FileEntry, 
  index: number, 
  total: number,
  existingFiles: Set<string>
): Promise<{ success: boolean; skipped: boolean }> {
  const fileName = getUniqueFileName(entry.name, entry.key, existingFiles);
  const filePath = path.join(OUTPUT_DIR, fileName);
  
  // Skip if file already exists
  if (fs.existsSync(filePath)) {
    console.log(`[${index + 1}/${total}] Skipping ${fileName} (already exists)`);
    return { success: true, skipped: true };
  }
  
  try {
    console.log(`[${index + 1}/${total}] Downloading ${fileName} (${(entry.size / 1024 / 1024).toFixed(2)} MB)...`);
    
    const response = await axios({
      method: 'GET',
      url: entry.url,
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
    });
    
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve) => {
      writer.on('finish', () => {
        console.log(`[${index + 1}/${total}] ✓ Downloaded ${fileName}`);
        resolve({ success: true, skipped: false });
      });
      writer.on('error', (error) => {
        console.error(`[${index + 1}/${total}] ✗ Error downloading ${fileName}:`, error.message);
        // Clean up partial file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        resolve({ success: false, skipped: false });
      });
    });
  } catch (error: any) {
    console.error(`[${index + 1}/${total}] ✗ Error downloading ${fileName}:`, error.message);
    // Clean up partial file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: false, skipped: false };
  }
}

// Main function
async function main() {
  console.log('Starting download process...\n');
  
  // Load all files
  const allFiles = loadAllFiles();
  console.log(`\nTotal files to download: ${allFiles.length}\n`);
  
  if (allFiles.length === 0) {
    console.log('No files found to download.');
    return;
  }
  
  // Track existing files to handle duplicates
  const existingFiles = new Set<string>();
  
  // Pre-populate with files that already exist
  if (fs.existsSync(OUTPUT_DIR)) {
    const existingFileNames = fs.readdirSync(OUTPUT_DIR);
    existingFileNames.forEach(name => existingFiles.add(name));
  }
  
  // Download files with concurrency limit (5 at a time)
  const CONCURRENCY = 5;
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
    const batch = allFiles.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((entry, batchIndex) => {
        const globalIndex = i + batchIndex;
        return downloadFile(entry, globalIndex, allFiles.length, existingFiles).then((result) => {
          if (result.success) {
            if (result.skipped) {
              skipCount++;
            } else {
              successCount++;
            }
          } else {
            failCount++;
          }
        });
      })
    );
    
    // Small delay between batches to avoid overwhelming the server
    if (i + CONCURRENCY < allFiles.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Download Summary:');
  console.log(`Total files: ${allFiles.length}`);
  console.log(`Successfully downloaded: ${successCount}`);
  console.log(`Skipped (already exists): ${skipCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('='.repeat(50));
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

