// Simple test for API endpoints
import app from './index';

// Test the health endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

export default app; 