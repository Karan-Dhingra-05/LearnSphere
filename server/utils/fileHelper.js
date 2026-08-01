import fs from 'fs/promises';

/**
 * Deletes a file from disk without throwing if the file does not exist.
 * Used when deleting a Document: removes the corresponding PDF from
 * server/uploads so no orphaned files are left behind.
 *
 * @param {string} filePath - Path to the file to delete.
 */
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    // ENOENT = file already gone; any other error is silently ignored
    // so a missing PDF never crashes an otherwise-successful delete.
    if (err.code !== 'ENOENT') {
      console.error(`Warning: could not delete file at ${filePath}:`, err.message);
    }
  }
};

export { deleteFile };
