import { writeFile, readFile, access, constants, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
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

async function exists(path) {
  try {
    await access(dir, constants.F_OK);
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
  await writeFile(path, content, 'utf8');
}

async function readJSON(path) {
  const content = await readFile(path, { encoding: 'utf8' });
  return JSON.parse(content.trim());
}

function writeJSON(path, json) {
  return write(path, JSON.stringify(json, undefined, 2));
}

async function main() {
  const name = process.env.NAME;
  const version = process.env.VERSION;
  const assets = JSON.parse(process.env.ASSETS);

  const outputFolder = [
    join(__dirname, '../temp', name, 'install'),
  ];

  // Header Editor has multi output folders
  if (name === 'header-editor') {
    outputFolder.push(join(__dirname, '../temp/headereditor/install'));
  }

  for (const item of assets) {
    if (item.name.endsWith('.xpi')) {
      // firefox
      let originalJson = {};
      for (const folder of outputFolder) {
        const baseJsonPath = join(folder, 'update.json');
        if (await exists(baseJsonPath)) {
          console.log('read ' + item.name + ' update file from ' + baseJsonPath);
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
          }
        };
      }

      const updates = get(originalJson, ['addons', item.id, 'updates']);
      if (!Array.isArray(updates)) {
        set(originalJson, ['addons', item.id, 'updates'], [newUpdate]);
      } else {
        updates.unshift(newUpdate);
        // check strict_min_version, every strict_min_version only keep one
        for (let i = updates.length - 1; i > 0; i--) {
          if (get(updates[i], ['applications', 'gecko', 'strict_min_version']) === get(updates[i - 1], ['applications', 'gecko', 'strict_min_version'])) {
            updates.splice(i, 1);
          }
        }
      }
      for (const folder of outputFolder) {
        console.log('write update.json to ' + folder);
        await writeJSON(join(folder, 'update.json'), originalJson);
      }
    }

    if (item.name.endsWith('.crx')) {
      const minVersionMark = item.min_version ? `prodversionmin="${item.min_version}" ` : '';
      // chrome
      const content = `<?xml version='1.0' encoding='UTF-8'?><gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'><app appid='${item.id}'><updatecheck codebase='${item.url}' version='${version}' ${minVersionMark}/></app></gupdate>`;

      for (const folder of outputFolder) {
        console.log('write update.xml to ' + folder);
        await write(join(folder, 'update.xml'), content);
        if (name === 'xstyle') {
          // xStyle has multi xml
          await write(join(folder, 'updates.xml'), content);
        }
      }
    }
  }

}

main();
