import db from './database/sqlite.js';

console.log('Methods on db instance:');
try {
    const proto = Object.getPrototypeOf(db);
    console.log(Object.getOwnPropertyNames(proto));
} catch (e) {
    console.error(e);
}
