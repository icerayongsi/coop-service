import { oracleExecute , mysql_pool } from "#db/connection"

/**
 * @param { string } m_id 
 */

export const check_ref_no = async (m_id) => {
    try {
        const query = `SELECT * FROM dpdeptslip WHERE Machine_Id = '${m_id}'`
        const result = (await oracleExecute(query)).rows
        if (result.length === 0) return true
        else false
    } catch (error) {
        console.error(`[DB] Error - ${e}`)
    }
}

/**
 * @param { object } payload
 */

export const insert_err_trans = async (payload) => {
    try {
        const query = `INSERT INTO gctranshistory (ref_no,finish_round,payload) VALUES (?, ?, ?)`
        const bind = [
            payload.ref_no,
            payload.f_round,
            payload.payload
        ]
        const [ result ] = await mysql_pool.query(query,bind)
        return result
    } catch (e) {
        console.error(`[DB] Error - ${e}`)
    }
}