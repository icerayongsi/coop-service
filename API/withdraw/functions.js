import { TRANSACTION } from '#cache/redis'
import { insert_log_trans } from '#db/query'

export const insert_argpl_log = async (sigma_key,f_round,success,data,description,key) => {
    if (data !== null) {
        const payload = {
            sigma_key : sigma_key,
            ref_no: data.AS_MACHINE_ID,
            f_round: f_round,
            success : success,
            payload: data,
            description : description
        }
        insert_log_trans(payload)
    } else {
        await TRANSACTION.GET(`TRANSACTION:${key}`)
            .then(async (res) => {
                res = JSON.parse(res)
                const payload = {
                    sigma_key : sigma_key,
                    ref_no: res.AS_MACHINE_ID,
                    f_round: f_round,
                    success : success,
                    payload: res,
                    description : description
                }
                insert_log_trans(payload)
            })
    }
} 