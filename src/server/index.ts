/// <reference path="../chess.d.ts" />

import * as express from 'express';
import * as http from 'http';
import * as handlebars from 'express-handlebars';
import * as path from 'path';
import * as socket from 'socket.io';
import * as bodyParser from 'body-parser';
import { Chess } from 'chess.js';
import { MoveData } from '../models'

const app = express();
const server = (http as any).Server(app);
const io = socket.listen(server);

app.engine('handlebars', handlebars({
	defaultLayout: 'main',
}));
app.set('view engine', 'handlebars');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use('/', express.static('./public'));
app.use('/lib', express.static('./node_modules'));
app.use('/src', express.static('./src'));
app.use('/session/img', express.static('./public/img'));

app.get('/', function(req, res) {
	res.render('home', { sessions });
});

interface Player {
	sockId: string,
	name: string
}

interface Players {
	board1White?: Player,
	board1Black?: Player,
	board2White?: Player,
	board2Black?: Player
}

interface Session {
	name: string;
	players: Players;
	namespace: SocketIO.Namespace;
	game1: Chess;
	game2: Chess;
}

const sessions: { [name: string]: Session } = {};

app.get('/session/:name', function(req, res) {
	const name: string = req.params.name;
	if (!sessions[name]) {
		const gameSession: Session = {
			name,
			players: {},
			namespace: io.of(name),
			game1: new Chess(),
			game2: new Chess()
		};
		sessions[name] = gameSession;
		gameSession.namespace.on('connection', function(sock) {
            const id = sock.id;
			const fen = gameSession.game1.fen();
			const fen2 = gameSession.game2.fen();
            const players = gameSession.players;
			console.log("Game 1: " + fen);
			console.log("Game 2: " + fen2);
			sock.emit('initGame', {fen, fen2}, players);
			sock.on('move', function(moveData: MoveData) {
				console.log("I received a move", moveData.move
				            + " from board " + moveData.board);
				if(moveData.board === "1"){ //For game 1
					gameSession.game1.move(moveData.move);
					const fen: string = gameSession.game1.fen();
					console.log("Sending fen", fen);
					sock.broadcast.emit('gameChanged', {board: moveData.board, move: fen});
				}
				else if(moveData.board === "2"){ //For game 2
					gameSession.game2.move(moveData.move);
					const fen: string = gameSession.game2.fen();
					console.log("Sending fen", fen);
				   sock.broadcast.emit('gameChanged', {board: moveData.board, move: fen2});
                }
            });

            sock.on('playerNameChanged', function(playerId: keyof Players, name: string) {
				console.log('Received player name: ', playerId, name);
                gameSession.players[playerId] = {
                    sockId: id,
                    name: name
                }
                sock.broadcast.emit('playerNameChanged', playerId, name);
            });
		});
	}

	res.render('session', { name });
});

app.post('/session', function(req, res) {
	const newSessionName: string = req.body.newSessionName;
	if (newSessionName)	res.redirect('/session/' + newSessionName);
});

const port = process.env.PORT || 3000;
server.listen(port);
