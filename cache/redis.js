import { createClient } from 'redis'
import moment from 'moment'

const Client = createClient({
    host: 'localhost',
    port: 6379,        
    password: 'Fs#5132Xcza' 
})

Client.on('error', err => console.log('Redis Client Error', err))

export const Startup_Config = async () => {
    await Client.connect()
    if (Client.isOpen) {
        Client.configSet("notify-keyspace-events", "Ex")
        console.log("[Redis] Client Listening on PORT =>", 6379)
    }
    const sub = Client.duplicate()
    await sub.connect()

    sub.subscribe("__keyevent@0__:expired", async (key) => {
        //const payload = await Client.get(`${key}:EX`)
        console.log('[CACHE EXPIRED] =>',key)
        //await Client.del(`${key}:EX`)
    })
}

export const cron_status_actions = {
    async GET (coop_name) {
        return await Client.get(`CRON_${coop_name.toUpperCase()}:STATUS`)
    },
    async SET (coop_name,processing) {
        await Client.set(`CRON_${coop_name.toUpperCase()}:STATUS`,processing)
        return true
    }
}

export const get_init_config = async (bank) => {
    return await Client.get(`INIT_CONFIGS:${bank}`)
}

export const BUFFER_QUERY = async (query) => {
    return await Client.keys(`*${query}*`)
}

// ===== Transection ====== //

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
