import { TRANSACTION } from "#cache/redis"
import { check_ref_no, insert_err_trans } from "#db/query"
import { oracleExecute, POST_DEPT_INSERT_SERV_ONLINE } from "#db/connection"
import { convertUndefinedToEmptyString } from "#libs/Functions"
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
            console.log('[CACHE EXPIRED] =>', key)
            return
        }

        if (split[1] < limit) {

            console.log(`[IN CACHE][PROCESS] Try to call procudure count ${+split[1] + 1} - ${key}`)

            // TODO : PL/SQL process (เรียกซ้ำค่าที่ค้างใน Cache)
            await TRANSACTION.GET(data_key)
                .then(async (res) => {
                    res = JSON.parse(res)

                    for (const bindVar in bindParams) bindParams[bindVar].val = res[bindVar]

                    // ? เช็ค ref_no
                    const is_ref_no = await check_ref_no(res.AS_MACHINE_ID)
                    if (!is_ref_no) throw `Error - Duplicate 'ref_no'`

                    await oracleExecute(query, convertUndefinedToEmptyString(bindParams))
                        .then(async () => {
                            console.log(`[IN CACHE][PROCESS] Successfully - ${data_key}`)
                            console.log(`[IN CACHE][ACTION] Remove - ${data_key}`)
                            await TRANSACTION.DEL(key)
                            await TRANSACTION.DEL(data_key)
                        })
                        // ! หากไม่สำเร็จจะทำการนับ Count เพิ่ม
                        .catch(async (e) => {
                            console.error(`[IN CACHE][PROCESS] Error to call procudure count ${+split[1] + 1} - ${key}`)
                            split[1] = +split[1] + 1
                            const new_key = split.join(':')
                            await TRANSACTION.SETEX(new_key, config.w_transaction_redis_count_exp, '')
                        })
                })
                .catch(async (e) => {

                    await TRANSACTION.DEL(key)
                    await TRANSACTION.DEL(data_key)
                    console.error(`[IN CACHE][ACTION] ${e} - ${data_key}`)
                })

            // TODO : ------------------

        } else {

            // TODO 2 : เก็บดาต้าเบสในส่วนที่ไม่สำเร็จ

            const payload = {
                ref_no: split[5],
                f_round: split[1],
                payload: await TRANSACTION.GET(data_key)
            }
            const result = await insert_err_trans(payload)
            console.log(`[DB] Insert to history ${result} - ${data_key}`)

            // TODO 2 : ------------------

            await TRANSACTION.DEL(data_key)
            console.log('[CACHE EXPIRED] =>', data_key)
        }
    })
}