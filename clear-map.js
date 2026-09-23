const fs = require('fs');
const path = require('path');

const packages = fs.readdirSync(path.join(__dirname, '/node_modules'));

/**
 * dfs
 * @author JieJiSS
 * @returns {void}
 * @param {string} parents
 * @param {string[]} entries
 */
function dfs(parents, entries) {
  for(let i = 0; i < entries.length; i++) {
    const subpath = path.join(parents, entries[i]);
    if(fs.lstatSync(subpath).isSymbolicLink()) {
      continue;
    } else if(fs.statSync(subpath).isDirectory()) {
      dfs(subpath, fs.readdirSync(subpath));
    } else if(entries[i].endsWith('.js.map')) {
      fs.unlinkSync(path.join(parents, entries[i]));
    }
  }
}

dfs(path.join(__dirname, '/node_modules'), packages);
