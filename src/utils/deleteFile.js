import fs from 'fs';

const deleteFile = (filePath) => {
  try {
    fs.unlinkSync(filePath);    // remove the file
    } catch(err) {
    console.error(err);
    }
}

export {deleteFile}