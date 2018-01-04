// const { test } = require('ava')
// const request = require('request-promise')
// const douyu_danmu = require('./index')

// let roomids = []
// let wrong_roomid = '110001001'
// let most_online_roomid
// let most_online_count = 0

// test.before(async () => {
// 	let opt = {
// 		url: 'http://api.douyutv.com/api/v1/live/lol',
// 		timeout: 10000,
// 		json: true
// 	}
// 	let body = await request(opt)
// 	body.data.forEach(item => {
// 		roomids.push(item.room_id)
// 		if (item.online > most_online_count) {
// 			most_online_roomid = item.room_id
// 			most_online_count = item.online
// 		}
// 	})
// })

// test('expose a constructor', t => {
// 	t.is(typeof douyu_danmu, 'function')
// })

// test('instance class', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	t.is(client._roomid, roomids[0]);
// })

// test('get room info', async t => {
// 	const client = new douyu_danmu(roomids[0])
// 	let room_info = await client._get_room_info()
// 	t.truthy(room_info)
// 	t.is(typeof room_info.gift_info, 'object')
// 	t.is(typeof room_info.online, 'number')
// })

// test('get a error room info', async t => {
// 	const client = new douyu_danmu(wrong_roomid)
// 	let room_info = await client._get_room_info()
// 	t.falsy(room_info)
// })

// test.cb('start success', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	client.start()
// 	client.on('connect', () => {
// 		t.is(typeof client, 'object')
// 		t.is(typeof client._fresh_room_info_timer, 'object')
// 		t.is(typeof client._heartbeat_timer, 'object')
// 		client.stop()
// 		t.end()
// 	})
// })

// test('start fail 1', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	client._starting = true
// 	client.start()
// 	t.falsy(client._client)
// })

// test.cb('start fail 2', t => {
// 	const client = new douyu_danmu(wrong_roomid)
// 	client.start()
// 	client.on('error', err => {
// 		t.is(err.message, 'Fail to get room info')
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('fresh room info', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	client.start()
// 	client.on('connect', async () => {
// 		client._gift_info = null
// 		await client._fresh_room_info()
// 		t.is(typeof client._gift_info, 'object')
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('fail to fresh room info', t => {
// 	const client = new douyu_danmu(roomids[3])
// 	client.start()
// 	client.on('connect', async () => {
// 		client._gift_info = null
// 		client._roomid = wrong_roomid
// 		client._fresh_room_info()
// 	})
// 	client.on('error', err => {
// 		t.is(err.message, 'Fail to fresh room info')
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('_stop', t => {
// 	const client = new douyu_danmu(roomids[2])
// 	client.start()
// 	client.on('connect', () => {
// 		client._stop()
// 	})
// 	client.on('close', () => {
// 		t.false(client._starting)
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('heart beat', t => {
// 	const client = new douyu_danmu(roomids[1])
// 	let time
// 	client.start()
// 	client.on('connect', () => {
// 		time = new Date().getTime()
// 		client._heartbeat()
// 	})
// 	client.on('message', msg => {
// 		if (msg.raw.type === 'mrkl') {
// 			t.true(new Date().getTime() - time < 2000)
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('send msg error', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	client.start()
// 	client.on('message', msg => {
// 		if (msg.raw.type === 'loginres') {
// 			client._send(false)
// 		}
// 	})
// 	client.on('error', err => {
// 		t.is(err.message, '"string" must be a string, Buffer, or ArrayBuffer')
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('format msg error', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	client.start()
// 	client.on('connect', () => {
// 		client._format_msg('dasd')
// 	})
// 	client.on('error', err => {
// 		t.is(err.message, 'Unexpected token d in JSON at position 0')
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('get chat msg from android', t => {
// 	const client = new douyu_danmu(most_online_roomid)
// 	client.start()
// 	client.on('message', msg => {
// 		if (msg.type === 'chat' && msg.from.plat === 'android') {
// 			t.is(typeof msg.time, 'number')
// 			t.is(typeof msg.from, 'object')
// 			t.is(typeof msg.id, 'string')
// 			t.is(typeof msg.content, 'string')
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('get chat msg from ios', t => {
// 	const client = new douyu_danmu(most_online_roomid)
// 	client.start()
// 	client.on('message', msg => {
// 		if (msg.type === 'chat' && msg.from.plat === 'ios') {
// 			t.is(typeof msg.time, 'number')
// 			t.is(typeof msg.from, 'object')
// 			t.is(typeof msg.id, 'string')
// 			t.is(typeof msg.content, 'string')
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('get deserve 1', t => {
// 	const client = new douyu_danmu(roomids[5])
// 	client.start()
// 	client.on('connect', () => {
// 		let msg = {
// 			lev: '1',
// 			type: 'bc_buy_deserve',
// 			sui: '@A=@S@A=@S@A=@S@A=@S@A=@S'
// 		}
// 		client._format_msg(JSON.stringify(msg))
// 	})
// 	client.on('message', msg => {
// 		if (msg.type === 'deserve') {
// 			t.is(msg.name, '初级酬勤')
// 			t.is(msg.price, 15)
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('get deserve 2', t => {
// 	const client = new douyu_danmu(roomids[5])
// 	client.start()
// 	client.on('connect', () => {
// 		let msg = {
// 			lev: '2',
// 			type: 'bc_buy_deserve',
// 			sui: '@A=@S@A=@S@A=@S@A=@S@A=@S'
// 		}
// 		client._format_msg(JSON.stringify(msg))
// 	})
// 	client.on('message', msg => {
// 		if (msg.type === 'deserve') {
// 			t.is(msg.name, '中级酬勤')
// 			t.is(msg.price, 30)
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('get deserve 3', t => {
// 	const client = new douyu_danmu(roomids[5])
// 	client.start()
// 	client.on('connect', () => {
// 		let msg = {
// 			lev: '3',
// 			type: 'bc_buy_deserve'
// 		}
// 		client._format_msg(JSON.stringify(msg))
// 	})
// 	client.on('message', msg => {
// 		if (msg.type === 'deserve') {
// 			t.is(msg.name, '高级酬勤')
// 			t.is(msg.price, 50)
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('get gift', t => {
// 	const client = new douyu_danmu(most_online_roomid)
// 	client.start()
// 	client.on('message', msg => {
// 		if (msg.type === 'gift') {
// 			t.is(typeof msg.time, 'number')
// 			t.is(typeof msg.name, 'string')
// 			t.is(typeof msg.from, 'object')
// 			t.is(typeof msg.price, 'number')
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('catch on socket error', t => {
// 	const client = new douyu_danmu(most_online_roomid)
// 	client._addr = '123'
// 	client.start()
// 	client.on('error', err => {
// 		t.true(err.message.indexOf('connect EHOSTUNREACH') > -1)
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('catch on data error', t => {
// 	const client = new douyu_danmu(most_online_roomid)
// 	client.start()
// 	client.on('connect', () => {
// 		client._on_data('asdasd')
// 	})
// 	client.on('error', err => {
// 		t.is(err.message, 'data.readInt16LE is not a function')
// 		client.stop()
// 		t.end()
// 	})
// })

// test.cb('test residual_data', t => {
// 	const client = new douyu_danmu(most_online_roomid)
// 	client._residual_data = new Buffer(0)
// 	client.start()
// 	client.on('message', msg => {
// 		if (msg.type === 'chat') {
// 			t.falsy(client._residual_data)
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test.cb('test online msg', t => {
// 	const client = new douyu_danmu(roomids[2])
// 	client.start()
// 	client.on('message', msg => {
// 		if (msg.type === 'online') {
// 			t.is(typeof msg.time, 'number')
// 			t.is(typeof msg.count, 'number')
// 			client.stop()
// 			t.end()
// 		}
// 	})
// })

// test('data.length < msg_len', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	let buf = client._on_data(Buffer.from([0x14, 0x00, 0x00, 0x00]))
// 	t.true(buf.length == 4)
// })

// test('no msg_array', t => {
// 	const client = new douyu_danmu(roomids[0])
// 	let buf = client._on_data(Buffer.from([0x14, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00]))
// 	t.pass()
// })


const douyu_danmu = require('./index')
const c = new douyu_danmu('321370', {
	ip: '193.93.194.134',
	port: 1085
})
c.on('error', e => console.log(e))
c.on('connect', e => console.log('connect'))
c.on('close', e => console.log('close'))
c.on('message', m => {
	console.log(m);
})
c.start()


