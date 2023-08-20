import express from 'express'
import config from "#configs/config" assert { type: 'json'}
import { oracleExecute, POST_DEPT_INSERT_SERV_ONLINE, POST_DEPT_INSERT_TEST } from '#db/connection'
import { convertUndefinedToEmptyString } from '#libs/Functions'
import { TRANSACTION } from '#cache/redis'

const API = express.Router()
API.use(express.json())
API.use(express.urlencoded({
    extended: true,
    defer: true
}))

API.post('/verify', async (req, res) => {
    try {
        const body = req.body
        const { sigma_key, itemtype, bank_id, ...filteredData } = body
        await TRANSACTION.SETEX(
            `TRANSACTION:${req.body.itemtype}:${req.body.bank_id}:${sigma_key}`,
            config.w_transaction_verify_exp,
            filteredData
        )
        console.log(`[TRANSACTION IN][CACHED] Verify successfully - ${req.body.itemtype}:${req.body.bank_id}:${sigma_key}`)
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
        let { sigma_key, ...bindfiltered } = req.body

        // NOTE : Update cache for PL/SQL arrgument
        await TRANSACTION.SETEX(
            `TRANSACTION:${cache_key_name}`,
            config.w_transaction_first_exp,
            bindfiltered,
        )
            .then(async () => {
                console.log(`[TRANSACTION IN][PEOCESS] Start - ${cache_key_name}`)
                console.log(`[TRANSACTION IN][CACHED] Push PL/SQL arrgument - ${cache_key_name}`)
                const bind = JSON.parse(await TRANSACTION.GET(`TRANSACTION:${cache_key_name}`))

                for (const bindVar in bindParams) bindParams[bindVar].val = bind[bindVar]

                // NOTE : Start oracle statement
                await oracleExecute(query, convertUndefinedToEmptyString(bindParams))
                    .then(async (result) => {
                        console.log(`[TRANSACTION IN][PROCESS] Successfully - ${cache_key_name}`)
                        console.log(`[TRANSACTION IN][CACHED] Remove - ${cache_key_name}`)
                        await TRANSACTION.DEL(`TRANSACTION:${cache_key_name}`)
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
                            bindfiltered
                        )
                            // ? ลบ Cache หลัก
                            .then(async () => {
                                await TRANSACTION.DEL(`TRANSACTION:${cache_key_name}`)
                            })
                        console.error(err)
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

API.post('/payment-test', async (req, res) => {
    const query = `
        BEGIN
            POST_DEPT_INSERT_SERV_TEST(
                AS_BANK_CODE => :AS_BANK_CODE
            );
        END;
    `
    const result = await oracleExecute(query, POST_DEPT_INSERT_TEST())
    console.log(result.outBinds)
    res.json(result.outBinds)
})

export default API