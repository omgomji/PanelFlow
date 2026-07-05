import { app } from './app';

const port = process.env.PORT || 5000;

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Backend server running on port ${port} (0.0.0.0)`);
});
