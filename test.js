const douyu_danmu = require('./index')
const roomid = '78561'
const client = new douyu_danmu(roomid)

client.on('connect', () => {
	console.log(`已连接douyu ${roomid}房间弹幕~`)
})

client.on('message', msg => {
	switch (msg.type) {
		case 'chat':
			console.log(`[${msg.from.name}]:${msg.content}`)
			break
		case 'gift':
			console.log(`[${msg.from.name}]->赠送${msg.count}个${msg.name}`)
			break
		case 'yuwan':
			console.log(`[${msg.from.name}]->赠送${msg.count}个${msg.name}`)
			break
		case 'deserve':
			console.log(`[${msg.from.name}]->赠送${msg.count}个${msg.name}`)
			break
	}
})

client.on('error', e => {
	console.log(e)
})

client.on('close', () => {
	console.log('close')
})

client.start()