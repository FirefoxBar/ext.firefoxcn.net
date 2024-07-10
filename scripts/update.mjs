import { writeFile, access, constants, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function write(path, content) {
  const dir = dirname(path);
  try {
    await access(dir, constants.F_OK);
  } catch (e) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, content, 'utf-8');
}

async function main() {
  const name = process.env.NAME;
  const version = process.env.VERSION;
  const assets = JSON.parse(process.env.ASSETS);

  const outputFolder = [
    join(__dirname, '../temp', name),
  ];

  // Header Editor has multi output folders
  if (name === 'header-editor') {
    outputFolder.push(join(__dirname, '../temp/headereditor'));
  }

  for (const item of assets) {
    if (item.name.endsWith('.xpi')) {
      // firefox
      const content = JSON.stringify({
        addons: {
          [item.id]: {
            updates: [{
              version: version,
              update_link: item.url,
              update_hash: `sha256:${item.hash}`,
            }]
          }
        }
      });

      for (const folder of outputFolder) {
        console.log('write update.json to ' + folder);
        await write(join(folder, 'update.json'), content);
      }
    }

    if (item.name.endsWith('.crx')) {
      // chrome
      const content = `<?xml version='1.0' encoding='UTF-8'?><gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'><app appid='${item.id}'><updatecheck codebase='${item.url}' version='${version}' prodversionmin='64.0.3242' /></app></gupdate>`;

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
