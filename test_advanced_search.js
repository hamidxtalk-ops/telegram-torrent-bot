import fetch from 'node-fetch';

async function testAdvancedSearch() {
    const query = 'Interstellar';
    const year = '2014';
    const url = `http://localhost:3000/api/search?q=${encodeURIComponent(query)}&year=${encodeURIComponent(year)}`;

    console.log(`Testing: ${url}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const movie = data.results[0];
            console.log(`✅ Success! Found: ${movie.title} (${movie.year})`);
            if (movie.year == year) {
                console.log('✅ Year match confirmed.');
            } else {
                console.log(`❌ Year mismatch: expected ${year}, got ${movie.year}`);
            }
        } else {
            console.log('❌ No results found.');
        }
    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

testAdvancedSearch();
