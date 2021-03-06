import { uuid } from '@cfworker/uuid';
const Router = require('@tsndr/cloudflare-worker-router')
const randomWords = require('random-words')
const router = new Router()

router.cors()

// Pick a new word for the game
router.post('/fetch', async (req, res) => {
    // Keep it simple, use only 4 lettered word
    const wantSize = 4
    var rword = ''
    // Find a random 4 lettered word
    while(rword.length != wantSize) {
        rword = randomWords({exactly: 1, maxLength: 4})[0]
    }
    const suuid = uuid()
    // Store the random word in KV with expiry as defined in SESSIONTTL
    // TTL is to ensure we dont have stale KV's lying around forever
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

// Handle user guess
router.post('/guess', async (req, res) => {
    const content = req.body
    const suuid = content['sid']
    const gword = content['word']
    // Basic sanity check
    if (typeof(suuid) == "undefined" || typeof(gword) == "undefined" || suuid === null || gword === null) {
        res.status = 422
        res.body = {
            status: 'Error',
            message: 'Error. Invalid rquest. Ensure sid and guess word is provided'
        }
        return
    }   
    // Get the actual word from KV by uuid for comparison
    const word = await USESSION.get(suuid)

    // Ensure if session has already not expired
    if (typeof(word) == "undefined" || word === null) {
        res.status = 422
        res.body = {
            status: 'Error',
            message: 'Error. Either the session is invalid/stale or you did\'nt guess the word within ' + SESSIONTTL/60 + ' minutes'
        }
        return
    }
    // Ensure the guessed word is a valid word and get the first meaning presented
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
    // Condition ensures the game can still be played if Dictionary service is not available
    if(dict == null || dictStatus == true) {
        const [err, bull, cow] = bullCow(word, gword)
        if (err == null) {
            // Yay, the guess is right
            if(bull == word.length) {
                await USESSION.delete(suuid)
                res.body = {
                    status: 'OK',
                    message: 'Yay! You got it!',
                    word: gword,
                    bull: bull,
                    cow: cow,
                    dictionary : fetchStatus,
                    validWord: dictStatus,
                    partOfSpeech: partOfSpeech,
                    meaning: meaning                   
                }
            } else {
                // Find any matching letters
                res.body = {
                    status: 'OK',
                    message: 'Nope, not right, try again!',
                    word: gword,
                    bull: bull,
                    cow: cow,
                    dictionary : fetchStatus,
                    validWord: dictStatus,
                    partOfSpeech: partOfSpeech,
                    meaning: meaning
                }
            }
        } else {
            // Oh no, not here
            res.status = 500
            res.body = {
                status: 'Error',
                message: 'Something wrong, did you enter the word with right length? Try again'
            }
        }
    } else {
        // Not a proper word according to the Dictionary
        res.status = 422
        res.body = {
            status: 'Error',
            message: 'Not a dictionary word. Please enter a meaningful word',
        }
    }
})

// User gives up, lets reveal the actual word
router.post('/giveup', async (req, res) => {
    const content = req.body
    const suuid = content['sid']
    // Basic sanity check
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
        // Well too late, session expired hence no way to retrieve the word
        res.status = 400
        res.body = {
            status: 'Error',
            message: 'Error. Either the session is invalid/stale or you did\'nt guess the word within ' + SESSIONTTL/60 + ' minutes'
        }
        return
    }
    // Clear the KV
    await USESSION.delete(suuid)
    // Show the meaning of the word as well
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
// Core logic to compare the word guessed with the system selected word
function bullCow(word, guess) {
    // Sanity check
    if(word.length == 0 || guess.length == 0) {
        console.log("Error - One of the string is empty")
        return ["One of the string is empty", -1, -1]
    } else if(word.length != guess.length) {
        console.log("Error - Words are not of equal length")
        return ["Words are not of equal length", -1, -1]
    }
    // Let the case not cause a problem in comparison, lets lowercase
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

// Fetch meaning of a word from Dictionary API
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

