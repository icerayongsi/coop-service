import { oracleExecute, mysql_pool } from "#db/connection"

/**
 * @param { string } m_id 
 */

export const check_ref_no = async (m_id) => {
    try {
        const query = `SELECT Machine_Id FROM dpdeptslip WHERE Machine_Id = '${m_id}'`
        const result = (await oracleExecute(query)).rows
        if (result.length === 0) return true
        else false
    } catch (error) {
        console.error(`[DB] Error - ${e}`)
    }
}

export const insert_err_trans = async (payload) => {
    try {
        const query = `INSERT INTO gctranshistory (ref_no,finish_round,payload) VALUES (?, ?, ?)`
        const bind = [
            payload.ref_no,
            payload.f_round,
            payload.payload
        ]
        const [result] = await mysql_pool.query(query, bind)
        return result
    } catch (e) {
        console.error(`[DB] Error - ${e}`)
    }
}

export const last_statement_no = async (payload) => {
    try {
        const query = `SELECT dpm.LASTSTMSEQ_NO
        FROM dpdeptmaster dpm
        LEFT JOIN dpdepttype dpt ON dpm.DEPTTYPE_CODE = dpt.DEPTTYPE_CODE AND dpm.membcat_code = dpt.membcat_code
        WHERE dpm.DEPTACCOUNT_NO = :deptaccount_no`
        const bind = [ payload ]
        const [ result ] = (await oracleExecute(query,bind)).rows
        return result.LASTSTMSEQ_NO
    } catch (error) {
        console.error(`[DB] Error - ${error}`)
    }
}

export const history_trans = {
    async get(payload, arg_query) {
        const query = arg_query ?? "SELET"
    }
}