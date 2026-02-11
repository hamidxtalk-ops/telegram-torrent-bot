import db from './database/sqlite.js';

async function test() {
    try {
        await db.init();
        console.log('DB Initialized');

        console.log('Creating user 12345...');
        const user = db.getOrCreateUser({ id: 12345, first_name: 'TestUser' });
        console.log('User created:', user);

        console.log('Checking user 12345 again (existing)...');
        const user2 = db.getOrCreateUser({ id: 12345, first_name: 'TestUser' });
        console.log('User retrieved:', user2);

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

test();
