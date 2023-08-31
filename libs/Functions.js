import axios from 'axios'
import moment from 'moment'
import { v4 as uuid } from 'uuid'
//import configs from '#constants/configs'

// ===== Util Functions =====

export const c_time = () => {
    return moment().format('YYYY-MM-DD HH:mm:ss')
}

export const genGUID = () => {
    return uuid()
}

export const formatMysqlDate = (date) => {
    return moment(date).format("YYYY-MM-DD HH:mm:ss")
}

export const checkCompleteArgument = (arg_keys, payload) => {
    let result = true
    arg_keys.forEach(key => {
        if (payload.hasOwnProperty(key)) {
            if (payload[key] === '' || payload[key] === null || payload[key] === undefined || payload[key] === 'undefined') {
                result = false
                console.log(`[Payload arg error] => name : ${key} , type : ${typeof payload[key]} , value : ${payload[key]}`)
                return
            }
        }
    })
    return result
}

export const convertNullToStringNull = obj => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value === null) acc[key] = "null"
        else if (typeof value === "object") acc[key] = convertNullToStringNull(value)
        else acc[key] = value
        return acc
    }, {})
}

export const convertUndefinedToEmptyString = (obj) => {
    for (const key in obj) {
        if (obj[key].val === undefined || obj[key].val === null) obj[key].val = ''
    }
    return obj
}

export const amtDecimal = (value) => {
    if (!value.includes('.')) return `${value}00`
    else {
        const value_splited = value.split('.')
        if (!!value_splited[1]) {
            if (value_splited[1].length < 2) {
                return `${value_splited[0]}${value_splited[1].padEnd(3 - value_splited[1].length, '0')}`
            } else return `${value_splited[0]}${value_splited[1].substring(0, 2)}`
        } else return `${value_splited[0]}00`
    }
}

export const pad_amt = (value) => {
    const value_splited = value.split('.')
    if (!!value_splited[1]) {
        if (value_splited[1] === '0' || value_splited[1] === '00') return value_splited[0]
        if (value_splited[1].length === 0) return `${value_splited[0]}.${value_splited[1].padEnd(2, '0')}`
        if (value_splited[1].length < 2) return `${value_splited[0]}.${value_splited[1].padEnd(3 - value_splited[1].length, '0')}`
        else return `${value_splited[0]}.${value_splited[1].substring(0, 2)}`
    }
    return value_splited[0]
}

// export const bank_api_path = async () => {
//     return (await RequestFunction.get(false, configs.BANK_API_PATH, null, null)).data
// }

// ===== Request API =====

export const RequestFunction = {
    async get(isToken = false, url, headers, data, timeout = null, showErr = true) {
        if (isToken) headers.Authorization = `${headers.Authorization}`
        return await axios.get(url, {
            ...data
        }, { headers, timeout: timeout })
            .then((res) => res)
            .catch((error) => {
                if (showErr) {
                    if (!!error.response) {
                        console.log(error.response.data)
                        throw (handleError(error.response.status))
                    } else {
                        console.log(error)
                        throw (handleError('etc'))
                    }
                }
            })
    },
    async post(isToken = false, url, headers, data, timeout = null, showErr = true) {
        if (isToken) headers.Authorization = `${headers.Authorization}`
        return await axios.post(url, {
            ...data
        }, { headers, timeout: timeout })
            .then((res) => res)
            .catch((error) => {
                if (!!error.response) {
                    if (showErr) console.log(error.response.data)

                    throw (handleError(error.response.status))
                } else {
                    if (showErr) console.log(error)

                    throw (handleError(408))
                }
            })
    }
}


// ===== Hendle Error =====

export const handleError = (error) => {
    if (error === 400) return 'Bad Request'
    else if (error === 401) return 'Unauthorized'
    else if (error === 403) return 'Forbidden'
    else if (error === 408) return 'Request Timeout'
    else return 'Something went wrong, Please contact the developer'
}

