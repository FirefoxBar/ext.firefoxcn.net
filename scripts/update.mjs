import { access, constants, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function get(obj, path, defaultValue) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(path)) {
    return defaultValue;
  }
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }
  return current === undefined ? defaultValue : current;
}

function set(obj, path, value) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(path)) {
    return obj;
  }
  let current = obj;
  const length = path.length;
  for (let i = 0; i < length; i++) {
    const key = path[i];
    if (i === length - 1) {
      current[key] = value;
    } else {
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
  }
  return obj;
}

function isMock() {
  return process.env.INPUT_MOCK === 'true';
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
  } catch (e) {
    return false;
  }
  return true;
}

async function write(path, content) {
  const dir = dirname(path);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  if (isMock()) {
    console.log(`write ${path} with ${content}`);
    return;
  }
  return writeFile(path, content, 'utf8');
}

async function readJSON(path) {
  const content = await readFile(path, { encoding: 'utf8' });
  return JSON.parse(content.trim());
}

function writeJSON(path, json) {
  return write(path, JSON.stringify(json, undefined, 2));
}

async function processFirefoxUpdate(item, outputFolders, name, version) {
  // firefox
  let originalJson = {};
  for (const folder of outputFolders) {
    const baseJsonPath = join(folder, 'update.json');
    if (await exists(baseJsonPath)) {
      console.log(`read ${item.name} update file from ${baseJsonPath}`);
      originalJson = await readJSON(baseJsonPath);
      break;
    }
  }

  const newUpdate = {
    version: version,
    update_link: item.url,
    update_hash: `sha256:${item.hash}`,
  };
  if (item.min_version) {
    newUpdate.applications = {
      gecko: {
        strict_min_version: item.min_version,
      },
    };
  }

  const updates = get(originalJson, ['addons', item.id, 'updates']);
  if (!Array.isArray(updates)) {
    set(originalJson, ['addons', item.id, 'updates'], [newUpdate]);
  } else {
    updates.unshift(newUpdate);
    const minVersionMap = new Map();
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const minVersion = get(
        update,
        ['applications', 'gecko', 'strict_min_version'],
        'default',
      );
      if (minVersionMap.has(minVersion)) {
        updates.splice(i, 1);
        i--;
      } else {
        minVersionMap.set(minVersion, i);
      }
    }
  }
  for (const folder of outputFolders) {
    console.log(`write update.json to ${folder}`);
    await writeJSON(join(folder, 'update.json'), originalJson);
  }
}

async function processChromeUpdate(item, outputFolders, name, version) {
  const minVersionMark = item.min_version
    ? `prodversionmin="${item.min_version}" `
    : '';
  // chrome
  const content = `<?xml version='1.0' encoding='UTF-8'?><gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'><app appid='${item.id}'><updatecheck codebase='${item.url}' version='${version}' ${minVersionMark}/></app></gupdate>`;

  for (const folder of outputFolders) {
    console.log(`write update.xml to ${folder}`);
    await write(join(folder, 'update.xml'), content);
    if (name === 'xstyle') {
      // xStyle has multi xml
      await write(join(folder, 'updates.xml'), content);
    }
  }
}

async function main() {
  const name = process.env.INPUT_NAME;
  const version = process.env.INPUT_VERSION;
  const assets = JSON.parse(process.env.INPUT_ASSETS);

  const outputFolder = [join(__dirname, '../temp', name, 'install')];

  // Header Editor has multi output folders
  if (name === 'header-editor') {
    outputFolder.push(join(__dirname, '../temp/headereditor/install'));
  }

  for (const item of assets) {
    if (item.name.endsWith('.xpi')) {
      await processFirefoxUpdate(item, outputFolder, name, version);
    }

    if (item.name.endsWith('.crx')) {
      await processChromeUpdate(item, outputFolder, name, version);
    }
  }
}

main();
