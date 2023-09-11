import { oracleExecute, mysql_pool } from "#db/connection"

/**
 * @param { string } m_id 
 */

export const check_ref_no = async (m_id) => {
    try {
        const query = `SELECT Machine_Id FROM dpdeptslip WHERE Machine_Id = '${m_id}' AND DEPTITEMTYPE_CODE NOT IN ('FEO','FEE')`
        const result = (await oracleExecute(query)).rows
        if (result.length === 0) return false
        return true
    } catch (error) {
        console.error(`[DB] Error - ${error}`)
    }
}

export const insert_log_trans = async (payload) => {
    try {
        const query = `INSERT INTO gctranshistory (sigma_key,ref_no,finish_round,success,payload,description) VALUES (?, ?, ?, ?, ?, ?)`
        const bind = [
            payload.sigma_key,
            payload.ref_no,
            payload.f_round,
            payload.success,
            JSON.stringify(payload.payload),
            payload.description
        ]
        
        const [result] = await mysql_pool.query(query, bind)
        return result
    } catch (e) {
        console.error(`[DB] Error - ${e}`)
    }
}

export const last_statement_no = async (payload) => {
    try {
        const query = `SELECT MAX(DPM.SEQ_NO) AS SEQ_NO FROM dpdeptstatement dpm WHERE dpm.DEPTACCOUNT_NO = :deptaccount_no`
        const bind = [payload]
        const result = (await oracleExecute(query, bind)).rows
        return result[0].SEQ_NO
    } catch (error) {
        console.error(`[DB] Error - ${error}`)
    }
}

export const history_trans = {
    async get(payload) {
        try {
            const query = `SELECT DISTINCT payload FROM gctranshistory WHERE ref_no = ? AND datetime = ?`
            const bind = [
                payload.ref_no,
                payload.datetime
            ]
            const [result] = await mysql_pool.query(query, bind)
            return result[0]
        } catch (e) {
            return e
        }
    }
}

export const olslip = async (body) => {
    const olslip_columns = [
        'BANK_CODE', 'DEPTACCOUNT_NO', 'MEMBCAT_CODE',
        'DEPTTYPE_CODE', 'DEPTGROUP_CODE', 'OPERATE_TIME',
        'ENTRY_ID', 'DEPTITEMTYPE_CODE', 'CASH_TYPE', 'MACHINE_ID',
        'DEPTSLIP_NETAMT','FEE_AMT','OTHER_AMT','PRNCBAL',
        'WITHDRAWABLE_AMT','DPSTM_NO'
    ]
    try {
        const query = `SELECT ${olslip_columns.join(',')} FROM dpdeptolslip WHERE MACHINE_ID = '${body.mc_id}'`
        const result = (await oracleExecute(query)).rows
        
        return result
    } catch (e) {
        return e
    }
}

export const update_gctrans = async (body) => {
    try {
        const query = `UPDATE gctransaction SET result_transaction = '1' WHERE ref_no = '?'`
        const bind = [ body.ref_no ]
        const [ result ] = await mysql_pool.query(query, bind)
        return result
    } catch (error) {
        console.error(`[DB] Error - ${e}`)
    }
}