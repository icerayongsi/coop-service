import express from 'express'
import { oracleExecute, POST_DEPT_INSERT_SERV_ONLINE, POST_DEPT_INSERT_TEST } from '#db/connection'
import { RequestFunction, convertNullToStringNull, convertUndefinedToEmptyString } from '#libs/Functions'
import { TRANSACTION as TRANS_CACHE } from '#cache/redis'
import { check_ref_no } from './functions.js'

const API = express.Router()
API.use(express.json())
API.use(express.urlencoded({
    extended: true,
    defer: true
}))

/**
 * NOTE : Protect HTTP type
 * @param { Request } req
 * @param { Response } res
 */

API.post('/verify', async (req, res) => {
    try {
        const body = req.body
        const { sigma_key, itemtype, bank_id, ...filteredData } = body
        await TRANS_CACHE.SETEX(
            `0:TRANSACTION:${req.body.itemtype}:${req.body.bank_id}:${sigma_key}`,
            2 * 60,
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
        await TRANS_CACHE.SETEX(
            `0:TRANSACTION:${cache_key_name}`,
            15,
            bindfiltered,
        )
            .then(async () => {
                console.log(`[TRANSACTION IN][PEOCESS] Start - ${cache_key_name}`)
                console.log(`[TRANSACTION IN][CACHED] Push PL/SQL arrgument - ${cache_key_name}`)
                const bind = JSON.parse(await TRANS_CACHE.GET(`0:TRANSACTION:${cache_key_name}`))

                for (const bindVar in bindParams) bindParams[bindVar].val = bind[bindVar]

                // NOTE : เช็ค deptslip จาก column ref_no ว่ามีการทำรายการนี้ไปหรือยัง
                const is_ref_no = await check_ref_no(bind.AS_MACHINE_ID)
                if (!is_ref_no) {
                    res.json({ AS_PROCESS_STATUS : false})
                    res.end()
                    throw `[TRANSACTION IN][PROCESS] Error - Duplicate 'ref_no'`
                }

                // NOTE : Start oracle statement
                await oracleExecute(query, convertUndefinedToEmptyString(bindParams))
                    .then(async (result) => {
                        console.log(`[TRANSACTION IN][PROCESS] Successfully - ${cache_key_name}`)
                        console.log(`[TRANSACTION IN][CACHED] Remove - ${cache_key_name}`)
                        await TRANS_CACHE.DEL(`0:TRANSACTION:${cache_key_name}`)
                        res.status(200).json(result.outBinds)
                        res.end()
                    })
                    // ! ไม่สำเร็จ จะทำการเปลี่ยน Status key ของ cache จาก 0 เป็น 1
                    // ? 1 จะเป็นการให้ Schedule ทำงาน 0 คือยังไม่ทำงานป้องกันโอกาศการพร้อมกัน ณ จุดนี้
                    .catch(async (err) => {
                        await TRANS_CACHE.SETEX(
                            `0:TRANSACTION:${cache_key_name}`,
                            15,
                            bindfiltered,
                        ).then(async () => await TRANS_CACHE.DEL(`1:TRANSACTION:${cache_key_name}`))
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