// Import Scheduled Jobs
import { startAuctionEndNotifier } from './scripts/auctionEndNotifier.js';
import app from './index.js';

const PORT = process.env.PORT || 3005;

app.listen(PORT, function () {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  // Start scheduled jobs
  startAuctionEndNotifier(30); // Check every 30 seconds for ended auctions
});