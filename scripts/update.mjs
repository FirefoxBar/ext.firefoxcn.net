import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const name = process.env.NAME;
  const version = process.env.VERSION;
  const assets = JSON.parse(process.env.ASSETS);

  const outputFloder = [
    join(__dirname, '../temp', name),
  ];

  // Header Editor has multi output floders
  if (name === 'header-editor') {
    outputFloder.push(join(__dirname, '../temp/headereditor'));
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

      for (const floder of outputFloder) {
        console.log('write update.json to ' + floder);
        await writeFile(join(floder, 'update.json'), content, 'utf-8');
      }
    }

    if (item.name.endsWith('.crx')) {
      // chrome
      const content = `<?xml version='1.0' encoding='UTF-8'?><gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'><app appid='${item.id}'><updatecheck codebase='${item.url}' version='${version}' prodversionmin='64.0.3242' /></app></gupdate>`;

      for (const floder of outputFloder) {
        console.log('write update.xml to ' + floder);
        await writeFile(join(floder, 'update.xml'), content, 'utf-8');
        if (name === 'xstyle') {
          // xStyle has multi xml
          await writeFile(join(floder, 'updates.xml'), content, 'utf-8');
        }
      }
    }
  }

}

main();
