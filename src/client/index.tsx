interface State {
    count: number;
    data: string;
}

interface Player {
    sockId: string,
    name: string
}

interface Hands {
    board1WhiteHand?: string[],
    board1BlackHand?: string[],
    board2WhiteHand?: string[], 
    board2BlackHand?: string[]
}

interface Players {
    board1w?: Player,
    board1b?: Player,
    board2w?: Player,
    board2b?: Player
}


class App {
    sock: SocketIOClient.Socket;
    me: {
        boardName: string,
        color: string
    }
    board1: ChessBoardInstance;
    board2: ChessBoardInstance;
    playerInputs: {
        board1w: HTMLInputElement,
        board1b: HTMLInputElement,
        board2w: HTMLInputElement,
        board2b: HTMLInputElement
    };
    hands: Hands;
    game1: {boardName: string, state: Chess};
    game2: {boardName: string, state: Chess};

    constructor(private rootElem: HTMLElement, name: string) {
        this.sock = io(name);
        this.sock.on('gameChanged', this.gameChanged);
        this.sock.on('initGame', this.initGame);
        this.sock.on('playerNameChanged', this.playerNameChanged);
        this.sock.on('pieceCaptured', this.pieceCaptured);
        const board1Config: ChessBoardJS.BoardConfig = {
            showNotation: false,
            draggable: true,
            onDrop: this.onDrop.bind(this),
            onDragStart: this.onDragStart.bind(this),
            onSnapEnd: this.onSnapEnd.bind(this),
            sparePieces: true
        }
        const board2Config: ChessBoardJS.BoardConfig = {
            showNotation: false,
            draggable: true,
            onDrop: this.onDrop,
            onDragStart: this.onDragStart,
            onSnapEnd: this.onSnapEnd,
            orientation: 'black',
            sparePieces: true
        }
        
        const board1El = document.getElementById('board1')!;
        const board2El = document.getElementById('board2')!;
        this.board1 = ChessBoard(board1El, board1Config);
        this.board2 = ChessBoard(board2El, board2Config);
        this.game1 = {
            state: new Chess(),
            boardName: "1"
        };
        this.game2 = {
            state: new Chess(),
            boardName: "2"
        };

        let hands: Hands = {
            board1BlackHand: [],
            board1WhiteHand: [],
            board2BlackHand: [],
            board2WhiteHand: []
        }
        this.hands = hands;

        this.playerInputs = {} as any;
        const playerNameInputs = document.getElementsByName('player-name');
        for (var i = 0; i < playerNameInputs.length; i++) {
            const input = playerNameInputs[i];
            (this.playerInputs as any)[input.dataset.position!] = input;
            input.addEventListener('change', this.onPlayerNameChange);
        }

        this.addClassesToSparePiece();
    }

    initGame = (boards: {fen1: string , fen2: string}, players: Players) => {
        this.game1.state.load(boards.fen1);
        this.game2.state.load(boards.fen2);
        this.board1.position(boards.fen1);
        this.board2.position(boards.fen2);

        this.updateTurnIndicator(this.game1.boardName, this.game1.state.turn());
        this.updateTurnIndicator(this.game2.boardName, this.game2.state.turn());

        if (players.board1w)
                this.playerInputs.board1w.value = players.board1w.name;
        if (players.board1b)
                this.playerInputs.board1b.value = players.board1b.name;
        if (players.board2w)
                this.playerInputs.board2w.value = players.board2w.name;
        if (players.board2b)
                this.playerInputs.board2b.value = players.board2b.name;

        this.updateEndingModal();
    }

    onPlayerNameChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        const id = input.dataset.position;
        const newPlayerName = input.value;
        this.sock.emit('playerNameChanged', id, newPlayerName, this.nameChangeConfirmed);
    }

    nameChangeConfirmed = (playerId: string) => {
        // Set player's board position
        switch (playerId) {
            case "board1w":
                this.me = {boardName: "1", color: "w"};
                break;
            case "board1b":
                this.me = {boardName: "1", color: "b"};
                break;
            case "board2w":
                this.me = {boardName: "2", color: "w"};
                break;
            case "board2b":
                this.me = {boardName: "2", color: "b"};
                break;
        }

        for (let key in this.playerInputs) {
            let input = this.playerInputs[key as keyof Players];
            input.disabled = (key !== playerId);
        }
    }

    playerNameChanged = (playerId: keyof Players, name: string) => {
        console.log(name);
        const input = this.playerInputs[playerId];
        if (input) {
            input.value = name;
        }
    }

    gameChanged = (boardname: string, fen: string, hands: Hands) => {
        console.log("Game changed on board", boardname);
        if (boardname === "1") {
            this.game1.state.load(fen);
            this.board1.position(fen);
            this.updateTurnIndicator(boardname, this.game1.state.turn());
            if (this.game1.state.in_checkmate()) {
                const playerName = `#board1${this.game1.state.turn()}`;

            }
        } else if (boardname === "2") {
            this.game2.state.load(fen);
            this.board2.position(fen);
            this.updateTurnIndicator(boardname, this.game2.state.turn());
        }
        this.updateEndingModal();
        this.hands = hands;
        this.updateHands();
    }

    // do not pick up pieces if the game is over
    // only pick up pieces for the side to move
    onDragStart = (
        source: string,
        piece: string,
        position: string,
        orientation: string) => {

        // prevent drag if player has not joined the game
        if (!this.me) return false;
        // prevent drag if either game is over
        if (this.game1.state.game_over() || this.game2.state.game_over()) return false;
        // prevent drag if it's on the wrong board
        if (this.me.boardName === "1" && orientation === "black") return false;
        if (this.me.boardName === "2" && orientation === "white") return false;
        // prevent move if it's the wrong color
        if (this.me.color === "w" && piece.search(/^b/) !== -1) return false;
        if (this.me.color === "b" && piece.search(/^w/) !== -1) return false;
        // prevent move if it's not your turn
        if (this.me.boardName === "1" && this.game1.state.turn() !== this.me.color) return false;
        if (this.me.boardName === "2" && this.game2.state.turn() !== this.me.color) return false;
    }

    onDrop = (
        source: string,
        target: string,
        piece: string,
        newPos: object,
        oldPos: object,
        orientation: string) => {

        const boardName = this.me.boardName;
        const gameEngine = (boardName === "1") ? this.game1.state : this.game2.state;
        const move = gameEngine.move({
            from: source,
            to: target,
            promotion: 'q' // TODO: allow user to pick promotion piece
        });

        this.updateTurnIndicator(boardName, gameEngine.turn());
        this.updateEndingModal();

        // illegal move
        if (!move) return 'snapback';

        console.log("I'm sending a move", move);
        this.sock.emit('move', {
            board: this.me.boardName,
            move: move
        });
    }

    updateTurnIndicator(boardName: string, turn: string) {
        if (turn === "w") {
            // You asked for this
            $(`#board${boardName}w .player-name`).addClass("active");
            $(`#board${boardName}b .player-name`).removeClass("active");
        } else {
            $(`#board${boardName}b .player-name`).addClass("active");
            $(`#board${boardName}w .player-name`).removeClass("active");
        }
    }

    updateEndingModal() {
        if (this.game1.state.in_checkmate()) {
            const $modal = $("#board1").siblings(".modal");
            $modal.addClass("active");
            const color = this.game2.state.turn() === "w" ? "b" : "w";
            const playerKey = "board1" + color as keyof Players;
            const playerName = this.playerInputs[playerKey].value || color;
            $modal.children("h3").text(`${playerName} won!`);
        } else if (this.game2.state.in_checkmate()) {
            const $modal = $("#board2").siblings(".modal");
            $modal.addClass("active");
            const color = this.game2.state.turn() === "w" ? "b" : "w";
            const playerKey = "board2" + color as keyof Players;
            const playerName = this.playerInputs[playerKey].value || color;
            $modal.children("h3").text(`${playerName} won!`);
        }
    }

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    onSnapEnd = () => {
        if (this.me.boardName === "1")
            this.board1.position(this.game1.state.fen());
        else
            this.board2.position(this.game2.state.fen());
    }

    pieceCaptured = (hands: Hands) => {
        this.hands = hands;
        this.updateHands();
    }

    addClassesToSparePiece = () => {
        let index = 0;
        //The order of all of the groups of spare pieces are b w w b
        let sparePieces = $(".spare-pieces-7492f").children().toArray();        
        for(let j = 0; j < 4; j ++){
            for(let i = 0; i < 6; i++){            
            switch(i){
                    case 0: sparePieces[index].className += (" k");                    
                                            break;
                    case 1: sparePieces[index].className += (" q");                    
                                            break;
                    case 2: sparePieces[index].className += (" r");                    
                                            break;
                    case 3: sparePieces[index].className += (" b");                    
                                            break;
                    case 4: sparePieces[index].className += (" n");                    
                                            break;
                    case 5: sparePieces[index].className += (" p");                    
                                            break;
                }

                if (j === 1 || j === 4) {
                    sparePieces[index].className += (" black");
                }
                else if (j === 2 || j === 3) {
                    sparePieces[index].className += (" white");
                }

                sparePieces[index].className += (" hidden"); //Hide them all
                index++;

            }
        }
    }

    updateHands = () => {
        let sparePieces = $(".spare-pieces-7492f").children().toArray();       
        
        this.hands.board1BlackHand!.forEach((element) =>  {
            switch (element) { //Never the king
                case 'q': sparePieces[1].classList.remove('hidden');
                break;
                case 'r': sparePieces[2].classList.remove('hidden');
                break;
                case 'b': sparePieces[3].classList.remove('hidden');
                break;
                case 'n': sparePieces[4].classList.remove('hidden');
                break;
                case 'p': sparePieces[5].classList.remove('hidden'); 
                break;               
            }
        });

        this.hands.board1WhiteHand!.forEach((element) => {
            switch (element) {
                case 'q': sparePieces[7].classList.remove('hidden');
                break;
                case 'r': sparePieces[8].classList.remove('hidden');
                break;
                case 'b': sparePieces[9].classList.remove('hidden');
                break;
                case 'n': sparePieces[10].classList.remove('hidden');
                break;
                case 'p': sparePieces[11].classList.remove('hidden');
                break;                
            }
        });

        this.hands.board2WhiteHand!.forEach((element) => {
            switch (element) {
                case 'q': sparePieces[13].classList.remove('hidden');
                break;
                case 'r': sparePieces[14].classList.remove('hidden');
                break;
                case 'b': sparePieces[15].classList.remove('hidden');
                break;
                case 'n': sparePieces[16].classList.remove('hidden');
                break;
                case 'p': sparePieces[17].classList.remove('hidden'); 
                break;           
            }
        });

        this.hands.board2BlackHand!.forEach((element) => {
            switch (element) {
                case 'q': sparePieces[19].classList.remove('hidden');
                break;
                case 'r': sparePieces[20].classList.remove('hidden');
                break;
                case 'b': sparePieces[21].classList.remove('hidden');
                break;
                case 'n': sparePieces[22].classList.remove('hidden');
                break;
                case 'p': sparePieces[23].classList.remove('hidden');  
                break;              
            }
        });             
    }
}

declare interface Window {
    app?: App;
}

function initSession(name: string) {
    console.log("Creating new session: " + name);
    const elem = document.getElementById('root')!;
    window.app = new App(elem, name);
}
