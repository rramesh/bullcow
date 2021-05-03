# Bull Cow
## A simple word game built using [Cloudflare Worker](https://workers.cloudflare.com)

Bull Cow is a word guessing game. The system presents you a four lettered word which you need to guess in one or more attempts. When you guess a word, the system compares the letters in the word you guessed and the actual word. Letters which are in the same position counts as Bull and letters that are present but not in the right position is counted as Cows. When you guess the word right, you have four bulls and you have succeeded in guessing the right word. Word could be plural and may contain repeating letters. You have 30 minutes once you start playing. Your session will become invalid after 30 minutes and you will not be able to know the word as well.

You can try it [here](https://www.rameshrajamani.com/game). The UI is on a separate worker and the actual game is built on a separater worker which is API driven. This repo is the backend worker. The backend API can be accessed with the base url https://bullcow.rameshrajamani.com


## Usage

### Start a new game

```/fetch``` - Returns a Session ID sid, that has to be used to guess the word or giveup API calls.

#### Example CURL call
```
curl -H 'Content-Type: application/json' -X POST -d '{}' https://bullcow.rameshrajamani.com/fetch
```

#### Example Response
```
{"status":"OK","sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98"}
```

### Guess the word

```/guess``` - Matches the word with the actual and returns the number of letters that are present and match same position (bulls) and the number of letters that are present but are in different positions (cows).

#### Example CURL call
```
curl -H 'Content-Type: application/json' -X POST -d '{"sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98", "word":"done"}' https://bullcow.rameshrajamani.com/guess
```
#### Example Response
```
{"status":"OK","message":"Nope, not right, try again!","bull":1,"cow":1}
```

The abov response means that one letter in the word "done" matches at the exact position with the actual word, and one letter is present in the actual word but at a different position.

### Give up

```/giveup``` - Give up the game and reveal the actual word the system has thought of.

### Example CURL call

```
curl -H 'Content-Type: application/json' -X POST -d '{"sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98", "word":"done"}' https://bullcow.rameshrajamani.com/giveup
```

#### Example Response
```
{"status":"OK","message":"Sorry you could'nt figure it.","word":"name"}
```

The session is limited to 30 minutes. After 30 minutes it expires and you will not be able to guess or give up and know the word.

```
curl -H 'Content-Type: application/json' -X POST -d '{"sid":"a8f0cb24-7c98-4edb-9f08-2b3dbf791f98", "word":"game"}' https://bullcow.rameshrajamani.com/giveup
{"status":"Error","message":"Error. Either the session is invalid/stale or you did'nt guess the word within 30 minutes"}
```
