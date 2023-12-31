import express from 'express'
import config from "#configs/config" assert { type: 'json'}
import { oracleExecute , POST_DEPT_INSERT_SERV_ONLINE } from '#db/connection'
import { convertUndefinedToEmptyString, c_time , delay , genGUID } from '#libs/Functions'
import { TRANSACTION } from '#cache/redis'
import { check_ref_no, history_trans, last_statement_no, olslip } from '#db/query'
import { insert_argpl_log } from './functions.js'

const API = express.Router()
API.use(express.json())
API.use(express.urlencoded({
    extended: true,
    defer: true
}))

API.post('/set-cache', async (req, res) => {
    const { sigma_key, item_status, ...filteredData } = req.body
    const cache_key_name = `${req.body.AS_SLIPITEMTYPE_CODE}:${req.body.AS_BANK_CODE}:${req.body.sigma_key}:${req.body.AS_MACHINE_ID}`
    try {
        await TRANSACTION.SETEX(
            `TRANSACTION:${cache_key_name}`,
            config.w_transaction_verify_exp,
            filteredData
        )
        console.log(`[${c_time()}][IN PAYMENT][CACHED] 1 เซ็ทแคช - ${cache_key_name}`)
        res.status(200).json({ status: true })
    } catch (e) {
        // TODO : INSERT OL SLIP 8
        //insert_argpl_log(req.body.sigma_key, '-1', '0', filteredData, `Set cache Error : ${e}`, null)
        console.error(`[${c_time()}][IN PAYMENT][CACHE] 1 เซ็ทแคช Error ${req.route.path} - ${e}`)
        res.status(200).json({ status: false })
    }
    res.end()
})

API.post('/payment', async (req, res) => {
    const cache_key_name = `${req.body.AS_SLIPITEMTYPE_CODE}:${req.body.AS_BANK_CODE}:${req.body.sigma_key}:${req.body.AS_MACHINE_ID}`
    //console.log(`[${c_time()}][IN PAYMENT][PEOCESS] 3 โอนธนาคารสำเร็จ ก่อนเรียก Procedure - ${req.body.AS_MACHINE_ID}`)
    const { sigma_key, item_status, ...bind } = req.body
    try {
        // NOTE : Init variable/Model PL/SQL and body
        const bindParams = POST_DEPT_INSERT_SERV_ONLINE.model
        const query = POST_DEPT_INSERT_SERV_ONLINE.query_str

        for (const bindVar in bindParams) bindParams[bindVar].val = bind[bindVar]

        // NOTE : Start oracle statement
        await oracleExecute(query, convertUndefinedToEmptyString(bindParams))
            .then(async (result) => {
                            
                //insert_argpl_log(req.body.sigma_key, '0', '1', result.outBinds, `Successfully , PL/SQL : ${result.outBinds.AS_PROCESS_STATUS}`, null)
                if (result.outBinds.AS_PROCESS_STATUS.includes('1:success')) {
                    const is_ref_no = await check_ref_no(req.body.AS_MACHINE_ID, req.body.AS_DEPTACCOUNT_NO)
                    if (is_ref_no) {
                        console.log(`[${c_time()}][IN PAYMENT][PROCESS] 3.1 เรียก Procedure สำเร็จ - ${req.body.AS_MACHINE_ID} - ${result.outBinds.AS_DEPTACCOUNT_NO} - ${JSON.stringify(result.outBinds.AS_PROCESS_STATUS)}`)
                        res.status(200).json(result.outBinds)
                        res.end()
                    } else {
                        console.log(`[${c_time()}][IN PAYMENT][PROCESS] 3.3 เรียก Procedure สำเร็จ ไม่สำเร็จ - ${req.body.AS_MACHINE_ID} - ${result.outBinds.AS_DEPTACCOUNT_NO} - ${JSON.stringify(result.outBinds.AS_PROCESS_STATUS)}`)
                        res.status(200).json({ AS_PROCESS_STATUS: 'pl_err' })
                        res.end()
                        throw "Error - ไม่มี 'ref_no"
                    }
                } else {

                    await delay(2000)
                    
                    console.log(`[${c_time()}][IN PAYMENT][PROCESS] 3.2 เรียก Procedure รอบ 2 - ${req.body.AS_MACHINE_ID} - ${result.outBinds.AS_DEPTACCOUNT_NO} - ${JSON.stringify(result.outBinds.AS_PROCESS_STATUS)}`)

                    // ? เช็ค ref_no ว่ามีซ้ำหรือไม่ ถ้ามี return เป็น false ถ้าไม่มี เป็น true
                    const is_ref_no_2 = await check_ref_no(req.body.AS_MACHINE_ID, req.body.AS_DEPTACCOUNT_NO)
                    if (is_ref_no_2) {
                        console.log(`[${c_time()}][IN PAYMENT][PROCESS] 3.2 ref_no ซ้ำ - ${req.body.AS_MACHINE_ID} = ${result.outBinds.AS_MACHINE_ID} - ${result.outBinds.AS_DEPTACCOUNT_NO}`)
                        res.status(200).json({ AS_PROCESS_STATUS: '1:success' })
                        res.end()
                    } else {
                        // ? ดึงค่า max seq_no มาใส่ last_statemente
                        for (const bindVar in bindParams) {
                            if (bindVar === 'AS_LASTSTMSEQ_NO') bindParams[bindVar].val = `${await last_statement_no(result.outBinds.AS_DEPTACCOUNT_NO) + 1}`
                            else bindParams[bindVar].val = result.outBinds[bindVar]
                        }

                        try {
                            const result2ND = await oracleExecute(query, convertUndefinedToEmptyString(bindParams))

                            if (result2ND.outBinds.AS_PROCESS_STATUS.includes('1:success')) {
                                console.log(`[${c_time()}][IN PAYMENT][PROCESS] 3.2.1 เรียก Procedure รอบ 2 สำเร็จ - ${req.body.AS_MACHINE_ID} - ${result.outBinds.AS_DEPTACCOUNT_NO} - ${JSON.stringify(result2ND.outBinds.AS_PROCESS_STATUS)}`)
                                res.status(200).json(result2ND.outBinds)
                                res.end()
                            } else {
                                console.log(`[${c_time()}][IN PAYMENT][PROCESS] 3.2.2 เรียก Procedure รอบ 2 ไม่สำเร็จ - ${req.body.AS_MACHINE_ID} - ${result.outBinds.AS_DEPTACCOUNT_NO} - ${JSON.stringify(result2ND.outBinds.AS_PROCESS_STATUS)}`)
                                throw 'เรียก Procedure รอบที่ 2 ไม่สำเร็จ'
                            }
                        } catch (e) {
                            throw e
                        }
                    }
                }
            })
            // ! ไม่สำเร็จ จะเข้าสู่ Process cache
            // ? สร้าง Cache 2 ตัว 1 ตัวนับหมดเวลา อีกตัวเก็บข้อมูล
            .catch(async (e) => {
                console.log(`[${c_time()}][IN PAYMENT][PROCESS] 4 รอบ 3 - ${req.body.AS_MACHINE_ID} - ${result.outBinds.AS_DEPTACCOUNT_NO} - ${e}`)
                //insert_argpl_log(req.body.sigma_key, '-1', '0', null, `Call procedure error , PL/SQL : ${e}`, cache_key_name)
                // ? Cache เปล่า ตั้งเวลา 5 วิ
                await TRANSACTION.SETEX(
                    `EX:0:TRANSACTION:${cache_key_name}`,
                    config.w_transaction_redis_count_exp,
                    '',
                )
                // ? Cache เก็บข้อมูล ตั้งเวลา 1 ชั่วโมงเพื่อปกกันการค้างใน Cache
                await TRANSACTION.SETEX(
                    `TRANSACTION:${cache_key_name}`,
                    config.w_transaction_arg_data_exp,
                    bind
                )
                console.error(e)
                res.status(200).json({ AS_PROCESS_STATUS: 'pl_err' })
                res.end()
            })
        // NOTE : End oracle statement
    } catch (e) {
        //insert_argpl_log(req.body.sigma_key, '-1', '0', null, `API error : ${e}`, cache_key_name)
        console.log(`[${c_time()}][IN PAYMENT][PROCESS] Error - ${e}`)
        res.status(500).json({ AS_PROCESS_STATUS: 'pl_err' })
    }
})

API.post('/re-payment', async (req, res) => {

    const data = req.body
    const bindParams = POST_DEPT_INSERT_SERV_ONLINE.model
    const query = POST_DEPT_INSERT_SERV_ONLINE.query_str

    try {

        for (const element of data) {
            const result = await history_trans.get(element)

            const bind = JSON.parse(result.payload)
            for (const bindVar in bindParams) {
                if (bindVar === 'AS_LASTSTMSEQ_NO') bindParams[bindVar].val = `${await last_statement_no(bind.AS_DEPTACCOUNT_NO)}`
                else bindParams[bindVar].val = bind[bindVar]
            }

            const is_ref_no = await check_ref_no(bind.AS_MACHINE_ID, result.outBinds.DEPTACCOUNT_NO)
            if (is_ref_no) {
                res.end()
                throw `Error - Duplicate 'ref_no'`
            }

            await oracleExecute(query, bindParams)
                .then(async () => {
                    console.log(`[${c_time()}][RE PAYMENT][PROCESS] Successfully : ${bind.AS_MACHINE_ID}`)
                })
        }

        res.end()

    } catch (e) {
        console.log(`[${c_time()}][RE PAYMENT][PROCESS] API Error : ${e}`)
        res.end()
    }
})

// ----------- TEST ---------------

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
        AS_BANK_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 3, val: '999' },
        AS_MEMBER_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 8, val: '00862673' },
        AS_DEPTACCOUNT_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '1000008327' },
        AS_MEMBCAT_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 6, val: '10' },
        AS_COOP_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 6, val: '065001' },
        AS_DEPTCOOP_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10, val: '065001' },
        AS_DEPTTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 2, val: '10' },
        AS_DEPTGROUP_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 5, val: '00' },
        AS_OPERATE_DATE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50, val: '2023-08-24 11:56:42' },
        AS_ENTRY_DATE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50, val: '08/24/2023 16:53:50' },
        AS_ENTRY_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50, val: 'MOBILE' },
        AS_OPERATE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 8, val: '' },
        AS_SLIPITEMTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 4, val: 'WTE' },
        AS_SIGN_FLAG: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10, val: '-1' },
        AS_ITEM_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '15.5' },
        AS_MONEYTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 4, val: 'CBT' },
        AS_MACHINE_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30, val: req.body.mc_id },
        AS_FEE_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20, val: '5' },
        AS_TOFROMACCID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10, val: '11012119' },
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