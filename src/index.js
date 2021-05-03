import { uuid } from '@cfworker/uuid';
const Router = require('@tsndr/cloudflare-worker-router')
const randomWords = require('random-words')
const router = new Router()

router.cors()

router.post('/fetch', async (req, res) => {
    const wantSize = 4
    var rword = ''
    while(rword.length != wantSize) {
        rword = randomWords({exactly: 1, maxLength: 4})[0]
    }
    const suuid = uuid()
    try {
        await USESSION.put(suuid, rword, {expirationTtl: SESSIONTTL})
        res.body = {
            status: "OK",
            sid: suuid
        }
    } catch (e) {
        console.log(e.stack)
        res.status = 500
        res.body = {
            status: "error",
            message: "An internal server error occured"
        }
    }
})

router.post('/guess', async (req, res) => {
    const content = req.body
    const suuid = content['sid']
    const gword = content['word']

    if (typeof(suuid) == "undefined" || typeof(gword) == "undefined" || suuid === null || gword === null) {
        res.status = 422
        res.body = {
            status: 'Error',
            message: 'Error. Invalid rquest. Ensure sid and guess word is provided'
        }
        return
    }   

    const word = await USESSION.get(suuid)

    if (typeof(word) == "undefined" || word === null) {
        res.status = 422
        res.body = {
            status: 'Error',
            message: 'Error. Either the session is invalid/stale or you did\'nt guess the word within ' + SESSIONTTL/60 + ' minutes'
        }
        return
    }

    const [err, bull, cow] = bullCow(word, gword)
    if (err == null) {
        if(bull == word.length) {
            await USESSION.delete(suuid)
            res.body = {
                status: 'OK',
                message: 'Yay! You got it!',
                bull: bull,
                cow: cow
            }
        } else {
            res.body = {
                status: 'OK',
                message: 'Nope, not right, try again!',
                bull: bull,
                cow: cow
            }
        }
    } else {
        res.status = 500
        res.body = {
            status: 'Error',
            message: 'Something wrong, did you enter the word with right length? Try again'
        }
    }
})

router.post('/giveup', async (req, res) => {
    const content = req.body
    const suuid = content['sid']
    
    if (typeof(suuid) == "undefined" || suuid === null) {
        res.status = 422
        res.body = {
            status: 'Error',
            message: 'Error. Invalid rquest. Ensure sid is provided'
        }
        return
    }

    const word = await USESSION.get(suuid)

    if (word === null) {
        res.status = 400
        res.body = {
            status: 'Error',
            message: 'Error. Either the session is invalid/stale or you did\'nt guess the word within ' + SESSIONTTL/60 + ' minutes'
        }
        return
    }
    await USESSION.delete(suuid)
    res.body = {
        status: 'OK',
        message: 'Sorry you could\'nt figure it.',
        word: word
    }
})

addEventListener('fetch', event => {
    event.respondWith(router.handle(event))
})

function bullCow(word, guess) {
    if(word.length == 0 || guess.length == 0) {
        console.log("Error - One of the string is empty")
        return ["One of the string is empty", -1, -1]
    } else if(word.length != guess.length) {
        console.log("Error - Words are not of equal length")
        return ["Words are not of equal length", -1, -1]
    }
    word = word.toLowerCase()
    guess = guess.toLowerCase()
    var bull = 0
    var cow = 0
    for(var i=0; i<guess.length; i++) {
        if(word.charAt(i) == guess.charAt(i)) {
            bull = bull + 1
            continue
        }
        if(word.includes(guess.charAt(i))) {
            cow = cow + 1
        }
    }
    return [null, bull, cow]
}
