import { TRANSACTION } from "#cache/redis"
import { check_ref_no, insert_log_trans, last_statement_no ,gctransaction } from "#db/query"
import { oracleExecute, oraclePingConnection, POST_DEPT_INSERT_SERV_ONLINE } from "#db/connection"
import { convertUndefinedToEmptyString, c_time } from "#libs/Functions"
import config from "#configs/config" assert { type: 'json'}

export const process_cache = async (cache) => {
    const sub = cache.duplicate()
    await sub.connect()

    sub.subscribe("__keyevent@0__:expired", async (key) => {
        const split = key.split(':')
        const limit = config.w_redis_round_limit_exp

        // ? Covert cache data key name
        let data_key = key.split(':')
        data_key.shift()
        data_key.shift()
        data_key = data_key.join(':')

        // ? Procedure Model/query
        const bindParams = POST_DEPT_INSERT_SERV_ONLINE.model
        const query = POST_DEPT_INSERT_SERV_ONLINE.query_str

        if (split[0] !== 'EX') {
            console.log(`[${c_time()}][CACHE EXPIRED] =>`, key)
            // const payload = {
            //     sigma_key: split[4],
            //     ref_no: split[5],
            //     f_round: '-9',
            //     success : `${+(JSON.parse(await TRANSACTION.GET(key)).item_status) + 1}`,
            //     payload: JSON.parse(await TRANSACTION.GET(key)),
            //     description : ''
            // }
            // insert_log_trans(payload)
            return
        }

        if (split[1] < limit && await oraclePingConnection()) {

            console.log(`[${c_time()}][IN CACHE][PROCESS] เรียก Procedure ครั้งที่ ${+split[1] + 1} - ${key}`)

            // NOTE : PL/SQL process (เรียกซ้ำค่าที่ค้างใน Cache)
            await TRANSACTION.GET(data_key)
                .then(async (res) => {
                    res = JSON.parse(res)

                    for (const bindVar in bindParams) {
                        if (bindVar === 'AS_LASTSTMSEQ_NO') bindParams[bindVar].val = `${await last_statement_no(res.AS_DEPTACCOUNT_NO) + 1}`
                        else bindParams[bindVar].val = res[bindVar]
                    }
                    // ? เช็ค ref_no
                    const is_ref_no = await check_ref_no(res.AS_MACHINE_ID,res.AS_DEPTACCOUNT_NO)
                    if (is_ref_no) {
                        console.log(`[${c_time()}][IN CACHE][ACTION] Error - Duplicate 'ref_no'`)
                        throw "Error - Duplicate 'ref_no'"
                    }

                    await oracleExecute(query, convertUndefinedToEmptyString(bindParams))
                        .then(async (res) => {
                            
                            if (res.outBinds.AS_PROCESS_STATUS.includes('1:success')) {
                                console.log(`[${c_time()}][IN CACHE][PROCESS] 4.1 เรียก Procedure สำเร็จ - ${data_key} - ${res.outBinds.AS_PROCESS_STATUS}`)
                                // const payload = {
                                //     sigma_key: split[5],
                                //     ref_no: split[6],
                                //     f_round: split[1],
                                //     success : '1',
                                //     payload: JSON.parse(await TRANSACTION.GET(data_key)),
                                //     description : res.outBinds.AS_PROCESS_STATUS
                                // }
                                // const result = await insert_log_trans(payload)
                                //console.log(`[DB] Insert to history ${result} - ${data_key}`)
                                
                                await TRANSACTION.DEL(key)
                                await TRANSACTION.DEL(data_key)
                            }
                        })
                        // ! หากไม่สำเร็จจะทำการนับ Count เพิ่ม
                        .catch(async (e) => {
                            console.error(`[${c_time()}][IN CACHE][PROCESS] 4.1 เรียก Procedure ไม่สำเร็จ - ${+split[1] + 1} - Error : ${e} - ${key}`)
                            split[1] = +split[1] + 1
                            const new_key = split.join(':')
                            await TRANSACTION.SETEX(new_key, config.w_transaction_redis_count_exp, '')
                        })
                })
                .catch(async (e) => {
                    await TRANSACTION.DEL(key)
                    await TRANSACTION.DEL(data_key)
                    console.error(`[${c_time()}][IN CACHE][ACTION] ${e} - ${data_key}`)
                })

            // NOTE : ------------------

        } else if (split[1] >= limit) {

            // NOTE 2 : เก็บดาต้าเบสในส่วนที่ไม่สำเร็จ

            const payload = {
                sigma_key: split[5],
                ref_no: split[6],
                f_round: split[1],
                success : '0',
                payload: JSON.parse(await TRANSACTION.GET(data_key)),
                description : `Out of round limit (${split[1]})`
            }
            const result = insert_log_trans(payload)
            console.log(`[${c_time()}][DB] Insert to history ${result} - ${data_key}`)

            // NOTE 2 : ------------------

            await TRANSACTION.DEL(data_key)
            console.log(`[${c_time()}][CACHE EXPIRED] =>`, data_key)
        }

        if (!(await oraclePingConnection())) {
            if (split[1] >= limit) {
                await TRANSACTION.DEL(key)
                await TRANSACTION.DEL(data_key)
            } else {
                console.error(`[${c_time()}][IN CACHE][PROCESS] Error to connection database count ${+split[1] + 1} - ${key}`)
                split[1] = +split[1] + 1
                const new_key = split.join(':')
                await TRANSACTION.SETEX(new_key, config.w_transaction_redis_count_exp, '')
            }
        }

    })
}