import { oracleExecute } from "#db/connection"

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
        console.error(error)
    }
}