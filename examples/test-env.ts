import { config } from 'dotenv';

config({ quiet: true });

console.log('Environment variables:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');
console.log('OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL);


