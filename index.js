const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

let boardId;
const players = new Map();
const idToPlayer = new Map();
const playerHand = new Map();
let dealer = 0; // index of player keys

app.get('/', (req, res) => {
  if(req.query.type === 'b') {
    res.sendFile(__dirname + '/board.html');
  } else {
    res.sendFile(__dirname + '/player.html');
  }
});

const clearState = () => {
  console.log('clearing state');
  players.forEach((value, key) => {
    io.to(value).emit('clear'); // tell client to clear display
    playerHand.set(key, []); // clearing player cards on server
  });
}

io.on('connection', (socket) => {
  socket.on('identify', msg => {
    console.log('identify', msg);

    if (msg.type === 'board') {
      boardId = socket.id;
    } else if (msg.type === 'player') {
      players.set(msg.username, socket.id);
      idToPlayer.set(socket.id, msg.username);
      playerHand.set(msg.username, []); // initing player cards
    }

    io.to(boardId).emit('players', Array.from(players.keys()));
    console.log('boardId', boardId);
    console.log('players', players.keys());
  });

  socket.on("disconnect", () => {
    console.log('disconnected', socket.id);
    const disconnectedPlayer = idToPlayer.get(socket.id);
    players.delete(disconnectedPlayer);
    idToPlayer.delete(socket.id);
    playerHand.delete(disconnectedPlayer, [])

    io.to(boardId).emit('players', Array.from(players.keys()));
    console.log('players', players);
  });
});

 // spade, heart, dimond, club
const suits = ['1F0A', '1F0B', '1F0C', '1F0D'];
const values = ['1', '2', '3', '4', '5', '6',
                 '7', '8', '9', 'A', 'B', 'D', 'E'];

const suitName = {
  '1F0A': 'spade', 
  '1F0B': 'heart',
  '1F0C': 'diamond', 
  '1F0D': 'club'
};

let shuffledDeck = [];

const shuffle = () => {
  const deck = [];
  // create a deck of cards
  for (let i = 0; i < suits.length; i++) {
      for (let x = 0; x < values.length; x++) {
          let name = suitName[suits[i]];
          deck.push({card: `${suits[i]}${values[x]}`, className: name })
      }
  }
  // shuffle the cards
  let count = deck.length;
  while(count) {
    deck.push(deck.splice(Math.floor(Math.random() * count), 1)[0]);
    count -= 1;
  }

  return deck;
}

const notifyDealer = () => {
  const p = Array.from(players.keys());
  const playerId = players.get(p[dealer]);
  io.to(playerId).emit('button');
  dealer = (dealer + 1) % p.length;
  console.log("Dealer", p[dealer]);
};

io.on('connection', (socket) => {
  socket.on("start", () => {
    clearState();
    notifyDealer();

    console.log('starting shuffle');
    shuffledDeck = shuffle();

    players.forEach((value, key) => {
      console.log('dealing 1st card to %s', key)
      playerHand.set(key, []);

      const card = shuffledDeck.pop();
      io.to(value).emit('first card', card);
      playerHand.get(key).push(card);

    });

    players.forEach((value, key) => {
      console.log('dealing 2nd card to %s', key)
      
      const card = shuffledDeck.pop();
      io.to(value).emit('second card', card);
      playerHand.get(key).push(card);
    })
  });

  socket.on('flop', () => {
    console.log('going to flop');
    shuffledDeck.pop(); // burn card
    const flop = [];

    for (i=0; i<3;i++) {
      flop.push(shuffledDeck.pop());
    }
    io.to(boardId).emit('show card', flop);
  });

  socket.on('turn', () => {
    console.log('going to turn');
    shuffledDeck.pop(); // burn card
    io.to(boardId).emit('show card', [shuffledDeck.pop()]);
  });

  socket.on('river', () => {
    console.log('going to river');
    shuffledDeck.pop(); // burn card
    io.to(boardId).emit('show card', [shuffledDeck.pop()]);
  });

  socket.on('clear', () => {
    console.log('clearing');
    players.forEach((value, key) => {
      io.to(value).emit('clear'); // tell client to clear display
      playerHand.set(key, []); // clearing player cards on server
    });
  });

  socket.on('show hand', () => {
    const player = idToPlayer.get(socket.id);
    console.log('showing hand', player);
    io.to(boardId).emit('show hand', {player, hand: playerHand.get(player)});
  });
});



http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});
