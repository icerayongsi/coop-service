import express from 'express'
import config from "#configs/config" assert { type: 'json'}
import { oracleExecute, POST_DEPT_INSERT_SERV_ONLINE } from '#db/connection'
import { convertUndefinedToEmptyString } from '#libs/Functions'
import { TRANSACTION } from '#cache/redis'

const API = express.Router()
API.use(express.json())
API.use(express.urlencoded({
    extended: true,
    defer: true
}))

API.post('/set-cache', async (req, res) => {
    try {
        const { sigma_key, ...filteredData } = req.body
        await TRANSACTION.SETEX(
            `TRANSACTION:${req.body.AS_SLIPITEMTYPE_CODE}:${req.body.AS_BANK_CODE}:${sigma_key}`,
            config.w_transaction_verify_exp,
            filteredData
        )
        console.log(`[TRANSACTION IN][CACHED] Set cached successfully - ${req.body.AS_SLIPITEMTYPE_CODE}:${req.body.AS_BANK_CODE}:${sigma_key}`)
    } catch (error) {
        console.error(`[TRANSACTION IN][CACHE] Error ${req.route.path} - ${error}`)
    }
    res.end()
})

API.post('/payment', async (req, res) => {
    try {
        // NOTE : Init variable/Model PL/SQL and body
        const bindParams = POST_DEPT_INSERT_SERV_ONLINE.model
        const query = POST_DEPT_INSERT_SERV_ONLINE.query_str
        const cache_key_name = `${req.body.AS_SLIPITEMTYPE_CODE}:${req.body.AS_BANK_CODE}:${req.body.sigma_key}`

        // NOTE : Get cache for PL/SQL arrgument
        await TRANSACTION.GET(`TRANSACTION:${cache_key_name}`)
            .then(async (bind) => {
                console.log(`[TRANSACTION IN][PEOCESS] Start - ${cache_key_name}`)
                console.log(`[TRANSACTION IN][CACHED] Push PL/SQL arrgument - ${cache_key_name}`)

                bind = JSON.parse(bind)
                for (const bindVar in bindParams) bindParams[bindVar].val = bind[bindVar]

                // NOTE : Start oracle statement
                await oracleExecute(query, convertUndefinedToEmptyString(bindParams))
                    .then(async (result) => {
                        console.log(`[TRANSACTION IN][PROCESS] Successfully - ${cache_key_name}`)
                        console.log(`[TRANSACTION IN][CACHED] Remove - ${cache_key_name}`)
                        await TRANSACTION.DEL(`TRANSACTION:${cache_key_name}`)
                        console.log(result.outBinds)
                        res.status(200).json(result.outBinds)
                        res.end()
                    })
                    // ! ไม่สำเร็จ จะเข้าสู่ Process cache
                    // ? สร้าง Cache 2 ตัว 1 ตัวนับหมดเวลา อีกตัวเก็บข้อมูล
                    .catch(async (err) => {
                        // ? Cache เปล่า ตั้งเวลา 5 วิ
                        await TRANSACTION.SETEX(
                            `EX:0:TRANSACTION:${req.body.AS_SLIPITEMTYPE_CODE}:${req.body.AS_BANK_CODE}:${bind.AS_MACHINE_ID}`,
                            config.w_transaction_redis_count_exp,
                            '',
                        )
                        // ? Cache เก็บข้อมูล ตั้งเวลา 1 ชั่วโมงเพื่อปกกันการค้างใน Cache
                        await TRANSACTION.SETEX(
                            `TRANSACTION:${req.body.AS_SLIPITEMTYPE_CODE}:${req.body.AS_BANK_CODE}:${bind.AS_MACHINE_ID}`,
                            config.w_transaction_arg_data_exp,
                            bind
                        )
                            // ? ลบ Cache หลัก
                            .then(async () => {
                                await TRANSACTION.DEL(`TRANSACTION:${cache_key_name}`)
                            })
                        console.error(err)
                        res.status(200).json({AS_PROCESS_STATUS : false})
                        res.end()
                    })
                // NOTE : End oracle statement
            })
            .catch((e) => {
                console.error(`[TRANSACTION IN][CACHED] ${e} - ${cache_key_name}`)
            })

    } catch (err) {
        console.error('Error in /verify endpoint: ', err)
        res.status(500).json({ error: 'An error occurred' })
    }
})

API.post('/re-payment' , async (req,res) => {
    try {
        
    } catch (error) {
        
    }
})

export default API