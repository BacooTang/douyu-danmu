const net = require('net')
const events = require('events')
const request = require('request-promise')
const DOUYU_ADDR = 'openbarrage.douyutv.com'
const DOUYU_PORT = 8601
const REQUEST_TIMEOUT = 10000
const HEARTBEAT_INTERVAL = 45000
const FRESH_GIFT_INFO_INTERVAL = 30 * 60 * 1000

const fs = require('fs')

class douyu_danmu extends events {

    constructor(roomid) {
        super()
        this._roomid = roomid
    }

    async _get_gift_info() {
        let opt = {
            url: `http://open.douyucdn.cn/api/RoomApi/room/${this._roomid}`,
            timeout: REQUEST_TIMEOUT,
            json: true,
            gzip: true
        }
        try {
            let body = await request(opt)
            let gift = body.data.gift
            let gift_info = {}
            gift.forEach(g => {
                gift_info[g.id] = {
                    name: g.name,
                    type: g.type,
                    price: g.pc
                }
                if (g.name == '100鱼丸') {
                    gift_info[g.id].price = 0.1
                }
            })
            return gift_info
        } catch (e) {
            return null
        }
    }

    async start() {
        if (this._starting) {
            return
        }
        this._starting = true
        this._gift_info = await this._get_gift_info()
        if (!this._gift_info) {
            this.emit('error', new Error('Fail to get gift info'))
            return this.emit('close')
        }
        this._fresh_gift_info_timer = setInterval(this._fresh_gift_info.bind(this), FRESH_GIFT_INFO_INTERVAL)
        this._start_tcp()
    }

    _start_tcp() {
        this._client = new net.Socket()
        this._client.connect(DOUYU_PORT, DOUYU_ADDR)
        this._client.on('connect', () => {
            this.emit('connect')
            this._login_req()
            this._heartbeat_timer = setInterval(this._heartbeat.bind(this), HEARTBEAT_INTERVAL)
        })
        this._client.on('error', err => {
            this.emit('error', err)
        })
        this._client.on('close', () => {
            this._stop()
            this.emit('close')
        })
        this._client.on('data', this._on_data.bind(this))
    }

    _login_req() {
        this._send(`type@=loginreq/roomid@=${this._roomid}/`)
    }

    _on_data(data) {
        if (this._last_buf) {
            data = Buffer.concat([this._last_buf, data])
            this._last_buf = null
        }
        while (data.length > 0) {
            let msg_len = data.readInt16LE(0) + 4
            if (data.length < msg_len) {
                return this._last_buf = data
            }
            let single_msg = data.slice(0, msg_len)
            data = data.slice(msg_len)
            let msg_array = single_msg.toString().match(/(type@=.*?)\x00/g)
            if (msg_array) {
                msg_array.forEach(msg => {
                    msg = msg.replace(/@=/g, '":"')
                    msg = msg.replace(/\//g, '","')
                    msg = msg.substring(0, msg.length - 3)
                    msg = `{"${msg}}`
                    this._format_msg(msg)
                })
            }
        }
    }

    _format_msg(msg) {
        try {
            msg = JSON.parse(msg)
        } catch (e) {
            return this.emit('error', e)
        }
        let msg_obj
        switch (msg.type) {
            case 'chatmsg':
                let plat = 'unknow'
                if (msg.ct == '0') {
                    plat = 'pc_web'
                } else if (msg.ct == '1') {
                    plat = 'android'
                } else if (msg.ct == '2') {
                    plat = 'ios'
                }
                msg_obj = {
                    type: 'chat',
                    time: new Date().getTime(),
                    from: {
                        name: msg.nn,
                        rid: msg.uid,
                        level: parseInt(msg.level),
                        plat: plat
                    },
                    id: msg.cid,
                    content: msg.txt,
                    raw: msg
                }
                break
            case 'dgb':
                let gift = this._gift_info[msg.gfid] || {}
                msg_obj = {
                    type: 'gift',
                    time: new Date().getTime(),
                    name: gift.name || '免费礼物',
                    from: {
                        name: msg.nn,
                        rid: msg.uid,
                        level: parseInt(msg.level)
                    },
                    count: parseInt(msg.gfcnt || 1),
                    price: parseInt(gift.price) || 0,
                    raw: msg
                }
                let weight_msg = {
                    type: 'weight',
                    time: new Date().getTime(),
                    count: parseInt(msg.dw),
                    raw: msg
                }
                this.emit('message', weight_msg)
                break
            case 'bc_buy_deserve':
                let name = '初级酬勤'
                let price = 15
                if (msg.lev === '2') {
                    name = '中级酬勤'
                    price = 30
                } else if (msg.lev === '3') {
                    name = '高级酬勤'
                    price = 50
                }
                let sui = msg.sui
                sui = sui.replace(/@A=/g, '":"')
                sui = sui.replace(/@S/g, '","')
                sui = sui.substring(0, sui.length - 4)
                sui = `{"${sui}}`
                try {
                    sui = JSON.parse(sui)
                } catch (e) {
                    sui = {}
                }
                msg_obj = {
                    type: 'deserve',
                    time: new Date().getTime(),
                    name: name,
                    from: {
                        name: sui.nick || '',
                        rid: sui.id || '',
                        level: parseInt(sui.level)
                    },
                    count: parseInt(msg.cnt || 1),
                    price: price,
                    raw: msg
                }
                break
            case 'loginres':
                return this._send(`type@=joingroup/rid@=${this._roomid}/gid@=-9999/`)
            default:
                msg_obj = {
                    type: 'other',
                    time: new Date().getTime(),
                    raw: msg
                }
                break
        }
        this.emit('message', msg_obj)
    }

    _send(msg) {
        let len = Buffer.byteLength(msg) + 9
        let head = Buffer.from([len, 0x00, 0x00, 0x00, len, 0x00, 0x00, 0x00, 0xb1, 0x02, 0x00, 0x00])
        let body = Buffer.from(msg)
        let tail = Buffer.from([0x00])
        let buf = Buffer.concat([head, body, tail])
        try {
            this._client.write(buf)
        } catch (err) {
            this.emit('error', err)
        }
    }

    async _fresh_gift_info() {
        let gift_info = await this._get_gift_info()
        if (!gift_info) {
            return this.emit('error', new Error('Fail to fresh gift info'))
        }
        this._gift_info = gift_info
    }

    _heartbeat() {
        this._send('type@=mrkl/')
    }

    _stop() {
        this._starting = false
        clearInterval(this._heartbeat_timer)
        clearInterval(this._fresh_gift_info_timer)
        try {
            this._client.destroy()
        } catch (e) { }
    }

    stop() {
        this.removeAllListeners()
        this._stop()
    }

}

module.exports = douyu_danmu