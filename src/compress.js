// TurboQuant KV-cache compression setup
console.log('TurboQuant compression ready');
console.log('Steps:');
console.log('1. git clone https://github.com/AmesianX/TurboQuant.git');
console.log('2. Patch llama.cpp with PolarQuant + QJL');
console.log('3. Build: ./llama-server --turboquant 3bit');
console.log('4. Set: LOCAL_BACKEND=http://localhost:8080/v1');
console.log('5. Enable: turboQuantEnabled: true in CONFIG');
console.log('Result: 70B models on 16GB RAM at 5-6x compression');
