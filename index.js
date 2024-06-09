const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const port = 3001;

const BASE_PATH = "C:\\\\root";

app.use(bodyParser.json());
app.use(
  cors({
    origin: "http://127.0.0.1:5500/filemanger-main/",
  })
);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const parentFolderPath = req.query.parentFolderPath || BASE_PATH;
    cb(null, parentFolderPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// Multer upload instance
const upload = multer({ storage: storage });

// Function to recursively get folder structure
function getFolderStructure(parentFolderPath) {
  const contents = fs.readdirSync(parentFolderPath, { withFileTypes: true });

  const folders = contents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const files = contents
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name);

  const images = files.filter((fileName) =>
    /\.(jpg|jpeg|png|gif)$/i.test(fileName)
  );

  const videos = files.filter((fileName) =>
    /\.(mp4|mov|avi|mkv)$/i.test(fileName)
  );

  return { folders, files, images, videos };
}

// Home route
app.get("/", (req, res) => {
  res.send("hello");
});

// Endpoint to create folder

app.post("/create-folder", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { folderName, parentFolderPath } = req.body;
  let folderPath;

  if (parentFolderPath) {
    folderPath = path.join(parentFolderPath, folderName);
  } else {
    folderPath = path.join(BASE_PATH, folderName);
  }

  try {
    fs.mkdirSync(folderPath, { recursive: true });
    res.json({ message: `Folder created at: ${folderPath}`, folderPath });
  } catch (err) {
    res.status(500).json({ error: "Error creating folder", details: err });
  }
});

// Endpoint to upload file
app.post("/upload-file", upload.single("fileUpload"), (req, res) => {
  res.json({ message: "File uploaded successfully" });
});

// Endpoint to create a file
app.post("/create-file", (req, res) => {
  const { parentFolderPath, fileName } = req.query;
  const filePath = path.join(parentFolderPath || BASE_PATH, fileName);

  fs.writeFile(filePath, "", (err) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Error creating file", details: err });
    }
    res.json({ message: `File created at: ${filePath}` });
  });
});

// Endpoint to get folder structure
app.get("/get-folder-structure", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const parentFolderPath = req.query.parentFolderPath || BASE_PATH;
  const folderStructure = getFolderStructure(parentFolderPath);
  res.json(folderStructure);
});

// Endpoint to serve individual files
app.get("/get-file", (req, res) => {
  const { filePath } = req.query;
  try {
    fs.statSync(filePath); // Check if the file exists
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: "File not found" });
  }
});

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
    return true;
  }
  return false;
}

// Endpoint to delete folder
app.delete("/delete-folder/:folderPath", (req, res) => {
  const folderPath = decodeURIComponent(req.params.folderPath);
  if (!folderPath) {
    return res.status(400).send("Folder path is required");
  }

  try {
    deleteFolderRecursive(folderPath);
    res.send(`Folder deleted successfully: ${folderPath}`);
  } catch (error) {
    res.status(500).send(`Error deleting folder: ${error.message}`);
  }
});

// Endpoint to remove file
app.delete("/remove-file", (req, res) => {
  const { fileName } = req.query;

  if (!fileName) {
    return res.status(400).json({ error: "File name is required" });
  }

  const decodedFileName = decodeURIComponent(fileName);

  if (
    path.isAbsolute(decodedFileName) &&
    decodedFileName.startsWith(BASE_PATH)
  ) {
    fs.unlink(decodedFileName, function (err) {
      if (err) {
        return res
          .status(500)
          .json({ error: "Error deleting file", details: err });
      } else {
        return res.json({
          message: "File has been deleted",
          filePath: decodedFileName,
        });
      }
    });
  } else {
    return res.status(400).json({ error: "Invalid file path" });
  }
});

// Endpoint to change folder name
app.put("/change-folder-name", (req, res) => {
  const { selectedFolder, newFolderName, folderPath } = req.body;

  if (!selectedFolder || !newFolderName || !folderPath) {
    return res.status(400).json({
      error: "Selected folder, new folder name, and folder path are required",
    });
  }
  const currPath = path.join(folderPath, selectedFolder);
  const newPath = path.join(folderPath, newFolderName);
  try {
    fs.renameSync(currPath, newPath);
    return res.json({ message: "Successfully renamed the directory." });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error renaming directory", details: err.message });
  }
});

// Endpoint to change file name
app.put("/change-file-name", (req, res) => {
  const { filedata, newFileName } = req.body;

  if (!filedata || !newFileName) {
    return res
      .status(400)
      .json({ error: "Both file path and new file name are required" });
  }

  const filePath = filedata;
  const newFilePath = path.join(path.dirname(filePath), newFileName);

  try {
    fs.renameSync(filePath, newFilePath);
    return res.json({
      message: `Successfully renamed the file to ${newFileName}`,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error renaming file", details: err.message });
  }
});

// Endpoint to list files and folders matching letters
app.get("/list-files-and-folder", (req, res) => {
  let { letters } = req.query;

  if (!letters || letters.length === 0) {
    return res.status(400).json({
      error: "Invalid input. Please provide at least one letter.",
    });
  }

  letters = Array.isArray(letters) ? letters : [letters];

  const results = listFilesAndFoldersMatchingLetters(BASE_PATH, letters);
  res.json({ filesAndFolders: results });
});

function listFilesAndFoldersMatchingLetters(directoryPath, letters) {
  try {
    const contents = fs.readdirSync(directoryPath, { withFileTypes: true });
    const results = [];

    contents.forEach((item) => {
      const fullPath = path.join(directoryPath, item.name);

      if (startsWithLetters(item.name, letters)) {
        results.push({ name: item.name, path: fullPath });
      }

      if (item.isDirectory()) {
        const subResults = listFilesAndFoldersMatchingLetters(
          fullPath,
          letters
        );
        results.push(...subResults);
      }
    });

    return results;
  } catch (error) {
    return [];
  }
}

function startsWithLetters(name, letters) {
  return letters.every((letter) => name.includes(letter));
}

// Endpoint to get files as base64
app.get("/get-files-base64", (req, res) => {
  const filePath = req.query.filePath;
  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Error reading file", details: err.message });
    }
    const base64 = Buffer.from(data, "binary").toString("base64");
    res.json({ base64: base64 });
  });
});

// Endpoint to open folder
app.get("/open-folder", async (req, res) => {
  const { folderName } = req.query;

  try {
    const sanitizedFolderName = sanitizeFolderPath(folderName);
    const folderPath = path.resolve(BASE_PATH, sanitizedFolderName);

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const folderStats = await fs.promises.stat(folderPath);
    if (!folderStats.isDirectory()) {
      return res.status(400).json({ error: "Not a directory" });
    }

    const folderContents = await fs.promises.readdir(folderPath);

    res.json({ folderContents });
  } catch (error) {
    res.status(500).json({ error: "Failed to open folder" });
  }
});

function sanitizeFolderPath(folderPath) {
  const sanitizedPath = path.normalize(folderPath).replace(/^(\.\.[/\\])+/, "");
  return sanitizedPath;
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
