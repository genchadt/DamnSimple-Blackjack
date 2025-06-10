// src/debug/debugmanager-ts
import { Scene, Vector3 } from "@babylonjs/core";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState, GameResult } from "../game/GameState";
import { Card, Suit, Rank } from "../game/Card";
import { GameScene } from "../scenes/GameScene";
import { CardVisualizer } from "../scenes/components/CardVisualizer";
import { GameUI } from "../ui/GameUI";
import { Constants } from "../Constants";

export class DebugManager {
    private gameScene: GameScene;
    private blackjackGame: BlackjackGame;
    private cardVisualizer: CardVisualizer;
    private gameUI: GameUI;

    private debugHandDisplayElement: HTMLElement | null = null;
    private isHandDisplayVisible: boolean = false;

    // --- New properties for debug menu ---
    private debugMenuElement: HTMLElement | null = null;
    private isDebugMenuVisible: boolean = false;
    private openSubMenu: HTMLElement | null = null;
    private activeSubMenuTrigger: HTMLElement | null = null;
    private activeCustomPromptElement: HTMLElement | null = null; // For custom dialog
    private customPromptConfirmCallback: ((value: string | null) => void) | null = null;
    private customPromptEscapeListener: ((event: KeyboardEvent) => void) | null = null;
    private boundHandleSubMenuAccessKeys = this.handleSubMenuAccessKeys.bind(this);


    // --- Properties for dragging ---
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private isDragging: boolean = false;
    private draggedElement: HTMLElement | null = null;


    // --- New properties for advanced debug display ---
    private handHistory: { player: Card[], dealer: Card[] }[] = [];
    private readonly MAX_HISTORY_ENTRIES = 10;
    private historyIndex: number = -1; // -1 means current hand, 0 is most recent history, etc.

    // Store last known hands to detect changes (deal/discard)
    private lastPlayerHand: Card[] = [];
    private lastDealerHand: Card[] = [];

    /**
     * Initializes a new instance of the DebugManager class.
     */
    constructor(gameScene: GameScene, cardVisualizer: CardVisualizer, blackjackGame: BlackjackGame) {
        this.gameScene = gameScene;
        this.blackjackGame = blackjackGame;
        this.cardVisualizer = cardVisualizer;
        this.gameUI = gameScene.getGameUI();

        (window as any).debug = this;
        (window as any).game = this.blackjackGame;
        (window as any).scene = gameScene.getScene();
        (window as any).cardViz = this.cardVisualizer;
        (window as any).gameUI = this.gameUI;

        document.addEventListener('click', this.handleGlobalClick, true);

        console.log("Debug manager initialized. Type 'debug.help()' for available commands.");
    }

    /**
     * Prints a list of available debug commands and their descriptions.
     */
    public help(): void {
        console.log("%cBlackjack Debug Commands", "font-size: 16px; font-weight: bold; color: #4CAF50;");
        console.log("%cGame State Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setGameState(state) - Set game state (0=Initial, 1=Betting, 2=Dealing, 3=PlayerTurn, 4=DealerTurn, 5=GameOver)");
        console.log("  debug.setGameResult(result) - Set game result (0=PlayerWins, 1=DealerWins, 2=Push, 3=PlayerBlackjack, 4=InProgress)");
        console.log("  debug.resetGame() - Reset the game to initial state");
        console.log("  debug.startNewGame(bet) - Start a new game with specified bet (clears table)");
        console.log("  debug.getState() - Get current game state information");

        console.log("%cCard Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.addCard(isPlayer, suit, rank, faceUp) - Add a card to player or dealer hand");
        console.log("  debug.clearCards(isPlayer) - Clear all cards from player or dealer hand");
        console.log("  debug.flipCard(isPlayer, index) - Flip a specific card");
        console.log("  debug.dealRandomCard(isPlayer, faceUp) - Deal a random card");
        console.log("  debug.renderCards() - Force re-render all cards (visuals in Babylon)");
        console.log("  debug.revealDealerHole() - Reveals the dealer's hole card");
        console.log("  debug.forceReshuffle() - Forces the deck to reshuffle.");

        console.log("%cFunds Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setFunds(amount) - Set player funds to specific amount");
        console.log("  debug.setBet(amount) - Set current bet to specific amount");
        console.log("  debug.resetFunds() - Reset player funds to default amount.");

        console.log("%cUI Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.updateUI() - Force UI update");
        console.log("  debug.toggleInspector() - Toggle Babylon.js inspector");
        console.log("  debug.toggleHandDisplay(visible?) - Toggle draggable display of current hands.");
        console.log("  debug.toggleDebugMenu(visible?) - Toggle the main debug menu window.");

        console.log("%cQuick Scenarios:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.forceWin(isPlayer) - Force player (true) or dealer (false) win.");
        console.log("  debug.forcePush() - Force a push result.");


        console.log("%cExamples:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.setGameState(3) - Set game to PlayerTurn");
        console.log("  debug.addCard(true, 'Hearts', 'A', true) - Add Ace of Hearts to player's hand face up");
        console.log("  debug.dealRandomCard(false, false) - Deal random card to dealer face down");
    }

    public setGameState(state: number): void {
        if (state < 0 || state >= Object.keys(GameState).length / 2) {
            console.error("Invalid game state. Use 0-" + (Object.keys(GameState).length / 2 - 1));
            return;
        }
        if (state === GameState.GameOver && this.blackjackGame.getGameState() !== GameState.GameOver) {
            this.recordHandHistory();
        }
        this.blackjackGame.getGameActions().setGameState(state as GameState, true, true);
        console.log(`Game state set to ${GameState[state]}`);
    }

    public setGameResult(result: number): void {
        if (result < 0 || result > 4) {
            console.error("Invalid game result. Use 0-4.");
            return;
        }
        this.blackjackGame.getGameActions().setGameResult(result as GameResult, true);
        this.updateUI();
        console.log(`Game result set to ${GameResult[result]}`);
    }

    public resetGame(): void {
        this.cardVisualizer.clearTable();
        this.blackjackGame.getGameActions().setGameState(GameState.Initial, true, true);
        this.blackjackGame.getGameActions().setGameResult(GameResult.InProgress, true);
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.setCurrentBet(0);
        this.blackjackGame.resetFunds();
        this.blackjackGame.insuranceTakenThisRound = false;
        this.blackjackGame.insuranceBetPlaced = 0;

        this.handHistory = [];
        this.historyIndex = -1;
        this.lastPlayerHand = [];
        this.lastDealerHand = [];

        console.log("Game reset to initial state, debug history cleared.");
    }

    public startNewGame(bet: number = Constants.MIN_BET): void {
        const currentState = this.blackjackGame.getGameState();
        if (currentState !== GameState.Initial &&
            currentState !== GameState.Betting &&
            currentState !== GameState.GameOver) {
            console.warn(`[DebugManager] Forcing game to Initial state before starting new game.`);
            this.resetGame();
        }
        const success = this.blackjackGame.startNewGame(bet);
        if (success) {
            console.log(`Started new game with bet: ${bet}`);
        } else {
            console.error(`Failed to start new game with bet ${bet}. Insufficient funds?`);
        }
        setTimeout(() => this.updateDebugHandDisplay(), 100);
    }

    public getState(): void {
        const gameState = this.blackjackGame.getGameState();
        const gameResult = this.blackjackGame.getGameResult();
        const playerScore = this.blackjackGame.getPlayerScore();
        const dealerScore = this.blackjackGame.getDealerScore();
        const playerFunds = this.blackjackGame.getPlayerFunds();
        const currentBet = this.blackjackGame.getCurrentBet();

        console.log("%cGame State Information", "font-weight: bold; color: #4CAF50;");
        console.log(`Game State: ${GameState[gameState]} (${gameState})`);
        console.log(`Game Result: ${GameResult[gameResult]} (${gameResult})`);
        console.log(`Player Score: ${playerScore}`);
        console.log(`Dealer Score: ${dealerScore} (value of face-up cards only unless revealed)`);
        console.log(`Player Funds: ${playerFunds}`);
        console.log(`Current Bet: ${currentBet}`);

        console.log("%cPlayer Hand:", "font-weight: bold; color: #2196F3;");
        this.blackjackGame.getPlayerHand().forEach((card, index) => {
            console.log(`  ${index}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
        });

        console.log("%cDealer Hand:", "font-weight: bold; color: #2196F3;");
        this.blackjackGame.getDealerHand().forEach((card, index) => {
            console.log(`  ${index}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
        });
        this.updateDebugHandDisplay();
    }

    public addCard(isPlayer: boolean, suit: string, rank: string, faceUp: boolean = true): void {
        if (!Object.values(Suit).includes(suit as Suit)) {
            console.error(`Invalid suit: ${suit}. Use Hearts, Diamonds, Clubs, or Spades.`);
            return;
        }
        if (!Object.values(Rank).includes(rank as Rank)) {
            console.error(`Invalid rank: ${rank}. Use 2-10, J, Q, K, or A.`);
            return;
        }

        const card = new Card(suit as Suit, rank as Rank);
        card.setFaceUp(faceUp);

        if (isPlayer) {
            this.blackjackGame.addCardToPlayerHand(card);
        } else {
            this.blackjackGame.addCardToDealerHand(card);
        }
        this.blackjackGame.getHandManager().registerFlipCallback(card);

        this.renderCards();
        this.updateUI();

        console.log(`Added ${card.toString()} to ${isPlayer ? 'player' : 'dealer'}'s hand (${faceUp ? 'face up' : 'face down'})`);
    }

    public clearCards(isPlayer: boolean): void {
        if (isPlayer) {
            this.blackjackGame.setPlayerHand([]);
        } else {
            this.blackjackGame.setDealerHand([]);
        }
        this.cardVisualizer.renderCards();
        this.updateUI();
        console.log(`Cleared ${isPlayer ? 'player' : 'dealer'}'s hand`);
    }

    public flipCard(isPlayer: boolean, index: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        if (index < 0 || index >= hand.length) {
            console.error(`Invalid card index: ${index}. Hand has ${hand.length} cards.`);
            return;
        }
        hand[index].flip();
        this.updateDebugHandDisplay();
        console.log(`Flipped ${isPlayer ? 'player' : 'dealer'}'s card at index ${index}`);
    }

    public revealDealerHole(): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].flip();
            console.log(`DEBUG: Revealed dealer hole card: ${dealerHand[0].toString()}`);
        } else {
            console.log("DEBUG: Dealer hole card already revealed or no cards dealt.");
        }
        this.updateDebugHandDisplay();
    }

    public dealRandomCard(isPlayer: boolean, faceUp: boolean = true): Card {
        const suits = Object.values(Suit);
        const ranks = Object.values(Rank);
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
        const card = new Card(randomSuit, randomRank);
        card.setFaceUp(faceUp);
        return card;
    }

    public renderCards(): void {
        this.cardVisualizer.renderCards();
        this.updateDebugHandDisplay();
        console.log("Cards re-rendered (Babylon visuals and debug display)");
    }

    public setFunds(amount?: number): void {
        let finalAmount: number;
        if (amount !== undefined) {
            if (amount < 0) {
                console.error("Funds cannot be negative");
                return;
            }
            this.blackjackGame.getPlayerFundsManager().setFunds(amount);
            this.updateUI();
            console.log(`Player funds set to ${amount}`);
            return;
        }

        this.showCustomPrompt(
            "Enter new player funds:",
            this.blackjackGame.getPlayerFunds().toString(),
            (value) => {
                if (value === null) {
                    console.log("Set funds cancelled.");
                    return;
                }
                finalAmount = parseInt(value, 10);
                if (isNaN(finalAmount) || finalAmount < 0) {
                    console.error("Invalid amount entered for funds. Must be a non-negative number.");
                    // Optionally, re-show prompt or show an error in the prompt itself
                    this.showCustomPrompt(
                        "Invalid amount. Enter new player funds:",
                        this.blackjackGame.getPlayerFunds().toString(),
                        // Re-pass the same logic or a refined one
                        (reValue) => {
                            if (reValue === null) { console.log("Set funds cancelled."); return; }
                            const reFinalAmount = parseInt(reValue, 10);
                            if (isNaN(reFinalAmount) || reFinalAmount < 0) { console.error("Invalid amount again."); return; }
                            this.blackjackGame.getPlayerFundsManager().setFunds(reFinalAmount);
                            this.updateUI();
                            console.log(`Player funds set to ${reFinalAmount}`);
                        }
                    );
                    return;
                }
                this.blackjackGame.getPlayerFundsManager().setFunds(finalAmount);
                this.updateUI();
                console.log(`Player funds set to ${finalAmount}`);
            }
        );
    }

    public resetFunds(): void {
        this.blackjackGame.resetFunds();
        this.updateUI();
        console.log(`Player funds reset to ${this.blackjackGame.getPlayerFunds()}.`);
    }

    public setBet(amount: number): void {
        if (amount < 0) {
            console.error("Bet cannot be negative");
            return;
        }
        this.blackjackGame.setCurrentBet(amount);
        this.updateUI();
        console.log(`Current bet set to ${amount}`);
    }

    public updateUI(): void {
        this.gameUI.update(this.cardVisualizer.isAnimationInProgress());
        this.updateDebugHandDisplay();
    }

    public toggleInspector(): void {
        const scene = this.gameScene.getScene();
        if (scene.debugLayer.isVisible()) {
            scene.debugLayer.hide();
            console.log("Inspector hidden");
        } else {
            scene.debugLayer.show();
            console.log("Inspector shown");
        }
    }

    public toggleHandDisplay(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isHandDisplayVisible = !this.isHandDisplayVisible;
        } else {
            this.isHandDisplayVisible = visible;
        }

        if (this.isHandDisplayVisible) {
            if (!this.debugHandDisplayElement) {
                this.createDebugHandDisplayElement();
            }
            this.debugHandDisplayElement!.style.display = 'block';
            this.updateDebugHandDisplay();
            console.log("Debug hand display shown.");
        } else {
            if (this.debugHandDisplayElement) {
                this.debugHandDisplayElement.style.display = 'none';
                console.log("Debug hand display hidden.");
            }
        }
    }

    public toggleDebugMenu(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isDebugMenuVisible = !this.isDebugMenuVisible;
        } else {
            this.isDebugMenuVisible = visible;
        }

        if (this.isDebugMenuVisible) {
            if (!this.debugMenuElement) {
                this.createDebugMenuElement();
            }
            this.debugMenuElement!.style.display = 'block';
            console.log("Debug menu shown.");
        } else {
            if (this.debugMenuElement) {
                this.debugMenuElement.style.display = 'none';
                console.log("Debug menu hidden.");
            }
        }
    }


    private recordHandHistory(): void {
        const playerHand = this.blackjackGame.getPlayerHand();
        const dealerHand = this.blackjackGame.getDealerHand();

        if (playerHand.length > 0 || dealerHand.length > 0) {
            this.handHistory.unshift({
                player: [...playerHand],
                dealer: [...dealerHand]
            });

            if (this.handHistory.length > this.MAX_HISTORY_ENTRIES) {
                this.handHistory.pop();
            }
            console.log(`[DebugManager] Hand history recorded. Entries: ${this.handHistory.length}`);
        }
    }

    private injectGlobalStyles(): void {
        if (!document.getElementById('blackjack-debug-styles')) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "blackjack-debug-styles";
            styleSheet.innerText = `
                .debug-window-base {
                    position: absolute;
                    width: auto;
                    min-width: 250px;
                    max-width: 400px;
                    max-height: 500px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    border: 2px solid blue;
                    background-color: rgba(220, 220, 255, 0.9);
                    padding: 10px;
                    z-index: 1002;
                    cursor: move;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    color: #333;
                    border-radius: 5px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                }
                .debug-card-container {
                    position: relative;
                    width: 60px;
                    height: 84px;
                    display: inline-block;
                }
                .debug-card-container playing-card {
                    width: 100%;
                    height: 100%;
                    border-radius: 3px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                }
                .debug-card-indicator {
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    width: 18px;
                    height: 18px;
                    background-color: rgba(0, 0, 0, 0.6);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-family: 'Segoe UI Symbol', sans-serif;
                    pointer-events: none;
                    line-height: 1;
                }
                @keyframes green-flash {
                    from { box-shadow: 0 0 8px 3px limegreen; }
                    to { box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
                }
                .card-dealt {
                    animation: green-flash 0.5s ease-out;
                }
                @keyframes red-flash-and-fade {
                    0% { box-shadow: 0 0 8px 3px tomato; opacity: 1; }
                    70% { box-shadow: none; opacity: 1; }
                    100% { opacity: 0; transform: scale(0.9); }
                }
                .card-discarded .debug-card-container {
                    animation: red-flash-and-fade 0.5s ease-out forwards;
                }
                .debug-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #aaa;
                }
                .debug-header-title {
                    font-weight: bold;
                    font-size: 16px;
                }
                .debug-header-nav button {
                    padding: 2px 6px;
                    margin-left: 5px;
                    cursor: pointer;
                    border: 1px solid #555;
                    background-color: #eee;
                    border-radius: 3px;
                }
                .debug-header-nav button:hover {
                    background-color: #ddd;
                }
                .debug-close-button {
                    padding: 0;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background-color: #f06060;
                    color: white;
                    border: 1px solid #d04040;
                    font-size: 14px;
                    line-height: 20px;
                    text-align: center;
                    cursor: pointer;
                    font-weight: bold;
                    flex-shrink: 0;
                }
                .debug-close-button:hover {
                    background-color: #e04040;
                }
                .debug-menu-button-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .debug-menu-button {
                    padding: 8px 12px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    text-align: left;
                    font-size: 13px;
                    width: 100%; /* Ensure all buttons have the same width */
                    box-sizing: border-box; /* Include padding in width calculation */
                }
                .debug-menu-button:hover {
                    background-color: #45a049;
                }
                .debug-menu-separator {
                    height: 1px;
                    background-color: #aaa;
                    margin-top: 8px;
                    margin-bottom: 8px;
                }
                .debug-menu-button-group {
                    position: relative; /* For submenu positioning */
                }
                .debug-submenu {
                    display: none; /* Hidden by default */
                    position: fixed; /* Use fixed to pop out of container */
                    background-color: #f9f9f9;
                    min-width: 200px;
                    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                    z-index: 1005; /* Ensure it's above other debug elements */
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    padding: 5px 0;
                    /* left, top, right will be set dynamically */
                }
                .debug-submenu-button {
                    color: black;
                    padding: 8px 12px;
                    text-decoration: none;
                    display: block;
                    text-align: left;
                    background-color: transparent;
                    border: none;
                    width: 100%;
                    font-size: 13px;
                    cursor: pointer;
                }
                .debug-submenu-button:hover {
                    background-color: #e0e0e0;
                }
                .debug-prompt-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                    z-index: 1010; /* Above submenus */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .debug-prompt-dialog {
                    position: absolute; /* Added for positioning */
                    left: 50%; /* Added for centering */
                    top: 50%; /* Added for centering */
                    transform: translate(-50%, -50%); /* Added for centering */
                    background-color: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    min-width: 300px;
                    max-width: 90%;
                    z-index: 1011;
                    cursor: move; /* Added for draggable */
                }
                .debug-prompt-dialog p {
                    margin-top: 0;
                    margin-bottom: 15px;
                    font-size: 16px;
                    color: #333;
                }
                .debug-prompt-dialog input[type="number"] {
                    width: calc(100% - 22px); /* Account for padding/border */
                    padding: 10px;
                    margin-bottom: 20px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 16px;
                }
                .debug-prompt-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .debug-prompt-buttons button {
                    padding: 10px 15px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                }
                .debug-prompt-confirm {
                    background-color: #4CAF50;
                    color: white;
                }
                .debug-prompt-confirm:hover {
                    background-color: #45a049;
                }
                .debug-prompt-cancel {
                    background-color: #f44336;
                    color: white;
                }
                .debug-prompt-cancel:hover {
                    background-color: #d32f2f;
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    private makeDraggable(element: HTMLElement): void {
        element.onmousedown = (e) => {
            if ((e.target as HTMLElement).closest('button, input, select, textarea')) {
                return;
            }
            this.isDragging = true;
            this.draggedElement = element;

            const computedStyle = getComputedStyle(element);
            let finalEffectiveLeft = element.offsetLeft;
            let finalEffectiveTop = element.offsetTop;

            // If element was centered using transform, convert to explicit L/T for dragging
            if (computedStyle.transform !== 'none' && computedStyle.transform !== '') {
                const rect = element.getBoundingClientRect();
                // Assuming the element's offset parent is effectively the viewport origin
                // (e.g., child of a full-screen fixed overlay like .debug-prompt-overlay)
                // or the element itself is fixed.
                // For the dialog, its parent overlay is fixed at (0,0), so rect.left/top are correct.
                element.style.left = `${rect.left}px`;
                element.style.top = `${rect.top}px`;
                element.style.transform = 'none'; // Remove transform, subsequent drags won't re-enter

                finalEffectiveLeft = rect.left;
                finalEffectiveTop = rect.top;
            }
            
            // Ensure the element is positioned (not static) so style.left/top will work.
            if (computedStyle.position === 'static') {
                // Draggable elements are typically 'absolute', 'relative', or 'fixed'.
                // Setting to 'relative' is a fallback if it was 'static'.
                // The .debug-prompt-dialog is set to 'absolute' via CSS, so this won't apply to it.
                element.style.position = 'relative'; 
            }

            this.dragOffsetX = e.clientX - finalEffectiveLeft;
            this.dragOffsetY = e.clientY - finalEffectiveTop;

            document.onmousemove = this.dragElement.bind(this);
            document.onmouseup = this.stopDragElement.bind(this);
            e.preventDefault();
        };
    }


    private createDebugHandDisplayElement(): void {
        this.injectGlobalStyles();

        this.debugHandDisplayElement = document.createElement("div");
        this.debugHandDisplayElement.id = "blackjack-debug-hand-display";
        this.debugHandDisplayElement.classList.add("debug-window-base");
        this.debugHandDisplayElement.style.left = '10px';
        this.debugHandDisplayElement.style.top = '10px';
        document.body.appendChild(this.debugHandDisplayElement);

        this.makeDraggable(this.debugHandDisplayElement);
    }

    private createDebugMenuElement(): void {
        this.injectGlobalStyles();

        this.debugMenuElement = document.createElement("div");
        this.debugMenuElement.id = "blackjack-debug-menu";
        this.debugMenuElement.classList.add("debug-window-base");
        this.debugMenuElement.style.left = 'calc(100vw - 270px)';
        this.debugMenuElement.style.top = '10px';
        this.debugMenuElement.style.minWidth = '220px';
        this.debugMenuElement.style.maxWidth = '280px';


        const header = document.createElement('div');
        header.className = 'debug-header';

        const title = document.createElement('span');
        title.className = 'debug-header-title';
        title.textContent = 'Debug Menu';

        const closeButton = document.createElement('button');
        closeButton.className = 'debug-close-button';
        closeButton.innerHTML = '&#x2715;';
        closeButton.title = 'Close Debug Menu';
        closeButton.onclick = (e) => {
            e.stopPropagation();
            this.toggleDebugMenu(false);
        };

        header.appendChild(title);
        header.appendChild(closeButton);
        this.debugMenuElement.appendChild(header);

        const content = document.createElement('div');
        content.className = 'debug-menu-button-container';

        const createButton = (text: string, action: () => void) => {
            const button = document.createElement('button');
            button.className = 'debug-menu-button';
            button.textContent = text;
            button.onclick = (e) => {
                e.stopPropagation();
                action();
            };
            content.appendChild(button);
        };

        const createSeparator = () => {
            const separator = document.createElement('div');
            separator.className = 'debug-menu-separator';
            content.appendChild(separator);
        };

        // --- Scenario Starters ---
        this.createDropdownButton('Start Scenario ▸', [
            { text: 'Start Hand (Normal)', action: () => this.debugStartNormalHand(), accessKey: 'N' },
            { text: 'Start Split Hand', action: () => this.debugStartSplitHand(), accessKey: 'S' },
            { text: 'Start Insurance Hand', action: () => this.debugStartInsuranceHand(), accessKey: 'I' }
        ], content, true); // true for openLeft

        createSeparator();

        // --- Game Control ---
        createButton('Toggle Card Debug Window', () => this.toggleHandDisplay());
        createButton('Reveal Dealer Hole Card', () => this.revealDealerHole());
        createButton('Force Reshuffle Deck', () => this.forceReshuffle());

        createSeparator();

        // --- Funds Control ---
        this.createDropdownButton('Manage Funds ▸', [
            { text: 'Set Player Funds...', action: () => this.setFunds(), accessKey: 'F' },
            { text: 'Reset Player Bank', action: () => this.resetFunds(), accessKey: 'R' }
        ], content, true); // true for openLeft

        createSeparator();

        // --- Outcome Control ---
        this.createDropdownButton('Force Outcome ▸', [
            { text: 'Force Player Win', action: () => this.forceWin(true), accessKey: 'P' },
            { text: 'Force Dealer Win', action: () => this.forceWin(false), accessKey: 'D' },
            { text: 'Force Push', action: () => this.forcePush(), accessKey: 'U' }
        ], content, true); // true for openLeft


        this.debugMenuElement.appendChild(content);
        document.body.appendChild(this.debugMenuElement);
        this.makeDraggable(this.debugMenuElement);
    }


    private dragElement(e: MouseEvent): void {
        if (this.isDragging && this.draggedElement) {
            e.preventDefault();
            let newLeft = e.clientX - this.dragOffsetX;
            let newTop = e.clientY - this.dragOffsetY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const elWidth = this.draggedElement.offsetWidth;
            const elHeight = this.draggedElement.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, viewportWidth - elWidth));
            newTop = Math.max(0, Math.min(newTop, viewportHeight - elHeight));

            this.draggedElement.style.left = newLeft + 'px';
            this.draggedElement.style.top = newTop + 'px';
        }
    }

    private stopDragElement(): void {
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedElement = null;
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    private createCardElement(card: Card, isNew: boolean): HTMLElement {
        const container = document.createElement('div');
        container.className = 'debug-card-container';

        const cardEl = document.createElement('playing-card');
        cardEl.setAttribute('cid', card.getCid());

        if (isNew) {
            cardEl.classList.add('card-dealt');
            setTimeout(() => cardEl.classList.remove('card-dealt'), 500);
        }

        container.appendChild(cardEl);

        const indicator = document.createElement('span');
        indicator.className = 'debug-card-indicator';
        if (card.isFaceUp()) {
            indicator.innerHTML = `👁️`;
        } else {
            indicator.innerHTML = `❓`;
            indicator.style.color = '#aaa';
        }
        container.appendChild(indicator);

        return container;
    }

    private renderHandInContainer(title: string, currentCards: Card[], lastCards: Card[], isHistoryView: boolean, parentElement: HTMLElement): void {
        const headerEl = document.createElement('h4');
        headerEl.textContent = title;
        headerEl.style.margin = '10px 0 5px 0';
        headerEl.style.borderBottom = '1px solid #999';
        headerEl.style.paddingBottom = '3px';
        parentElement.appendChild(headerEl);

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '5px';
        parentElement.appendChild(container);

        const currentCardIds = new Set(currentCards.map(c => c.getUniqueId()));
        const lastCardIds = new Set(lastCards.map(c => c.getUniqueId()));

        if (!isHistoryView) {
            [...lastCards].reverse().forEach(card => {
                if (!currentCardIds.has(card.getUniqueId())) {
                    const discardedEl = this.createCardElement(card, false);
                    discardedEl.classList.add('card-discarded');
                    container.appendChild(discardedEl);
                    setTimeout(() => discardedEl.remove(), 500);
                }
            });
        }

        [...currentCards].reverse().forEach(card => {
            const isNew = !isHistoryView && !lastCardIds.has(card.getUniqueId());
            container.appendChild(this.createCardElement(card, isNew));
        });

        if (currentCards.length === 0 && (isHistoryView || lastCards.length === 0)) {
            container.textContent = 'No cards';
        }
    }

    public updateDebugHandDisplay(): void {
        if (!this.isHandDisplayVisible || !this.debugHandDisplayElement) {
            return;
        }

        const isHistoryView = this.historyIndex > -1;
        let playerHand: Card[], dealerHand: Card[];
        let titleText: string;

        if (isHistoryView) {
            const historicalState = this.handHistory[this.historyIndex];
            playerHand = historicalState.player;
            dealerHand = historicalState.dealer;
            titleText = `History (${this.historyIndex + 1}/${this.handHistory.length})`;
        } else {
            playerHand = this.blackjackGame.getPlayerHand();
            dealerHand = this.blackjackGame.getDealerHand();
            titleText = "Current Hand";
        }

        this.debugHandDisplayElement.innerHTML = '';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'debug-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'debug-header-title';
        titleSpan.textContent = titleText;

        const rightControls = document.createElement('div');
        rightControls.style.display = 'flex';
        rightControls.style.alignItems = 'center';

        const navContainer = document.createElement('div');
        navContainer.className = 'debug-header-nav';

        if (isHistoryView) {
            const homeButton = document.createElement('button');
            homeButton.innerHTML = '🏠&nbsp;Current';
            homeButton.onclick = () => { this.historyIndex = -1; this.updateDebugHandDisplay(); };
            navContainer.appendChild(homeButton);
        }
        if (this.historyIndex > -1) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next →';
            nextButton.disabled = this.historyIndex === 0;
            nextButton.onclick = () => { if (this.historyIndex > 0) this.historyIndex--; this.updateDebugHandDisplay(); };
            navContainer.appendChild(nextButton);
        }
        if (this.historyIndex < this.handHistory.length - 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '← Prev';
            prevButton.disabled = this.historyIndex === this.handHistory.length - 1 && this.historyIndex !== -1;
            prevButton.onclick = () => { if (this.historyIndex < this.handHistory.length - 1) this.historyIndex++; this.updateDebugHandDisplay(); };
            navContainer.appendChild(prevButton);
        }
        if (this.handHistory.length > 0 && this.historyIndex === -1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '← Prev';
            prevButton.onclick = () => { this.historyIndex = 0; this.updateDebugHandDisplay(); };
            navContainer.appendChild(prevButton);
        }


        const closeButton = document.createElement('button');
        closeButton.className = 'debug-close-button';
        closeButton.innerHTML = '&#x2715;';
        closeButton.title = 'Close Card Debug Window';
        closeButton.onclick = (e) => { e.stopPropagation(); this.toggleHandDisplay(false); };
        closeButton.style.marginLeft = '10px';

        rightControls.appendChild(navContainer);
        rightControls.appendChild(closeButton);
        headerDiv.appendChild(titleSpan);
        headerDiv.appendChild(rightControls);
        this.debugHandDisplayElement.appendChild(headerDiv);

        this.renderHandInContainer('Dealer', dealerHand, this.lastDealerHand, isHistoryView, this.debugHandDisplayElement);
        this.renderHandInContainer('Player', playerHand, this.lastPlayerHand, isHistoryView, this.debugHandDisplayElement);

        if (!isHistoryView) {
            this.lastPlayerHand = [...playerHand];
            this.lastDealerHand = [...dealerHand];
        }
    }

    // --- Debug Menu Button Actions ---

    private debugStartNormalHand(): void {
        console.log("DEBUG: Starting Normal Hand");
        this.resetGame();
        const success = this.blackjackGame.startNewGame(Constants.MIN_BET);
        if (!success) {
            console.error("DEBUG: Failed to start normal hand.");
        }
    }

    private debugStartSplitHand(): void {
        console.log("DEBUG: Starting Split Hand");
        this.resetGame();

        this.blackjackGame.setCurrentBet(Constants.MIN_BET);
        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(this.blackjackGame.getCurrentBet())) {
            console.error("DEBUG Split: Could not deduct bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }
        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const suits = Object.values(Suit);
        let randomRankIndex = Math.floor(Math.random() * (Object.values(Rank).length - 1));
        if (Object.values(Rank)[randomRankIndex] === Rank.Ace) randomRankIndex = 0;
        const splitRank = Object.values(Rank)[randomRankIndex];

        const playerCard1 = new Card(suits[0 % suits.length], splitRank); playerCard1.setFaceUp(true);
        const playerCard2 = new Card(suits[1 % suits.length], splitRank); playerCard2.setFaceUp(true);
        this.blackjackGame.setPlayerHand([playerCard1, playerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false);
        const dealerCard2 = this.dealRandomCard(false, true);  dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true);
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true);
    }

    private debugStartInsuranceHand(): void {
        console.log("DEBUG: Starting Insurance Hand");
        this.resetGame();

        this.blackjackGame.setCurrentBet(Constants.MIN_BET);
        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(this.blackjackGame.getCurrentBet())) {
            console.error("DEBUG Insurance: Could not deduct bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }
        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const playerCard1 = this.dealRandomCard(true, true); playerCard1.setFaceUp(true);
        const playerCard2 = this.dealRandomCard(true, true); playerCard2.setFaceUp(true);
        this.blackjackGame.setPlayerHand([playerCard1, playerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false);
        const dealerCard2 = new Card(Suit.Spades, Rank.Ace);
        dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true);
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true);
    }

    public forceReshuffle(): void {
        console.log("DEBUG: Forcing deck reshuffle.");
        const cardsRemaining = this.blackjackGame.getHandManager().forceDeckReshuffle();
        console.log(`Deck reshuffled. Cards remaining: ${cardsRemaining}`);
        this.updateUI();
    }

    private ensureBetActiveForForceOutcome(): void {
        const game = this.blackjackGame;
        if (game.getCurrentBet() === 0) {
            if (game.getPlayerFunds() >= Constants.MIN_BET) {
                game.setCurrentBet(Constants.MIN_BET);
                game.getPlayerFundsManager().deductFunds(Constants.MIN_BET);
                console.log(`DEBUG: Auto-placed MIN_BET (${Constants.MIN_BET}) for forced outcome.`);
            } else {
                console.warn("DEBUG: Cannot auto-place bet for forced outcome, insufficient funds. Outcome may not have monetary effect.");
            }
        }
        if (game.getGameState() !== GameState.PlayerTurn && game.getGameState() !== GameState.DealerTurn && game.getGameState() !== GameState.Dealing) {
            game.getGameActions().setGameState(GameState.PlayerTurn, true, false);
        }
    }


    public forceWin(playerWins: boolean): void {
        console.log(`DEBUG: Forcing ${playerWins ? 'Player Win' : 'Dealer Win'}`);
        this.ensureBetActiveForForceOutcome();
        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true);
        }


        if (playerWins) {
            gameActions.setGameResult(GameResult.PlayerWins, true);
            game.getPlayerFundsManager().addFunds(game.getCurrentBet() * 2);
        } else {
            gameActions.setGameResult(GameResult.DealerWins, true);
        }
        gameActions.resolveInsurance();
        gameActions.setGameState(GameState.GameOver, true, true);
    }

    public forcePush(): void {
        console.log("DEBUG: Forcing Push");
        this.ensureBetActiveForForceOutcome();
        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true);
        }

        gameActions.setGameResult(GameResult.Push, true);
        game.getPlayerFundsManager().addFunds(game.getCurrentBet());
        gameActions.resolveInsurance();
        gameActions.setGameState(GameState.GameOver, true, true);
    }


    public dispose(): void {
        if (this.debugHandDisplayElement) {
            this.debugHandDisplayElement.remove();
            this.debugHandDisplayElement = null;
        }
        if (this.debugMenuElement) {
            this.debugMenuElement.remove();
            this.debugMenuElement = null;
        }
        if (this.activeCustomPromptElement) {
            this.closeCustomPrompt(true); // Pass true to indicate cancellation
        }
        // Ensure any open submenu is removed from the body and listener is cleaned up
        this.closeOpenSubMenuAndCleanup(true);

        const styleSheet = document.getElementById('blackjack-debug-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
        document.removeEventListener('click', this.handleGlobalClick, true);
        if ((window as any).debug === this) {
            (window as any).debug = undefined;
        }
    }

    // --- Sub-menu helper and global click handler ---
    private handleGlobalClick = (event: MouseEvent): void => {
        // If a custom prompt is active, don't close submenus.
        // The prompt overlay should handle its own dismissal or prevent clicks from passing.
        if (this.activeCustomPromptElement) {
            // Check if the click was on the overlay itself to close the prompt
            if (event.target === this.activeCustomPromptElement) { // activeCustomPromptElement is the overlay
                 this.closeCustomPrompt(true); // true for cancel
            }
            return;
        }

        if (this.openSubMenu) {
            const target = event.target as HTMLElement;

            // Do not close if the click is on the button that triggered the current submenu
            if (this.activeSubMenuTrigger && this.activeSubMenuTrigger.contains(target)) {
                return;
            }
            // Do not close if the click is inside the currently open submenu
            if (this.openSubMenu.contains(target)) {
                return;
            }

            // Click is outside, close the submenu
            this.closeOpenSubMenuAndCleanup(true);
        }
    };

    private formatTextWithAccessKey(text: string, accessKey?: string): string {
        if (!accessKey || accessKey.length !== 1) {
            return text;
        }
        const keyIndex = text.toLowerCase().indexOf(accessKey.toLowerCase());
        if (keyIndex === -1) {
            return text;
        }
        return `${text.substring(0, keyIndex)}<u>${text.substring(keyIndex, keyIndex + 1)}</u>${text.substring(keyIndex + 1)}`;
    }


    private closeOpenSubMenuAndCleanup(removeFromDom: boolean): void {
        if (this.openSubMenu) {
            document.removeEventListener('keydown', this.boundHandleSubMenuAccessKeys);
            if (removeFromDom && this.openSubMenu.parentNode === document.body) {
                document.body.removeChild(this.openSubMenu);
            }
            // Ensure style.display is 'none' even if not removed from DOM,
            // as it might be reused if its parent button is clicked again.
            this.openSubMenu.style.display = 'none';
            this.openSubMenu = null;
            this.activeSubMenuTrigger = null;
        }
    }

    private handleSubMenuAccessKeys(event: KeyboardEvent): void {
        if (!this.openSubMenu || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        const pressedKey = event.key.toLowerCase();
        for (const child of Array.from(this.openSubMenu.children)) {
            const button = child as HTMLElement;
            if (button.dataset.accessKey === pressedKey) {
                event.preventDefault();
                event.stopPropagation();
                button.click(); // This will trigger the action and close the submenu
                return;
            }
        }
    }


    private createDropdownButton(
        mainButtonText: string,
        items: { text: string, action: () => void, accessKey?: string }[],
        parentContainer: HTMLElement,
        openLeft: boolean = false
    ): void {
        const group = document.createElement('div');
        group.className = 'debug-menu-button-group';

        const mainButton = document.createElement('button');
        mainButton.className = 'debug-menu-button';
        mainButton.textContent = mainButtonText;

        const subMenu = document.createElement('div');
        subMenu.className = 'debug-submenu';
        // subMenu.style.top and left/right will be set on show

        items.forEach(item => {
            const subButton = document.createElement('button');
            subButton.className = 'debug-submenu-button';
            subButton.innerHTML = this.formatTextWithAccessKey(item.text, item.accessKey);
            if (item.accessKey) {
                subButton.dataset.accessKey = item.accessKey.toLowerCase();
            }

            subButton.onclick = (e) => {
                e.stopPropagation(); // Prevent global click handler from closing immediately
                item.action();
                this.closeOpenSubMenuAndCleanup(true);
            };
            subMenu.appendChild(subButton);
        });

        mainButton.onclick = (e) => {
            e.stopPropagation(); // Prevent global click handler

            const subMenuWasOpenAndWasThisOne = this.openSubMenu === subMenu;

            // Always close any potentially open submenu first.
            // This handles closing the current one if it's clicked again,
            // or closing a different one if another mainButton is clicked.
            this.closeOpenSubMenuAndCleanup(true);

            if (!subMenuWasOpenAndWasThisOne) {
                // If it wasn't this submenu that was visible (or nothing was visible), open this one.
                document.body.appendChild(subMenu); // Append to body to avoid clipping

                const rect = mainButton.getBoundingClientRect();
                subMenu.style.position = 'fixed'; // Already in CSS, but good to be explicit

                if (openLeft) {
                    subMenu.style.top = `${rect.top}px`;
                    subMenu.style.right = `${window.innerWidth - rect.left}px`;
                    subMenu.style.left = 'auto';
                } else {
                    subMenu.style.top = `${rect.top}px`;
                    subMenu.style.left = `${rect.right}px`;
                    subMenu.style.right = 'auto';
                }

                subMenu.style.display = 'block';
                this.openSubMenu = subMenu;
                this.activeSubMenuTrigger = mainButton;
                document.addEventListener('keydown', this.boundHandleSubMenuAccessKeys);
            }
            // If it *was* this submenu and visible, it's now closed by the call above,
            // and we don't re-open it.
        };

        group.appendChild(mainButton);
        // subMenu is not appended to group here, but to document.body on click
        parentContainer.appendChild(group);
    }

    // --- Custom Prompt Methods ---
    private showCustomPrompt(
        message: string,
        defaultValue: string,
        onConfirm: (value: string | null) => void
    ): void {
        if (this.activeCustomPromptElement) {
            // Close existing prompt first if any
            this.closeCustomPrompt(true);
        }

        this.customPromptConfirmCallback = onConfirm;

        const overlay = document.createElement('div');
        overlay.className = 'debug-prompt-overlay';
        overlay.onclick = () => this.closeCustomPrompt(true); // Close when clicking outside
        this.activeCustomPromptElement = overlay; // The overlay is the main tracked element

        const dialog = document.createElement('div');
        dialog.className = 'debug-prompt-dialog';
        dialog.onclick = (e) => e.stopPropagation(); // Prevent overlay click when clicking dialog
        
        // Add dialog header with title and close button
        const headerDiv = document.createElement('div');
        headerDiv.className = 'debug-header';
        headerDiv.style.marginTop = '0';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'debug-header-title';
        titleSpan.textContent = 'Set Player Funds';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'debug-close-button';
        closeButton.innerHTML = '&#x2715;';
        closeButton.title = 'Cancel';
        closeButton.onclick = (e) => {
            e.stopPropagation();
            this.closeCustomPrompt(true);
        };
        
        headerDiv.appendChild(titleSpan);
        headerDiv.appendChild(closeButton);
        dialog.appendChild(headerDiv);

        const p = document.createElement('p');
        p.textContent = message;

        const input = document.createElement('input');
        input.type = 'number';
        input.value = defaultValue;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.closeCustomPrompt(false, input.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeCustomPrompt(true);
            }
        };

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'debug-prompt-buttons';

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm';
        confirmButton.className = 'debug-prompt-confirm';
        confirmButton.onclick = () => this.closeCustomPrompt(false, input.value);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'debug-prompt-cancel';
        cancelButton.onclick = () => this.closeCustomPrompt(true);

        buttonsDiv.appendChild(cancelButton);
        buttonsDiv.appendChild(confirmButton);

        dialog.appendChild(p);
        dialog.appendChild(input);
        dialog.appendChild(buttonsDiv);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Make the dialog draggable
        this.makeDraggable(dialog);

        input.focus();
        input.select();

        // Add Escape key listener to the document
        this.customPromptEscapeListener = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.closeCustomPrompt(true);
            }
        };
        document.addEventListener('keydown', this.customPromptEscapeListener);
    }

    private closeCustomPrompt(isCancel: boolean, value?: string): void {
        if (this.activeCustomPromptElement) {
            // Remove the overlay click event to prevent memory leaks
            if (this.activeCustomPromptElement.onclick) {
                (this.activeCustomPromptElement as HTMLElement).onclick = null;
            }
            
            // Find and clean up the dialog element
            const dialogElement = this.activeCustomPromptElement.querySelector('.debug-prompt-dialog');
            if (dialogElement) {
                (dialogElement as HTMLElement).onclick = null;
                
                // Clean up header buttons if present
                const closeButton = dialogElement.querySelector('.debug-close-button');
                if (closeButton) {
                    (closeButton as HTMLElement).onclick = null;
                }
                
                // Clean up input event handlers
                const input = dialogElement.querySelector('input');
                if (input) {
                    (input as HTMLInputElement).onkeydown = null;
                }
                
                // Clean up button click handlers
                const buttons = dialogElement.querySelectorAll('button');
                buttons.forEach(button => {
                    (button as HTMLButtonElement).onclick = null;
                });
            }
            
            document.body.removeChild(this.activeCustomPromptElement);
            this.activeCustomPromptElement = null;
        }
        
        // Remove escape key listener
        if (this.customPromptEscapeListener) {
            document.removeEventListener('keydown', this.customPromptEscapeListener);
            this.customPromptEscapeListener = null;
        }
        
        // Call the callback with result
        if (this.customPromptConfirmCallback) {
            this.customPromptConfirmCallback(isCancel ? null : (value ?? ''));
            this.customPromptConfirmCallback = null;
        }
    }
}
