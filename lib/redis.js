import { createClient } from 'redis';

let redis = null;
let connecting = false;

export async function getRedis() {
  if (redis && redis.isOpen) {
    return redis;
  }
  
  // Prevent multiple simultaneous connections
  if (connecting) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedis();
  }
  
  connecting = true;
  
  try {
    redis = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Redis connection failed');
          }
          return retries * 100;
        }
      }
    });
    
    redis.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });
    
    redis.on('connect', () => {
      console.log('🔄 Redis connecting...');
    });
    
    redis.on('ready', () => {
      console.log('✅ Redis ready');
    });
    
    await redis.connect();
    console.log('✅ Connected to Redis');
    
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    redis = null;
  } finally {
    connecting = false;
  }
  
  return redis;
}

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export async function getState(sender) {
  try {
    const client = await getRedis();
    if (!client) {
      console.error('❌ Redis client not available');
      return getDefaultState();
    }
    
    const data = await client.get(`user:${sender}`);
    
    if (data) {
      const state = JSON.parse(data);
      
      if (Date.now() - state.lastActivity > SESSION_TIMEOUT) {
        console.log(`⏰ Session expired for ${sender}`);
        return {
          lang: state.lang || "ru",
          step: "start",
          org: null,
          prevStep: null,
          lastActivity: Date.now(),
          isFirstVisit: false
        };
      }
      console.log(`✅ State loaded for ${sender}:`, state.step);
      return state;
    }
    
    console.log(`🆕 New user: ${sender}`);
    return getDefaultState();
    
  } catch (error) {
    console.error('❌ Error getting state from Redis:', error);
    return getDefaultState();
  }
}

function getDefaultState() {
  return {
    lang: "ru",
    step: "start",
    org: null,
    prevStep: null,
    lastActivity: Date.now(),
    isFirstVisit: true
  };
}

export async function setState(sender, state) {
  try {
    const client = await getRedis();
    if (!client) {
      console.error('❌ Redis client not available for setState');
      return;
    }
    
    state.lastActivity = Date.now();
    
    await client.set(
      `user:${sender}`,
      JSON.stringify(state),
      { EX: 30 * 24 * 60 * 60 }
    );
    
    console.log(`✅ State saved for ${sender}:`, state.step);
  } catch (error) {
    console.error('❌ Error setting state to Redis:', error);
  }
}

export async function deleteState(sender) {
  try {
    const client = await getRedis();
    if (!client) {
      console.error('❌ Redis client not available for deleteState');
      return;
    }
    
    await client.del(`user:${sender}`);
    console.log(`✅ State deleted for ${sender}`);
  } catch (error) {
    console.error('❌ Error deleting state from Redis:', error);
  }
}