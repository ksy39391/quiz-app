const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../public/data');
const files = fs.readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'questions.json')
  .map(f => f.replace('.json', ''))
  .sort();

fs.writeFileSync(
  path.join(dataDir, 'index.json'),
  JSON.stringify(files, null, 2)
);

console.log('Generated index.json:', files);
