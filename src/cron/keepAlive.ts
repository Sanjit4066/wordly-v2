import cron from 'node-cron';

export const startKeepAlive = () => {
  // Ping the server every 14 minutes to prevent free tier hosting (e.g. Render) from spinning down.
  // Render spins down free web services after 15 minutes of inactivity.
  // By sending an external HTTP request to itself, it resets the inactivity timer.
  cron.schedule('*/14 * * * *', async () => {
    try {
      // Use RENDER_EXTERNAL_URL if available (Render provides this automatically),
      // otherwise fallback to a generic localhost URL.
      // NOTE: The fallback to localhost won't prevent sleep on the cloud, 
      // so make sure RENDER_EXTERNAL_URL is correct if hosted on Render.
      const backendUrl = process.env.RENDER_EXTERNAL_URL 
        ? `${process.env.RENDER_EXTERNAL_URL}/health` 
        : process.env.BACKEND_URL
          ? `${process.env.BACKEND_URL}/health`
          : `http://localhost:${process.env.PORT || 5000}/health`;

      console.log(`\n[Keep-Alive] ⏰ Pinging server to keep awake: ${backendUrl}`);
      
      const response = await fetch(backendUrl);
      
      if (response.ok) {
        console.log(`[Keep-Alive] ✅ Success: Server is awake.`);
      } else {
        console.warn(`[Keep-Alive] ⚠️ Failed: Status ${response.status}`);
      }
    } catch (error) {
      console.error(`[Keep-Alive] ❌ Error during ping:`, error instanceof Error ? error.message : error);
    }
  });
};
