const net = require('net')
const events = require('events')
const request = require('request-promise')

class douyu_danmu extends events {

    constructor(roomid) {
        super()
        this._roomid = roomid
    }

    async _get_gift_info() {
        let opt = {
            url: `http://open.douyucdn.cn/api/RoomApi/room/${this._roomid}`,
            timeout: 10000,
            json: true,
            gzip: true
        }
        try {
            let body = await request(opt)
            let gift_info = {}
            body.data.gift.forEach(g => {
                gift_info[g.id] = {
                    is_yuwan: g.type == '1' ? true : false,
                    name: g.name,
                    price: g.pc
                }
            })
            return gift_info
        } catch (e) {
            return null
        }
    }

    async _fresh_gift_info() {
        let gift_info = await this._get_gift_info()
        if (!gift_info) {
            return this.emit('error', new Error('Fail to fresh room info'))
        }
        this._gift_info = gift_info
    }

    async start() {
        if (this._starting) return
        this._starting = true
        let gift_info = await this._get_gift_info()
        if (!gift_info) {
            this.emit('error', new Error('Fail to get room info'))
            return this.emit('close')
        }
        this._gift_info = gift_info
        this._fresh_gift_info_timer = setInterval(this._fresh_gift_info.bind(this), 30 * 60 * 1000)
        this._start_tcp()
    }

    _start_tcp() {
        this._all_buf = Buffer.alloc(0)
        this._client = new net.Socket()
        this._client.connect(8601, 'openbarrage.douyutv.com')
        this._client.on('connect', () => {
            this._login_req()
            this._heartbeat_timer = setInterval(this._heartbeat.bind(this), 45000)
            this.emit('connect')
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

    _join_group() {
        this._send(`type@=joingroup/rid@=${this._roomid}/gid@=-9999/`)
    }

    _heartbeat() {
        this._send('type@=mrkl/')
    }

    _on_data(data) {
        if (this._all_buf.length === 0) {
            this._all_buf = data
        } else {
            this._all_buf = Buffer.concat([this._all_buf, data])
        }
        while (this._all_buf.length > 8) {
            try {
                let len_0 = this._all_buf.readInt16LE(0)
                let len_1 = this._all_buf.readInt16LE(4)
                if (len_0 !== len_1)
                    return this._all_buf = Buffer.alloc(0)
                let msg_len = len_0 + 4
                if (this._all_buf.length < msg_len) return
                let single_msg = this._all_buf.slice(0, msg_len)
                let single_msg_tail = single_msg[single_msg.length - 1]
                if (single_msg_tail !== 0)
                    return this._all_buf = Buffer.alloc(0)
                this._all_buf = this._all_buf.slice(msg_len)
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
            } catch (e) {
                return this.emit('error', e)
            }
        }
    }

    _format_msg(msg) {
        try {
            msg = JSON.parse(msg.replace(/\\/g, ''))
        } catch (e) {
            return this.emit('error', e)
        }
        let msg_obj
        let time = new Date().getTime()
        switch (msg.type) {
            case 'chatmsg':
                let plat = 'pc_web'
                if (msg.ct == '1') {
                    plat = 'android'
                } else if (msg.ct == '2') {
                    plat = 'ios'
                }
                msg_obj = {
                    type: 'chat',
                    time,
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
                let gift = this._gift_info[msg.gfid] || { name: '免费礼物', price: 0, is_yuwan: false }
                msg_obj = {
                    type: 'gift',
                    time,
                    name: gift.name,
                    from: {
                        name: msg.nn,
                        rid: msg.uid,
                        level: parseInt(msg.level)
                    },
                    is_yuwan: gift.is_yuwan,
                    id: `${msg.uid}${msg.rid}${msg.gfid}${msg.hits}${msg.level}`,
                    count: parseInt(msg.gfcnt || 1),
                    price: parseInt(msg.gfcnt || 1) * gift.price,
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
                try {
                    sui = sui.replace(/@A=/g, '":"')
                    sui = sui.replace(/@S/g, '","')
                    sui = sui.substring(0, sui.length - 2)
                    sui = `{"${sui}}`
                    sui = JSON.parse(sui)
                } catch (e) {
                    sui = {
                        nick: '',
                        id: '',
                        level: 0
                    }
                }
                msg_obj = {
                    type: 'deserve',
                    time,
                    name: name,
                    from: {
                        name: sui.nick,
                        rid: sui.id,
                        level: parseInt(sui.level)
                    },
                    id: `${sui.id}${msg.rid}${msg.lev}${msg.hits}${sui.level}${sui.exp}`,
                    count: parseInt(msg.cnt || 1),
                    price: price,
                    raw: msg
                }
                break
            case 'loginres':
                msg_obj = {
                    type: 'other',
                    time,
                    raw: msg
                }
                this._join_group()
                break
            default:
                msg_obj = {
                    type: 'other',
                    time,
                    raw: msg
                }
                break
        }
        this.emit('message', msg_obj)
    }

    _send(msg) {
        try {
            let len = Buffer.byteLength(msg) + 9
            let head = Buffer.from([len, 0x00, 0x00, 0x00, len, 0x00, 0x00, 0x00, 0xb1, 0x02, 0x00, 0x00])
            let body = Buffer.from(msg)
            let tail = Buffer.from([0x00])
            let buf = Buffer.concat([head, body, tail])
            this._client.write(buf)
        } catch (err) {
            this.emit('error', err)
        }
    }

    _stop() {
        this._starting = false
        clearInterval(this._heartbeat_timer)
        clearInterval(this._fresh_gift_info_timer)
        try { this._client.destroy() } catch (e) { }
    }

    stop() {
        this.removeAllListeners()
        this._stop()
    }
}

module.exports = douyu_danmu