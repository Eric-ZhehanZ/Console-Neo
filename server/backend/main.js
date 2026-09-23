const { ClassicLevel } = require('classic-level');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const Conference = require('./conference');

const levelopt = {
  valueEncoding: 'json',
};

let DB_PATH = __dirname;
if(process.platform === 'darwin') {
  DB_PATH = app.getPath('userData');
  console.log('[INFO] MacOS detected, the db folder will be', DB_PATH);
}

try {
  fs.mkdirSync(DB_PATH);
} catch(err) { }
try {
  fs.mkdirSync(`${DB_PATH}/storage`);
} catch(err) {}

let main;
const confs = new Map();
let confList;

function init(cb) {
  try {
    fs.mkdirSync(path.join(DB_PATH, 'storage', 'main.db'));
  } catch(err) {}
  main = new ClassicLevel(path.resolve(DB_PATH, 'storage', 'main.db'), levelopt);
  main.open((err) => {
    if(err) return void cb(err);

    main.get('list', (err, list) => {
      if(err)
        if(err.notFound || err.code === 'LEVEL_NOT_FOUND') {
          confList = [];
          return void main.put('list', [], cb);
        } else return void cb(err);
      else {
        confList = list;
        for(const conf of list) {
          const db = new ClassicLevel(`${DB_PATH}/storage/${conf.id}.db`, levelopt);
          const filedir = `${DB_PATH}/storage/${conf.id}.files`;
          try {
            fs.mkdirSync(filedir);
          } catch(err) {}
          confs.set(conf.id, new Conference(conf.name, db, filedir));
        }
        return void cb(null);
      }
    });
  });
}

function shutdown(cb) {
  cb = cb || function noop() {};
  main.close((err) => {
    if(err) return void cb(err);
    else return void Promise.all([...confs.values()].map(e => new Promise((resolve, reject) =>
      e.db.close((err) => err ? reject(err) : resolve())
    ))).then(() => cb()).catch(cb);
  });
}

function add(name, cb) {
  const id = crypto.randomBytes(16).toString('hex');

  const db = new ClassicLevel(`${DB_PATH}/storage/${id}.db`, levelopt);
  const filedir = `${DB_PATH}/storage/${id}.files`;
  try {
    fs.mkdirSync(filedir);
  } catch(err) {}
  const instance = new Conference(name, db, filedir);
  instance.setup((err) => {
    if(err) return void cb(err);
    confs.set(id, instance);
    confList.push({ id, name, lastAccess: Date.now() });

    main.put('list', confList, (err) => err ? cb(err) : cb(null, id));
  });
}

function get(name) {
  if(confs.has(name)) return confs.get(name);
  return null;
}

function renameConf(id, name, cb) {
  const conf = confs.get(id);
  if(!conf) return void cb('NotFound');

  conf.name = name;
  for(const entry of confList) if(entry.id === id) {
    entry.name = name;
    break;
  }

  return void main.put('list', confList, cb);
}

function touch(id, cb) {
  for(const entry of confList) if(entry.id === id) {
    entry.lastAccess = Date.now();
    break;
  }
  main.put('list', confList, cb || (() => {}));
}

function _list() {
  return confList;
}

module.exports = {
  init,
  shutdown,
  add,
  get,
  renameConf,
  touch,
  list: _list,
};
