import parseConfig from './configparser';

import fs from 'fs';

const main = () => {
  const config = parseConfig('config.txt');
  console.log('Config', config);
};

main();
