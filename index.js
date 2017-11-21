const net = require('net')
const events = require('events')
const request = require('request-promise')
const REQUEST_TIMEOUT = 10000
const HEARTBEAT_INTERVAL = 45000
const FRESH_ROOM_INFO_INTERVAL = 2 * 60 * 1000


class douyu_danmu extends events {

    constructor(roomid) {
        super()
        this._roomid = roomid
        this._port = 8601
        this._addr = 'openbarrage.douyutv.com'
    }

    async _get_room_info() {
        let opt = {
            url: `http://open.douyucdn.cn/api/RoomApi/room/${this._roomid}`,
            timeout: REQUEST_TIMEOUT,
            json: true,
            gzip: true
        }
        try {
            let body = await request(opt)
            let gift_info = {}
            body.data.gift.forEach(g => {
                gift_info[g.id] = {
                    name: g.name,
                    price: g.pc
                }
            })
            let online = body.data.online
            return {
                gift_info: gift_info,
                online: online
            }
        } catch (e) {
            return null
        }
    }

    async start() {
        if (this._starting) return
        this._starting = true
        let room_info = await this._get_room_info()
        if (!room_info) {
            this.emit('error', new Error('Fail to get room info'))
            return this.emit('close')
        }
        this._gift_info = room_info.gift_info
        this._emit_online(room_info)
        this._fresh_room_info_timer = setInterval(this._fresh_room_info.bind(this), FRESH_ROOM_INFO_INTERVAL)
        this._start_tcp()
    }

    _start_tcp() {
        this._client = new net.Socket()
        this._client.connect(this._port, this._addr)
        this._client.on('connect', () => {
            this._login_req()
            this._heartbeat_timer = setInterval(this._heartbeat.bind(this), HEARTBEAT_INTERVAL)
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

    async _fresh_room_info() {
        let room_info = await this._get_room_info()
        if (!room_info) {
            return this.emit('error', new Error('Fail to fresh room info'))
        }
        this._gift_info = room_info.gift_info
        this._emit_online(room_info)
    }

    _emit_online(room_info) {
        let msg_obj = {
            type: 'online',
            time: new Date().getTime(),
            count: room_info.online,
            raw: room_info
        }
        this.emit('message', msg_obj)
    }

    _on_data(data) {
        if (this._residual_data) {
            data = Buffer.concat([this._residual_data, data])
            this._residual_data = null
        }
        while (data.length > 0) {
            try {
                let msg_len = data.readInt16LE(0) + 4
                if (data.length < msg_len) {
                    return this._residual_data = data
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
            } catch (e) {
                this._residual_data = null
                return this.emit('error', e)
            }
        }
    }

    _format_msg(msg) {
        try {
            msg = JSON.parse(msg)
        } catch (e) {
            this.emit('error', e)
            return
        }
        let msg_obj
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
                let gift = this._gift_info[msg.gfid] || { name: '免费礼物', price: 0 }
                let time = new Date().getTime()
                msg_obj = {
                    type: 'gift',
                    time: time,
                    name: gift.name,
                    from: {
                        name: msg.nn,
                        rid: msg.uid,
                        level: parseInt(msg.level)
                    },
                    id: `${time}_${msg.uid}${msg.rid}${msg.gfid}${msg.hits}${msg.level}`,
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
                let time = new Date().getTime()
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
                    time: time,
                    name: name,
                    from: {
                        name: sui.nick,
                        rid: sui.id,
                        level: parseInt(sui.level)
                    },
                    id: `${time}_${sui.id}${msg.rid}${msg.lev}${msg.hits}${sui.level}${sui.exp}`,
                    count: parseInt(msg.cnt || 1),
                    price: price,
                    raw: msg
                }
                break
            case 'loginres':
                msg_obj = {
                    type: 'other',
                    time: new Date().getTime(),
                    raw: msg
                }
                this._join_group()
                break
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
        clearInterval(this._fresh_room_info_timer)
        try { this._client.destroy() } catch (e) { }
    }

    stop() {
        this.removeAllListeners()
        this._stop()
    }

}

module.exports = douyu_danmu