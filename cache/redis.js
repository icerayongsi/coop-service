import { createClient } from 'redis'
import { process_cache } from './process.js'
import config from "#configs/config" assert { type: 'json'}

const Client = createClient({
    ...config.redis
})

Client.on('error', err => console.log('Redis Client Error', err))

export const Startup_Config = async () => {
    await Client.connect()
    if (Client.isOpen) {
        Client.configSet("notify-keyspace-events", "Ex")

        // ? Start process cache
        process_cache(Client.duplicate())

        console.log("[Redis] Client Listening on PORT =>", config.redis.port)
    }
}

export const BUFFER_QUERY = async (query) => {
    return await Client.keys(`*${query}*`)
}

/**
 * ? TRANSACTION CACHE FUNCTIONS
 * @typedef { object } TRANSACTION
 * 
 */

export const TRANSACTION = { 
    async SET (key,value) {
        await Client.set(key,JSON.stringify(value))
        return true
    },
    async SETEX (key,expire,value) {
        await Client.setEx(key,expire,JSON.stringify(value))
        return true
    },
    async GET (key) {
        return Client.get(key)
    },
    async DEL (key) {
        await Client.del(key)
        return true
    }
} 
