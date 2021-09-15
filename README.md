# Bull Cow
## A simple word game built using [Cloudflare Worker](https://workers.cloudflare.com)

Bull Cow is a word guessing game, specifically built for older kids to learn new words and understand the meaning, at the same time have fun and challenge. The system presents you a four lettered word which you need to guess in one or more attempts. When you guess a word, the system compares the letters in the word you guessed and the actual word. Letters which are in the same position counts as Bull and letters that are present but not in the right position is counted as Cows. When you guess the word right, you have four bulls and you have succeeded in guessing the right word. Word could be plural and may contain repeating letters. You have 30 minutes once you start playing. Your session will become invalid after 30 minutes and you will not be able to know the word as well. The system only allows valid dictionary words and shows the meaning of the word after a guess is made and is a valid word.

You can play the game [here](https://www.rameshrajamani.com/game). The UI is on a separate Cloudflare worker and the actual game is built on a separater worker which is API driven. The UI is simple and desktop browser driven (not mobile compatible). The API can directly be used to play from the console.

This repo is the backend worker. The backend API can be accessed with the base url ht<span>tps://</span>bullcow.rameshrajamani.com

The code uses [Free Dictionary API](https://github.com/meetDeveloper/freeDictionaryAPI) for validation of words. It uses [Cloudflare KV](https://developers.cloudflare.com/workers/learning/how-kv-works) to store the random word selected and compare when a user makes a guess. A key (random uuid) and value (random word) is used for every user session with an expiry of 30 minutes.

## Usage

### Start a new game

```/fetch``` - Returns a Session ID sid, that has to be used to guess the word or giveup API calls.

#### Example CURL call
```
curl -H 'Content-Type: application/json' -X POST -d '{}' https://bullcow.rameshrajamani.com/fetch
```

#### Example Response
```
{
	"status": "OK",
	"sid": "a8f0cb24-7c98-4edb-9f08-2b3dbf791f98"
}
```

### Guess the word

```/guess``` - Matches the word with the actual and returns the number of letters that are present and match same position (bulls) and the number of letters that are present but are in different positions (cows). Also includes the one of the meanings of the word and part of speech. If the word is not a valid word in the dictionary, it returns a `422` HTTP status error.

#### Response details
A successful `JSON` response contains the following keys.

`status` - Call Status, one of `"OK"` or `"Error"`\
`message` - Description of output\
`word` - Guessed word\
`bull` - Number of letters that are present and match at exact position(s)\
`cow` - Number of letters that are present but at different position(s)\
`dictionary` - if true indicates that a request to validate the dictionary was successful. If for some reason dictionary is not available for a comparison, this value is false and it matches any invalid word as well.\
`validWord` - true if there is a match in the dicationary for the given word. if `dictionary` is true and word is not found in dictionary, the response is `422` HTTP status, refer example below.\
`partOfSpeech` - Part of Speech like noun, verb, adjective etc.\
`meaning` - One of the meanings from the dictionary\

#### Example CURL call
```
curl -H 'Content-Type: application/json' -X POST -d '{"sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98", "word":"done"}' https://bullcow.rameshrajamani.com/guess
```
#### Example response
```
{
	"status": "OK",
	"message": "Nope, not right, try again!",
	"word": "done",
	"bull": 1,
	"cow": 1,
	"dictionary": true,
	"validWord": true,
	"partOfSpeech": "verb",
	"meaning": "Used with a standard past tense verb to indicate absoluteness or completion."
}
```

The above response means that one letter in the word "done" matches at the exact position with the actual word, and one letter is present in the actual word but at a different position.

#### Example invalid word call and response

```
curl -v -H 'Content-Type: application/json' -X POST -d '{"sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98", "word":"dood"}' http://localhost:8787/guess

HTTP/1.1 422 Unprocessable Entity

{
	"status": "Error",
	"message": "Not a dictionary word. Please enter a meaningful word"
}
```
### Give up

```/giveup``` - Give up the game and reveal the actual word the system has thought of. Gives back the meaning from the dictionary for the word.

### Example CURL call

```
curl -H 'Content-Type: application/json' -X POST -d '{"sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98"}' https://bullcow.rameshrajamani.com/giveup
```

#### Example response
```
{
	"status": "OK",
	"message": "Sorry you could'nt figure it.",
	"word": "fade",
	"dictionary": true,
	"validWord": true,
	"partOfSpeech": "intransitive verb",
	"meaning": "Gradually grow faint and disappear."
}
```

The session is limited to 30 minutes. After 30 minutes it expires and you will not be able to guess or give up and know the word. Both `guess` and `givup` API returns a `422` HTTP Status response with an error message.

```
curl -v -H 'Content-Type: application/json' -X POST -d '{"sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98", "word":"game"}' https://bullcow.rameshrajamani.com/giveup

HTTP/1.1 422 Unprocessable Entity

{
	"status": "Error",
	"message": "Error. Either the session is invalid/stale or you did'nt guess the word within 30 minutes"
}
```
