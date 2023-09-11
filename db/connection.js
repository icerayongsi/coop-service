import oracledb from "oracledb"
import { createPool } from "mysql2/promise"
import { c_time } from "#libs/Functions"
import config from "#configs/config" assert { type: 'json'}

const Config = {
    oracle: {
        ...config.oracle
    },
    mysqlPool: {
        ...config.mysqlPool
    }
}

oracledb.getConnection(Config.oracle, (err, connection) => {
    if (err) {
        console.error('[DB] Error connecting to Oracle: ', err)
        return
    }
    connection.ping((pingErr) => {
        if (pingErr) console.error('[DB] Error pinging the database: ', pingErr)
        else console.log('[DB] Connected to Oracle database successfully!')

        connection.release(releaseErr => {
            if (releaseErr) {
                console.error('[DB] Error releasing connection: ', releaseErr)
            }
        })
    })
})

export const mysql_pool = createPool({ ...Config.mysqlPool });

export const oraclePingConnection = async () => {
    let connection
    try {
        connection = await oracledb.getConnection(Config.oracle)
        if (connection) return true
    } catch (error) {
        return false
    }
}

export const oracleExecute = async (query, bindVars = {}) => {
    let connection
    try {
        connection = await oracledb.getConnection(Config.oracle)
        const result = await connection.execute(query, bindVars, { autoCommit: true, outFormat: oracledb.OBJECT, bindDefs: bindVars })
        return result
    } catch (err) {
        throw `[${c_time()}][DB] Error connection : ${err}`
    } finally {
        if (connection) {
            try {
                await connection.close()
            } catch (err) {
                throw `[${c_time()}][DB] Error closing connection : ${err}`
            }
        }
    }
}

// Procedure

export const POST_DEPT_INSERT_TEST = () => {
    return {
        AS_BANK_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 200 }
    }
}

export const POST_DEPT_INSERT_SERV_ONLINE = {
    query_str: `
        BEGIN
            POST_DEPT_INSERT_SERV_ONLINE(
                AS_BANK_CODE=>:AS_BANK_CODE ,
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
                AS_SLIPITEMTYPE_CODE=>:AS_SLIPITEMTYPE_CODE ,
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
                AS_LASTCALINT_DATE_ => :AS_LASTCALINT_DATE,
                AS_DEPTSLIP_NO=>:AS_DEPTSLIP_NO,
                AS_DEPTSLIP_NO_FEE=>:AS_DEPTSLIP_NO_FEE,
                AS_DEPTSLIP_NO_OTH=>:AS_DEPTSLIP_NO_OTH,
                AS_PROCESS_STATUS=>:AS_PROCESS_STATUS
            );
        END;`,
    model: {
        AS_BANK_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 3 },
        AS_MEMBER_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 8 },
        AS_DEPTACCOUNT_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20 },
        AS_MEMBCAT_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 6 },
        AS_COOP_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 6 },
        AS_DEPTCOOP_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10 },
        AS_DEPTTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 2 },
        AS_DEPTGROUP_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 5 },
        AS_OPERATE_DATE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50 },
        AS_ENTRY_DATE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50 },
        AS_ENTRY_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50 },
        AS_OPERATE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 8 },
        AS_SLIPITEMTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 4 },
        AS_SIGN_FLAG: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10 },
        AS_ITEM_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20 },
        AS_MONEYTYPE_CODE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 4 },
        AS_MACHINE_ID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30 },
        AS_FEE_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20 },
        AS_TOFROMACCID: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10 },
        AS_OTH_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20 },
        AS_PRNCBAL: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20 },
        AS_WITHDRAWABLE_AMT: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 20 },
        AS_LASTSTMSEQ_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 10 },
        AS_ACTION_STATUS: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 5 },
        AS_POST_STATUS: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 2 },
        AS_LASTCALINT_DATE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 50 },
        AS_DEPTSLIP_NO: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30 },
        AS_DEPTSLIP_NO_FEE: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30 },
        AS_DEPTSLIP_NO_OTH: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, maxSize: 30 },
        AS_PROCESS_STATUS: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 3000 }
    }
}