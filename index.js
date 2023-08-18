import express from 'express'
import cors from 'cors'
import { getDirName } from '#libs/helper'
import { Startup_Config as radis } from '#cache/redis'
import withdraw_api from '#API/withdraw/request_withdraw_bank'
import config from "#configs/config" assert { type: 'json'}

// INIT
const PORT = process.env.PORT || config.express_port
const router = express()
const __dirname = getDirName(import.meta.url)

router.use(cors())
router.use('/withdraw',withdraw_api)

router.get('*', (req, res) => {
    res.sendFile(`${__dirname}/src/index.html`)
})

router.listen(PORT, async () => {
    console.log("[COOP API] Server Listening on PORT =>", PORT)
    await radis()
})
