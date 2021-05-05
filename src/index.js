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
    const dict = await(dictionary(gword))
    var fetchStatus = false
    var dictStatus = false
    var partOfSpeech = ""
    var meaning = ""
    if(dict != null) {
        fetchStatus = true
        if(dict[0] == true) {
            dictStatus = true
            partOfSpeech = dict[1]
            meaning = dict[2]
        }
    }
    if(dict == null || dictStatus == true) {
        const [err, bull, cow] = bullCow(word, gword)
        if (err == null) {
            if(bull == word.length) {
                await USESSION.delete(suuid)
                res.body = {
                    status: 'OK',
                    message: 'Yay! You got it!',
                    bull: bull,
                    cow: cow,
                    dictionary : fetchStatus,
                    validWord: dictStatus,
                    partOfSpeech: partOfSpeech,
                    meaning: meaning                   
                }
            } else {
                res.body = {
                    status: 'OK',
                    message: 'Nope, not right, try again!',
                    bull: bull,
                    cow: cow,
                    dictionary : fetchStatus,
                    validWord: dictStatus,
                    partOfSpeech: partOfSpeech,
                    meaning: meaning
                }
            }
        } else {
            res.status = 500
            res.body = {
                status: 'Error',
                message: 'Something wrong, did you enter the word with right length? Try again'
            }
        }
    } else {
        res.status = 422
        res.body = {
            status: 'Error',
            message: 'Not a dictionary word. Please enter a meaningful word',
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
    const dict = await(dictionary(word))
    var fetchStatus = false
    var dictStatus = false
    var partOfSpeech = ""
    var meaning = ""
    if(dict != null) {
        fetchStatus = true
        if(dict[0] == true) {
            dictStatus = true
            partOfSpeech = dict[1]
            meaning = dict[2]
        }
    }
    res.body = {
        status: 'OK',
        message: 'Sorry you could\'nt figure it.',
        word: word,
        dictionary : fetchStatus,
        validWord: dictStatus,
        partOfSpeech: partOfSpeech,
        meaning: meaning
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

async function dictionary(word) {
    const url = "https://api.dictionaryapi.dev/api/v2/entries/en_US/" + word
    const init = {
        headers: {},
    }
    var result = [true];
    try {
        const response = await fetch(url, init)
        const data = await response.json()
        const mng = data[0];
        if (typeof(mng) == "undefined") {
            const notfound = data.title;
            if(typeof(notfound) == "undefined") {
                result = null;
            } else {
                result[0] = false
                result.push("Not a dictionary word. Please enter a meaningful word");
            }
        } else {
            if (typeof(mng.meanings[0]) == "undefined") {
                result = null
            } else {
                result.push(mng.meanings[0].partOfSpeech);
                result.push(mng.meanings[0].definitions[0].definition);
            }
        }
    } catch (e) {
        console.log("Error fetching dictionary")
        console.log(e.stack)
        result = null
    }
    return result
}

