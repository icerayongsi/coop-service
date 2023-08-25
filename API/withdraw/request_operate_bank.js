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

API.post('/payment-test', async (req, res) => {
    console.log('test')
    const query = `
        BEGIN
            POST_DEPT_INSERT_SERV_ONLINE(
                AS_BANK_CODE=>:AS_BANK_CODE,
                AS_MEMBER_NO=>:AS_MEMBER_NO,
                AS_DEPTACCOUNT_NO=>:AS_DEPTACCOUNT_NO ,
                AS_MEMBCAT_CODE=>:AS_MEMBCAT_CODE,
                AS_COOP_ID=>:AS_COOP_ID,
                AS_DEPTCOOP_ID=>:AS_DEPTCOOP_ID,
                AS_DEPTTYPE_CODE=>:AS_DEPTTYPE_CODE ,
                AS_DEPTGROUP_CODE=>:AS_DEPTGROUP_CODE ,
                AS_OPERATE_DATE=>:AS_OPERATE_DATE ,
                AS_ENTRY_DATE=>:AS_ENTRY_DATE,
                AS_ENTRY_ID=>:AS_ENTRY_ID ,
                AS_OPERATE_CODE=>:AS_OPERATE_CODE,
                AS_SLIPITEMTYPE_CODE=>:AS_SLIPITEMTYPE_CODE,
                AS_SIGN_FLAG_=>:AS_SIGN_FLAG,
                AS_ITEM_AMT_=>:AS_ITEM_AMT ,
                AS_MONEYTYPE_CODE=>:AS_MONEYTYPE_CODE,
                AS_MACHINE_ID=>:AS_MACHINE_ID,
                AS_FEE_AMT_=>:AS_FEE_AMT ,
                AS_TOFROMACCID=>:AS_TOFROMACCID,
                AS_OTH_AMT_=>:AS_OTH_AMT,
                AS_PRNCBAL_=>:AS_PRNCBAL ,
                AS_WITHDRAWABLE_AMT_=>:AS_WITHDRAWABLE_AMT,
                AS_LASTSTMSEQ_NO_=>:AS_LASTSTMSEQ_NO ,
                AS_ACTION_STATUS_=>:AS_ACTION_STATUS,
                AS_POST_STATUS_=>:AS_POST_STATUS,
                AS_DEPTSLIP_NO=>:AS_DEPTSLIP_NO,
                AS_DEPTSLIP_NO_FEE=>:AS_DEPTSLIP_NO_FEE,
                AS_DEPTSLIP_NO_OTH=>:AS_DEPTSLIP_NO_OTH,
                AS_PROCESS_STATUS=>:AS_PROCESS_STATUS
            );
        END;`

    const model = {
        AS_BANK_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 3, val: '006' },
        AS_MEMBER_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 8, val: '00262156' },
        AS_DEPTACCOUNT_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '0100260930' },
        AS_MEMBCAT_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 6, val: '10' },
        AS_COOP_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 6, val: '008001' },
        AS_DEPTCOOP_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10, val: '008001' },
        AS_DEPTTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 2, val: '00' },
        AS_DEPTGROUP_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 5, val: '00' },
        AS_OPERATE_DATE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50, val: '2023-08-24 11:56:42' },
        AS_ENTRY_DATE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50, val: '08/24/2023 16:53:50' },
        AS_ENTRY_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50, val: 'MOBILE' },
        AS_OPERATE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 8, val: '' },
        AS_SLIPITEMTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 4, val: 'WTX' },
        AS_SIGN_FLAG: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10, val: '-1' },
        AS_ITEM_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '15.5' },
        AS_MONEYTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 4, val: 'CBT' },
        AS_MACHINE_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30, val: 'K0151900006835' },
        AS_FEE_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '100' },
        AS_TOFROMACCID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10, val: '11040100' },
        AS_OTH_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '0' },
        AS_PRNCBAL: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '904685.5' },
        AS_WITHDRAWABLE_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '904685.5' },
        AS_LASTSTMSEQ_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10, val: '220' },
        AS_ACTION_STATUS: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 5, val: '1' },
        AS_POST_STATUS: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 2, val: '1' },
        AS_DEPTSLIP_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30, val: '' },
        AS_DEPTSLIP_NO_FEE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30, val: '' },
        AS_DEPTSLIP_NO_OTH: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30, val: '' },
        AS_PROCESS_STATUS: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 3000, val: '' }
    }
    console.log("ก่อนเรียก PL/SQL", new Date())
    await oracleExecute(query, model)
        .then(async (result) => {
            console.log("หลังเรียก PL/SQL", new Date())
            console.log(result.outBinds)
            res.status(200).json(result.outBinds)
            res.end()
        })
        .catch(async (err) => {
            console.log(err)
        })
})

API.post('/payment-test-', async (req, res) => {
    console.log('in')
    const query = `
        BEGIN
            POST_DEPT_INSERT_SERV_TEST(
                AS_NUMBER => :AS_NUMBER,
                AS_DATE => :AS_DATE
            );
        END;
    `
    const result = await oracleExecute(query, POST_DEPT_INSERT_TEST())
    console.log(result.outBinds)
    res.json(result.outBinds)
})
export default API