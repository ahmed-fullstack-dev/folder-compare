const fs = require('fs');
const path = require('path');

class FolderComparator {
    constructor() {
        this.differences = {
            onlyInFirst: [],
            onlyInSecond: [],
            differentContent: [],
            sameContent: []
        };
    }

    /**
     * Compare two folders and return difference counts
     * @param {string} folder1 - Path to first folder
     * @param {string} folder2 - Path to second folder
     * @returns {Object} Comparison results with counts
     */
    async compareFolders(folder1, folder2) {
        console.log(`Comparing folders:`);
        console.log(`Folder 1: ${folder1}`);
        console.log(`Folder 2: ${folder2}`);
        console.log('---');

        // Reset differences
        this.differences = {
            onlyInFirst: [],
            onlyInSecond: [],
            differentContent: [],
            sameContent: []
        };

        try {
            // Get all files from both folders
            const files1 = await this.getAllFiles(folder1);
            const files2 = await this.getAllFiles(folder2);

            // Create relative path maps
            const map1 = this.createFileMap(files1, folder1);
            const map2 = this.createFileMap(files2, folder2);

            // Find differences
            await this.findDifferences(map1, map2, folder1, folder2);

            // Calculate counts
            const counts = this.calculateCounts();

            return {
                counts,
                details: this.differences,
                summary: this.generateSummary(counts)
            };

        } catch (error) {
            console.error('Error comparing folders:', error.message);
            throw error;
        }
    }

    /**
     * Recursively get all files in a directory
     * @param {string} dir - Directory path
     * @returns {Array} Array of file paths
     */
    async getAllFiles(dir) {
        const files = [];
        
        try {
            const items = await fs.promises.readdir(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = await fs.promises.stat(fullPath);
                
                if (stat.isDirectory()) {
                    const subFiles = await this.getAllFiles(fullPath);
                    files.push(...subFiles);
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
        }
        
        return files;
    }

    /**
     * Create a map of relative paths to file info
     * @param {Array} files - Array of absolute file paths
     * @param {string} baseDir - Base directory for relative paths
     * @returns {Map} Map of relative path to file info
     */
    createFileMap(files, baseDir) {
        const map = new Map();
        
        for (const file of files) {
            const relativePath = path.relative(baseDir, file);
            const stat = fs.statSync(file);
            
            map.set(relativePath, {
                absolutePath: file,
                size: stat.size,
                mtime: stat.mtime,
                relativePath: relativePath
            });
        }
        
        return map;
    }

    /**
     * Find differences between two file maps
     * @param {Map} map1 - File map from first folder
     * @param {Map} map2 - File map from second folder
     * @param {string} folder1 - First folder path
     * @param {string} folder2 - Second folder path
     */
    async findDifferences(map1, map2, folder1, folder2) {
        const allPaths = new Set([...map1.keys(), ...map2.keys()]);

        for (const relativePath of allPaths) {
            const file1 = map1.get(relativePath);
            const file2 = map2.get(relativePath);

            if (!file1) {
                // File only exists in second folder
                this.differences.onlyInSecond.push({
                    path: relativePath,
                    absolutePath: file2.absolutePath,
                    size: file2.size
                });
            } else if (!file2) {
                // File only exists in first folder
                this.differences.onlyInFirst.push({
                    path: relativePath,
                    absolutePath: file1.absolutePath,
                    size: file1.size
                });
            } else {
                // File exists in both folders - check content
                const isDifferent = await this.compareFileContent(file1.absolutePath, file2.absolutePath);
                
                if (isDifferent) {
                    this.differences.differentContent.push({
                        path: relativePath,
                        file1: file1,
                        file2: file2
                    });
                } else {
                    this.differences.sameContent.push({
                        path: relativePath,
                        size: file1.size
                    });
                }
            }
        }
    }

    /**
     * Compare content of two files
     * @param {string} file1 - Path to first file
     * @param {string} file2 - Path to second file
     * @returns {boolean} True if files are different
     */
    async compareFileContent(file1, file2) {
        try {
            const content1 = await fs.promises.readFile(file1);
            const content2 = await fs.promises.readFile(file2);
            
            return !content1.equals(content2);
        } catch (error) {
            console.warn(`Warning: Could not compare files ${file1} and ${file2}: ${error.message}`);
            return true; // Assume different if we can't compare
        }
    }

    /**
     * Calculate difference counts
     * @returns {Object} Counts of different types of differences
     */
    calculateCounts() {
        return {
            totalDifferences: this.differences.onlyInFirst.length + 
                             this.differences.onlyInSecond.length + 
                             this.differences.differentContent.length,
            onlyInFirst: this.differences.onlyInFirst.length,
            onlyInSecond: this.differences.onlyInSecond.length,
            differentContent: this.differences.differentContent.length,
            sameContent: this.differences.sameContent.length,
            totalFiles: this.differences.onlyInFirst.length + 
                       this.differences.onlyInSecond.length + 
                       this.differences.differentContent.length + 
                       this.differences.sameContent.length
        };
    }

    /**
     * Generate a summary of the comparison
     * @param {Object} counts - Count object
     * @returns {string} Summary text
     */
    generateSummary(counts) {
        return `
COMPARISON SUMMARY:
==================
Total files compared: ${counts.totalFiles}
Files with differences: ${counts.totalDifferences}
Files only in first folder: ${counts.onlyInFirst}
Files only in second folder: ${counts.onlyInSecond}
Files with different content: ${counts.differentContent}
Files with same content: ${counts.sameContent}
        `.trim();
    }

    /**
     * Print detailed results
     * @param {Object} results - Comparison results
     */
    printDetailedResults(results) {
        console.log(results.summary);
        console.log('\n');

        if (results.details.onlyInFirst.length > 0) {
            console.log('FILES ONLY IN FIRST FOLDER:');
            console.log('============================');
            results.details.onlyInFirst.forEach(file => {
                console.log(`  ${file.path} (${file.size} bytes)`);
            });
            console.log('\n');
        }

        if (results.details.onlyInSecond.length > 0) {
            console.log('FILES ONLY IN SECOND FOLDER:');
            console.log('=============================');
            results.details.onlyInSecond.forEach(file => {
                console.log(`  ${file.path} (${file.size} bytes)`);
            });
            console.log('\n');
        }

        if (results.details.differentContent.length > 0) {
            console.log('FILES WITH DIFFERENT CONTENT:');
            console.log('==============================');
            results.details.differentContent.forEach(file => {
                console.log(`  ${file.path}`);
                console.log(`    First folder: ${file.file1.size} bytes`);
                console.log(`    Second folder: ${file.file2.size} bytes`);
            });
            console.log('\n');
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node compare.js <folder1> <folder2> [--detailed]');
        console.log('');
        console.log('Arguments:');
        console.log('  folder1    Path to first folder');
        console.log('  folder2    Path to second folder');
        console.log('  --detailed Show detailed file-by-file differences');
        console.log('');
        console.log('Example:');
        console.log('  node compare.js ./folder1 ./folder2');
        console.log('  node compare.js ./folder1 ./folder2 --detailed');
        process.exit(1);
    }

    const folder1 = args[0];
    const folder2 = args[1];
    const showDetailed = args.includes('--detailed');

    // Check if folders exist
    try {
        const stat1 = await fs.promises.stat(folder1);
        const stat2 = await fs.promises.stat(folder2);
        
        if (!stat1.isDirectory()) {
            console.error(`Error: "${folder1}" is not a directory`);
            process.exit(1);
        }
        
        if (!stat2.isDirectory()) {
            console.error(`Error: "${folder2}" is not a directory`);
            process.exit(1);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }

    const comparator = new FolderComparator();
    
    try {
        const results = await comparator.compareFolders(folder1, folder2);
        
        console.log(results.summary);
    
        if (showDetailed) {
            console.log('\n');
            comparator.printDetailedResults(results);
        }
        process.exit(results.counts.totalDifferences > 0 ? 1 : 0);
    } catch (error) {
        console.error('Comparison failed:', error.message);
        process.exit(1);
    }
}

module.exports = FolderComparator;

// Run if called directly
if (require.main === module) {
    main();
}
