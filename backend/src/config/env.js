const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '../..');

// Load standard .env first, then the student-friendly backend.env fallback.
// Existing process.env values are not overridden.
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, 'backend.env') });
