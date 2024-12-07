import parseConfig from './configparser';

import fs from 'fs';

const main = async () => {
  const config = await parseConfig('config.txt');
  console.log('Config', config);
};

main();
