import { createClient } from 'redis';

let redis = null;

export async function getRedis() {
  if (!redis) {
    redis = createClient({
      url: process.env.REDIS_URL
    });
    
    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    await redis.connect();
    console.log('✅ Connected to Redis');
  }
  
  return redis;
}

// Session timeout constant
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Get user state from Redis
export async function getState(sender) {
  try {
    const client = await getRedis();
    const data = await client.get(`user:${sender}`);
    
    if (data) {
      const state = JSON.parse(data);
      
      // Check session timeout
      if (Date.now() - state.lastActivity > SESSION_TIMEOUT) {
        return {
          lang: state.lang || "ru",
          step: "start",
          org: null,
          prevStep: null,
          lastActivity: Date.now(),
          isFirstVisit: false
        };
      }
      return state;
    }
  } catch (error) {
    console.error('❌ Error getting state from Redis:', error);
  }
  
  // Default state for new users
  return {
    lang: "ru",
    step: "start",
    org: null,
    prevStep: null,
    lastActivity: Date.now(),
    isFirstVisit: true
  };
}

// Save user state to Redis
export async function setState(sender, state) {
  try {
    const client = await getRedis();
    state.lastActivity = Date.now();
    
    await client.set(
      `user:${sender}`,
      JSON.stringify(state),
      { EX: 30 * 24 * 60 * 60 } // Expire after 30 days (in seconds)
    );
    
    console.log(`✅ State saved for ${sender}`);
  } catch (error) {
    console.error('❌ Error setting state to Redis:', error);
  }
}

// Delete user state from Redis
export async function deleteState(sender) {
  try {
    const client = await getRedis();
    await client.del(`user:${sender}`);
    console.log(`✅ State deleted for ${sender}`);
  } catch (error) {
    console.error('❌ Error deleting state from Redis:', error);
  }
}