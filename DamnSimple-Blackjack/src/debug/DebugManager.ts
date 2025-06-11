// src/debug/DebugManager.ts
import { BlackjackGame, PlayerHandInfo } from "../game/BlackjackGame"; // Import PlayerHandInfo
import { GameState, GameResult } from "../game/GameState";
import { Card, Suit, Rank } from "../game/Card";
import { GameScene } from "../scenes/GameScene";
import { CardVisualizer } from "../scenes/components/CardVisualizer";
import { GameUI } from "../ui/GameUI";
import { Constants } from "../Constants";
import { ScoreCalculator } from "../game/ScoreCalculator"; // Import ScoreCalculator
import { GameStorage } from "../game/GameStorage"; // Import GameStorage
import { CustomPromptDialog, DebugHandDisplayDialog, DebugMenuDialog } from "../ui/factories/DialogFactory";

export class DebugManager {
    private gameScene: GameScene;
    private blackjackGame: BlackjackGame;
    private cardVisualizer: CardVisualizer;
    private gameUI: GameUI;

    // --- New Dialog-based UI ---
    private handDisplay: DebugHandDisplayDialog;
    private debugMenu: DebugMenuDialog;
    private isHandDisplayVisible: boolean = false;
<<<<<<< HEAD
=======

    private debugMenuElement: HTMLElement | null = null;
>>>>>>> ef0a855 (Updated JSDocs)
    private isDebugMenuVisible: boolean = false;

<<<<<<< HEAD
    // --- Key for localStorage ---
    private static readonly DEBUG_MENU_VISIBLE_KEY = "blackjack_debugMenuVisible";
=======
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private isDragging: boolean = false;
    private draggedElement: HTMLElement | null = null;

    private handHistory: { player: Card[], dealer: Card[] }[] = [];
    private readonly MAX_HISTORY_ENTRIES = 10;
    private historyIndex: number = -1; // -1 means current hand, 0 is most recent history, etc.

    private lastPlayerHand: Card[] = [];
    private lastDealerHand: Card[] = [];
>>>>>>> ef0a855 (Updated JSDocs)


    /**
     * DebugManager constructor.
     *
     * @param gameScene The game scene object.
     * @param cardVisualizer The card visualizer object.
     * @param blackjackGame The BlackjackGame object.
     */
    constructor(gameScene: GameScene, cardVisualizer: CardVisualizer, blackjackGame: BlackjackGame) {
        this.gameScene = gameScene;
        this.blackjackGame = blackjackGame;
        this.cardVisualizer = cardVisualizer;
        this.gameUI = gameScene.getGameUI();

        // --- Initialize new UI components ---
        this.handDisplay = new DebugHandDisplayDialog(this.blackjackGame, () => this.toggleHandDisplay(false));
        this.debugMenu = new DebugMenuDialog(this);

        (window as any).debug = this;
        (window as any).game = this.blackjackGame;
        (window as any).scene = gameScene.getScene();
        (window as any).cardViz = this.cardVisualizer;
        (window as any).gameUI = this.gameUI;

        // Load debug menu visibility state
        const storedVisibility = localStorage.getItem(DebugManager.DEBUG_MENU_VISIBLE_KEY);
        if (storedVisibility !== null) {
            this.isDebugMenuVisible = JSON.parse(storedVisibility);
            if (this.isDebugMenuVisible) {
                setTimeout(() => this.debugMenu.show(), 0);
            }
        }

        console.log("Debug manager initialized. Type 'debug.help()' for available commands.");
    }

    /**
     * Prints a list of available debug commands and their descriptions.
     */
    public help(): void {
        console.log("%cBlackjack Debug Commands", "font-size: 16px; font-weight: bold; color: #4CAF50;");
        console.log("%cGame State Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setGameState(state) - Set game state (0=Initial, 1=Betting, 2=Dealing, 3=PlayerTurn, 4=DealerTurn, 5=GameOver)");
        console.log("  debug.setGameResult(result, handIndex?) - Set game result for active/specified player hand or overall (0=PlayerWins, 1=DealerWins, 2=Push, 3=PlayerBlackjack, 4=InProgress)");
        console.log("  debug.resetGame() - Reset the game to initial state");
        console.log("  debug.startNewGame(bet) - Start a new game with specified bet (clears table)");
        console.log("  debug.getState() - Get current game state information");

        console.log("%cCard Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.addCard(isPlayer, handIndex, suit, rank, faceUp) - Add a card to player (specify handIndex) or dealer hand");
        console.log("  debug.clearCards(isPlayer, handIndex?) - Clear cards from player (specify handIndex or all) or dealer hand");
        console.log("  debug.flipCard(isPlayer, handIndex, cardIndex) - Flip a specific card in a player or dealer hand");
        console.log("  debug.dealRandomCard(isPlayer, faceUp) - Deal a random card (returns card, doesn't add to hand)");
        console.log("  debug.renderCards() - Force re-render all cards (visuals in Babylon)");
        console.log("  debug.revealDealerHole() - Reveals the dealer's hole card");
        console.log("  debug.forceReshuffle() - Forces the deck to reshuffle.");

        console.log("%cFunds Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setFunds(amount) - Set player funds to specific amount");
        console.log("  debug.setBet(amount, handIndex?) - Set current bet for active/specified hand or initial bet");
        console.log("  debug.resetFunds() - Reset player funds to default amount.");

        console.log("%cUI Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.updateUI() - Force UI update");
        console.log("  debug.toggleInspector() - Toggle Babylon.js inspector");
        console.log("  debug.toggleHandDisplay(visible?) - Toggle draggable display of current hands.");
        console.log("  debug.toggleDebugMenu(visible?) - Toggle the main debug menu window.");

        console.log("%cQuick Scenarios:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.forceWin(isPlayer, handIndex?) - Force player (true) or dealer (false) win for active/specified hand.");
        console.log("  debug.forcePush(handIndex?) - Force a push result for active/specified hand.");


        console.log("%cExamples:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.setGameState(3) - Set game to PlayerTurn");
        console.log("  debug.addCard(true, 0, 'Hearts', 'A', true) - Add Ace of Hearts to player's first hand face up");
    }

    /**
     * Sets the game state to the specified numerical value.
     * @param state Numerical value of the GameState enum. E.g., 0 for Initial, 1 for Betting, etc.
     * @throws Error if the state is invalid (less than 0 or greater than or equal to the number of GameState enum values.
     */
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

<<<<<<< HEAD
    public setGameResult(result: number, handIndex?: number): void {
=======
    /**
     * Sets the game result to the specified numerical value.
     * @param result Numerical value of the GameResult enum. E.g., 0 for PlayerWins, 1 for DealerWins, etc.
     * @throws Error if the result is invalid (less than 0 or greater than or equal to the number of GameResult enum values.
     */
    public setGameResult(result: number): void {
>>>>>>> ef0a855 (Updated JSDocs)
        if (result < 0 || result > 4) {
            console.error("Invalid game result. Use 0-4.");
            return;
        }
        const playerHands = this.blackjackGame.getPlayerHands();
        const targetHandIdx = handIndex ?? this.blackjackGame.getActivePlayerHandIndex();

        if (targetHandIdx >= 0 && targetHandIdx < playerHands.length) {
            playerHands[targetHandIdx].result = result as GameResult;
            console.log(`Game result for Player Hand ${targetHandIdx} set to ${GameResult[result]}`);
        } else if (handIndex === undefined) { // Apply to overall game result if no handIndex
            this.blackjackGame.getGameActions().setGameResult(result as GameResult, true);
            console.log(`Overall game result set to ${GameResult[result]}`);
        } else {
            console.error(`Invalid handIndex ${handIndex} for setGameResult.`);
            return;
        }
        this.updateUI();
    }

    /**
     * Resets the game to its initial state and clears the debug history.
     */
    public resetGame(): void {
        this.cardVisualizer.clearTable();
        this.blackjackGame.getGameActions().resetInternalState(); // Reset actions state first

        // Clear game storage to ensure a completely fresh start when game reloads/reinitializes
        GameStorage.clearAllGameData(); // Assuming GameStorage has or can have this method.
                                     // If not, GameStorage.clearSavedHands() is an alternative,
                                     // but clearAllGameState() would be more robust for a full reset.
                                     // For now, let's assume clearSavedHands is the primary way to clear persistent hand data.
        GameStorage.clearSavedHands();


        this.blackjackGame.getGameActions().setGameState(GameState.Initial, false, false); // No need to forceSave if storage cleared, no notify yet
        this.blackjackGame.getGameActions().setGameResult(GameResult.InProgress, false); // No need to forceSave
        this.blackjackGame.setPlayerHands([]); // Clear all player hands
        this.blackjackGame.setActivePlayerHandIndex(0); // Reset active hand index
        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.setCurrentBet(0); // Resets initial bet for GameActions
        this.blackjackGame.resetFunds(); // This will save funds, which is fine.
        this.blackjackGame.insuranceTakenThisRound = false;
        this.blackjackGame.insuranceBetPlaced = 0;

        this.handDisplay.resetHistory();

        console.log("Game reset to initial state, storage cleared, debug history cleared.");
        this.updateDebugHandDisplay();
        // Explicitly update UI after a full reset
        this.updateUI();
    }

    /**
     * Starts a new game round, resetting the game state and clearing the debug history
     * if necessary. If the current game state is not Initial, Betting, or GameOver,
     * the game is forced to the Initial state before attempting to start the new game.
     * @param bet The amount to bet. Defaults to Constants.MIN_BET if not provided.
     * @throws Error if the game fails to start (e.g., insufficient funds).
     */
    public startNewGame(bet: number = Constants.MIN_BET): void {
        const currentState = this.blackjackGame.getGameState();
        if (currentState !== GameState.Initial &&
            currentState !== GameState.Betting &&
            currentState !== GameState.GameOver) {
            console.warn(`[DebugManager] Forcing game to Initial state before starting new game.`);
            this.resetGame(); // resetGame now clears playerHands
        }
        const success = this.blackjackGame.startNewGame(bet);
        if (success) {
            console.log(`Started new game with bet: ${bet}`);
        } else {
            console.error(`Failed to start new game with bet ${bet}. Insufficient funds?`);
        }
        setTimeout(() => this.updateDebugHandDisplay(), 100);
    }

    /**
     * Logs the current game state information to the console, including game state, result,
     * player and dealer scores, player funds, current bet, and the hands of both the player
     * and the dealer. Also updates the debug hand display.
     */
    public getState(): void {
        const gameState = this.blackjackGame.getGameState();
        const gameResult = this.blackjackGame.getGameResult(); // Overall game result
        const playerFunds = this.blackjackGame.getPlayerFunds();
        const currentBet = this.blackjackGame.getCurrentBet(); // Initial bet for the round

        console.log("%cGame State Information", "font-weight: bold; color: #4CAF50;");
        console.log(`Game State: ${GameState[gameState]} (${gameState})`);
        console.log(`Overall Game Result: ${GameResult[gameResult]} (${gameResult})`);
        console.log(`Player Funds: ${playerFunds}`);
        console.log(`Initial Bet for Round: ${currentBet}`);
        console.log(`Active Player Hand Index: ${this.blackjackGame.getActivePlayerHandIndex()}`);

        this.blackjackGame.getPlayerHands().forEach((handInfo, index) => {
            const score = ScoreCalculator.calculateHandValue(handInfo.cards);
            console.log(`%cPlayer Hand ${index} (ID: ${handInfo.id}):`, "font-weight: bold; color: #2196F3;");
            console.log(`  Score: ${score}, Bet: ${handInfo.bet}, Result: ${GameResult[handInfo.result]}, Resolved: ${handInfo.isResolved}`);
            handInfo.cards.forEach((card, cardIdx) => {
                console.log(`    ${cardIdx}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
            });
        });

        const dealerScore = this.blackjackGame.getDealerScore(); // Visible score
        const dealerFullScore = this.blackjackGame.getDealerFullScore(); // Full score
        console.log("%cDealer Hand:", "font-weight: bold; color: #2196F3;");
        console.log(`  Visible Score: ${dealerScore}, Full Score (if revealed): ${dealerFullScore}`);
        this.blackjackGame.getDealerHand().forEach((card, index) => {
            console.log(`  ${index}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
        });
        this.updateDebugHandDisplay();
    }

<<<<<<< HEAD
    public addCard(isPlayer: boolean, handIndexOrSuit: number | string, suitOrRank: string, rankOrFaceUp: string | boolean, faceUp?: boolean): void {
        let targetHandIndex = 0;
        let cardSuit: string, cardRank: string, cardFaceUp: boolean;
=======
    /**
     * Adds a card to either the player's or dealer's hand.
     * @param isPlayer True to add to the player's hand, false to add to the dealer's hand.
     * @param suit The suit of the card to add. Must be one of Hearts, Diamonds, Clubs, or Spades.
     * @param rank The rank of the card to add. Must be one of 2-10, J, Q, K, or A.
     * @param faceUp Whether the card should be face up or face down. Defaults to true (face up).
     * @throws Error if the suit or rank is invalid.
     */
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
>>>>>>> ef0a855 (Updated JSDocs)

        if (isPlayer) {
            if (typeof handIndexOrSuit !== 'number') {
                console.error("For player, first argument after isPlayer must be handIndex (number)."); return;
            }
            targetHandIndex = handIndexOrSuit;
            cardSuit = suitOrRank as string;
            cardRank = rankOrFaceUp as string;
            cardFaceUp = faceUp === undefined ? true : faceUp;
        } else { // Dealer
            cardSuit = handIndexOrSuit as string;
            cardRank = suitOrRank as string;
            cardFaceUp = rankOrFaceUp as boolean;
        }


        if (!Object.values(Suit).includes(cardSuit as Suit)) {
            console.error(`Invalid suit: ${cardSuit}. Use Hearts, Diamonds, Clubs, or Spades.`); return;
        }
        if (!Object.values(Rank).includes(cardRank as Rank)) {
            console.error(`Invalid rank: ${cardRank}. Use 2-10, J, Q, K, or A.`); return;
        }

        const card = new Card(cardSuit as Suit, cardRank as Rank);
        card.setFaceUp(cardFaceUp);

        if (isPlayer) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (targetHandIndex < 0 || targetHandIndex >= playerHands.length) {
                // If trying to add to a non-existent hand but it's the next logical hand, create it.
                if (targetHandIndex === playerHands.length && playerHands.length < Constants.MAX_SPLIT_HANDS) {
                    const newHand: PlayerHandInfo = {
                        id: `hand-${targetHandIndex}`, cards: [], bet: this.blackjackGame.getCurrentBet(), // Use initial bet or active hand's bet
                        result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
                    };
                    playerHands.push(newHand);
                    console.log(`Created new Player Hand ${targetHandIndex} due to addCard command.`);
                } else {
                    console.error(`Invalid player handIndex: ${targetHandIndex}. Player has ${playerHands.length} hands.`); return;
                }
            }
            this.blackjackGame.addCardToPlayerHand(card, targetHandIndex);
            console.log(`Added ${card.toString()} to player's hand ${targetHandIndex} (${cardFaceUp ? 'face up' : 'face down'})`);
        } else {
            this.blackjackGame.addCardToDealerHand(card);
            console.log(`Added ${card.toString()} to dealer's hand (${cardFaceUp ? 'face up' : 'face down'})`);
        }
        this.blackjackGame.getHandManager().registerFlipCallback(card);

        this.renderCards(); // This will also update debug display
        this.updateUI(); // Update main UI
    }

<<<<<<< HEAD
    public clearCards(isPlayer: boolean, handIndex?: number): void {
=======
    /**
     * Clears the hand of the player or dealer, depending on the isPlayer parameter.
     * @param isPlayer If true, clears the player's hand. If false, clears the dealer's hand.
     */
    public clearCards(isPlayer: boolean): void {
>>>>>>> ef0a855 (Updated JSDocs)
        if (isPlayer) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (handIndex !== undefined) {
                if (handIndex < 0 || handIndex >= playerHands.length) {
                    console.error(`Invalid player handIndex: ${handIndex}.`); return;
                }
                playerHands[handIndex].cards = [];
                playerHands[handIndex].result = GameResult.InProgress;
                playerHands[handIndex].isResolved = false;
                // Note: Clearing a single hand might break game logic if not careful.
                console.log(`Cleared player's hand ${handIndex}`);
            } else { // Clear all player hands
                this.blackjackGame.setPlayerHands([]);
                this.blackjackGame.setActivePlayerHandIndex(0);
                console.log(`Cleared all player hands.`);
            }
        } else { // Dealer
            this.blackjackGame.setDealerHand([]);
            console.log(`Cleared dealer's hand`);
        }
        this.cardVisualizer.renderCards();
        this.updateUI();
        this.updateDebugHandDisplay();
    }

<<<<<<< HEAD
    public flipCard(isPlayer: boolean, handIndex: number, cardIndexInHand: number): void {
        let hand: Card[];
        if (isPlayer) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (handIndex < 0 || handIndex >= playerHands.length) {
                console.error(`Invalid player handIndex: ${handIndex}.`); return;
            }
            hand = playerHands[handIndex].cards;
        } else { // Dealer
            // For dealer, handIndex is ignored, effectively 0
            hand = this.blackjackGame.getDealerHand();
=======
    /**
     * Flips a card at the specified index in the player's or dealer's hand.
     *
     * @param isPlayer - True if the card belongs to the player's hand, false for the dealer's hand.
     * @param index - The index of the card to flip within the hand.
     *
     * Logs an error if the specified index is out of bounds. Updates the debug hand display
     * and logs the action to the console.
     */
    public flipCard(isPlayer: boolean, index: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        if (index < 0 || index >= hand.length) {
            console.error(`Invalid card index: ${index}. Hand has ${hand.length} cards.`);
            return;
>>>>>>> ef0a855 (Updated JSDocs)
        }

        if (cardIndexInHand < 0 || cardIndexInHand >= hand.length) {
            console.error(`Invalid card index: ${cardIndexInHand}. Hand has ${hand.length} cards.`); return;
        }
        hand[cardIndexInHand].flip(); // This will trigger CardVisualizer update via callback
        this.updateDebugHandDisplay();
        console.log(`Flipped ${isPlayer ? `player hand ${handIndex}` : 'dealer'}'s card at index ${cardIndexInHand}`);
    }

<<<<<<< HEAD

=======
    /**
     * Reveals the dealer's hole card by flipping it face up.
     * If the dealer's hole card is already face up or if the dealer has no cards,
     * logs a message to the console indicating that the dealer hole card is already revealed
     * or no cards have been dealt.
     * Updates the debug hand display.
     */
>>>>>>> ef0a855 (Updated JSDocs)
    public revealDealerHole(): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            // Use GameActions to reveal, as it handles animation and state
            this.blackjackGame.getGameActions().requestRevealDealerHoleCard(() => {
                console.log("DEBUG: Dealer hole card revealed via GameActions.");
                this.updateDebugHandDisplay();
            });
        } else {
            console.log("DEBUG: Dealer hole card already revealed or no cards dealt.");
        }
    }

    /**
     * Returns a randomly generated Card, with suit and rank determined randomly.
     * The card is set to the specified faceUp state.
     * @param isPlayer If true, the generated card is intended for the player's hand,
     *                 otherwise it is intended for the dealer's hand.
     * @param faceUp If true, the generated card is face up, otherwise face down.
     *               Defaults to true.
     * @returns A randomly generated Card.
     */
    public dealRandomCard(isPlayer: boolean, faceUp: boolean = true): Card {
        const suits = Object.values(Suit);
        const ranks = Object.values(Rank);
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
        const card = new Card(randomSuit, randomRank);
        card.setFaceUp(faceUp);
        return card; // Does not add to any hand
    }

    /**
     * Requests the CardVisualizer to re-render all cards, including the player's and dealer's hands.
     * Also updates the debug hand display. Logs a message to the console indicating that cards
     * have been re-rendered.
     */
    public renderCards(): void {
        this.cardVisualizer.renderCards();
        this.updateDebugHandDisplay();
        console.log("Cards re-rendered (Babylon visuals and debug display)");
    }

    /**
     * Sets the player's funds. If no amount is provided, a custom prompt will be shown to the user
     * to enter the new amount. If the entered amount is invalid (negative or not a number), the
     * custom prompt will be shown again until a valid amount is entered.
     * @param amount If provided, the new amount will be set directly. If not, a custom prompt will be shown.
     */
    public setFunds(amount?: number): void {
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

        CustomPromptDialog.show(
            "Enter new player funds:",
            this.blackjackGame.getPlayerFunds().toString(),
            (value) => {
                if (value === null) {
                    console.log("Set funds cancelled.");
                    return;
                }
                const finalAmount = parseInt(value, 10);
                if (isNaN(finalAmount) || finalAmount < 0) {
                    console.error("Invalid amount entered for funds. Must be a non-negative number.");
                    return;
                }
                this.blackjackGame.getPlayerFundsManager().setFunds(finalAmount);
                this.updateUI();
                console.log(`Player funds set to ${finalAmount}`);
            }
        );
    }

    /**
     * Resets the player's funds to the default amount and updates the UI.
     * This operation will save the new funds state.
     */
    public resetFunds(): void {
        this.blackjackGame.resetFunds();
        this.updateUI();
        console.log(`Player funds reset to ${this.blackjackGame.getPlayerFunds()}.`);
    }

<<<<<<< HEAD
    public setBet(amount: number, handIndex?: number): void {
=======
    /**
     * Sets the current bet amount for the game. Updates the UI to reflect the new bet.
     * @param amount The amount to set as the current bet. Must be non-negative.
     * Logs an error if the bet is negative and does not proceed with setting the bet.
     */
    public setBet(amount: number): void {
>>>>>>> ef0a855 (Updated JSDocs)
        if (amount < 0) {
            console.error("Bet cannot be negative"); return;
        }
        if (this.blackjackGame.getGameState() === GameState.Betting || this.blackjackGame.getGameState() === GameState.Initial) {
            this.blackjackGame.setCurrentBet(amount); // Sets initial bet for GameActions
            console.log(`Initial bet for round set to ${amount}`);
        } else if (handIndex !== undefined) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (handIndex >= 0 && handIndex < playerHands.length) {
                playerHands[handIndex].bet = amount;
                console.log(`Bet for Player Hand ${handIndex} set to ${amount}`);
            } else {
                console.error(`Invalid handIndex ${handIndex} for setBet.`); return;
            }
        } else { // Set for active hand if in PlayerTurn
            const activeHand = this.blackjackGame.getActivePlayerHandInfo();
            if (activeHand && this.blackjackGame.getGameState() === GameState.PlayerTurn) {
                activeHand.bet = amount;
                console.log(`Bet for active Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} set to ${amount}`);
            } else {
                console.warn("Cannot set bet now. Game not in Betting or PlayerTurn, or no active hand.");
            }
        }
        this.updateUI();
    }

    /**
     * Updates the main Game UI (bet buttons, result display) to reflect the current state of the game,
     * and also updates the debug hand display.
     * @remarks
     * Also takes into account whether a visual animation is currently in progress.
     */
    public updateUI(): void {
        this.gameUI.update(this.cardVisualizer.isAnimationInProgress());
        this.updateDebugHandDisplay();
    }

    /**
     * Toggles the visibility of the BabylonJS Inspector.
     * If the inspector is currently visible, it will be hidden.
     * If the inspector is currently hidden, it will be shown.
     */
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

    /**
     * Toggles the visibility of the debug hand display, which shows the current hands of the player and dealer.
     * If `visible` is not provided, the display is toggled. If `visible` is `true`, the display is shown. If `visible` is `false`, the display is hidden.
     * If the display is shown, the `updateDebugHandDisplay` method is called to populate the display.
     * @param visible Whether to show or hide the debug hand display.
     */
    public toggleHandDisplay(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isHandDisplayVisible = !this.isHandDisplayVisible;
        } else {
            this.isHandDisplayVisible = visible;
        }

        this.handDisplay.toggle(this.isHandDisplayVisible);
        if (this.isHandDisplayVisible) {
            this.updateDebugHandDisplay();
            console.log("Debug hand display shown.");
        } else {
            console.log("Debug hand display hidden.");
        }
    }


    /**
     * Toggles the visibility of the debug menu, which provides various debug options.
     * If `visible` is not provided, the menu is toggled. If `visible` is `true`, the menu is shown. If `visible` is `false`, the menu is hidden.
     * If the menu is shown, the `createDebugMenuElement` method is called to populate the menu.
     * @param visible Whether to show or hide the debug menu.
     */
    public toggleDebugMenu(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isDebugMenuVisible = !this.isDebugMenuVisible;
        } else {
            this.isDebugMenuVisible = visible;
        }
        
        this.debugMenu.toggle(this.isDebugMenuVisible);
        if (this.isDebugMenuVisible) {
            console.log("Debug menu shown.");
        } else {
            console.log("Debug menu hidden.");
        }
        localStorage.setItem(DebugManager.DEBUG_MENU_VISIBLE_KEY, JSON.stringify(this.isDebugMenuVisible));
    }

    /**
     * Records the current player and dealer hands in the hand history array.
     * Only records hands if either the player or dealer has at least one card.
     * Ensures the hand history array does not exceed the maximum number of entries.
     * Logs a message to the console indicating the number of hand history entries after recording.
     */
    private recordHandHistory(): void {
<<<<<<< HEAD
        this.handDisplay.recordHandHistory(
            this.blackjackGame.getPlayerHands(),
            this.blackjackGame.getDealerHand()
        );
        console.log(`[DebugManager] Hand history recorded.`);
=======
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

    /**
     * Injects global CSS styles necessary for the debug elements used in the application.
     * If the styles are not already present, it creates a new <style> element with a
     * unique ID and appends it to the document head. The styles include properties for
     * positioning, appearance, and animations of various debug components such as
     * windows, cards, headers, buttons, and prompts.
     */
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

    /**
     * Makes an element draggable.
     * @param element The element to make draggable.
     */
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

    /**
     * Creates the debug hand display element, which is a div with the
     * 'blackjack-debug-hand-display' id and 'debug-window-base' class.
     * The element is appended to the document body and is made draggable
     * using the `makeDraggable` method.
     */
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

    /**
     * Creates the debug menu element, which is a div with the
     * 'blackjack-debug-menu' id and 'debug-window-base' class.
     * The element is appended to the document body and is made draggable
     * using the `makeDraggable` method.
     *
     * The debug menu element contains a header with a title and close button,
     * as well as a container for debug buttons. The buttons are created using
     * the `createButton` method, which takes a text string and an action callback.
     * The buttons are grouped into categories using the `createSeparator` method.
     *
     * The categories are:
     *  - Scenario Starters
     *  - Game Control
     *  - Funds Control
     *  - Outcome Control
     */
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

        /**
         * Creates a new button element with the given text and
         * action callback and adds it to the content container.
         * @param {string} text - The text to display on the button.
         * @param {() => void} action - The function to call when button is clicked.
         */
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

        /**
         * Creates a separator element that can be used to
         * visually separate menu items and groups.
         * This is a simple horizontal line.
         */
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


    /**
     * Drags the currently selected element by updating its left and top CSS style
     * properties. It also prevents the default mouse event behavior.
     * @param e The mouse event.
     */
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

    /**
     * Resets the state of the drag feature when the user releases the mouse button
     * by stopping the event listeners and resetting the flags.
     */
    private stopDragElement(): void {
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedElement = null;
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    /**
     * Creates a new HTMLElement that represents a playing card.
     * The element is a container that holds a "playing-card" element
     * and a small indicator that shows whether the card is face up or not.
     * The container gets a class of "debug-card-container".
     * The card element is created with the correct card ID set as an attribute.
     * The indicator is a span with class "debug-card-indicator" and is either
     * a pair of eyes (`👁️`) for a face-up card or a question mark (`❓`) for
     * a face-down card. For face-down cards, the question mark is displayed
     * in a light gray color.
     * @param {Card} card - The card to be represented.
     * @param {boolean} isNew - Whether the card is "new" and should have a
     *   "card-dealt" animation applied.
     * @returns {HTMLElement} The created element.
     */
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

    /**
     * Renders a hand of cards within a specified parent element, displaying a title and visualizing the current
     * and last known cards in the hand. This function is capable of showing both current hands and historical views.
     *
     * @param {string} title - The title to display above the hand.
     * @param {Card[]} currentCards - The list of current cards to render in the hand.
     * @param {Card[]} lastCards - The list of cards previously in the hand, used for comparison.
     * @param {boolean} isHistoryView - Flag indicating if this is a historical view of the hand.
     * @param {HTMLElement} parentElement - The parent HTML element where the hand will be rendered.
     */
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
>>>>>>> ef0a855 (Updated JSDocs)
    }

    /**
     * Updates the debug hand display when the history index changes or the user toggles the hand display.
     * This function is responsible for rendering the current or historical hand state in the debug window,
     * including the title and navigation buttons.
     */
    public updateDebugHandDisplay(): void {
        if (this.isHandDisplayVisible) {
            this.handDisplay.update();
        }
    }

    // --- Debug Menu Button Actions ---

<<<<<<< HEAD
    public debugStartNormalHand(): void {
=======
    /**
     * Starts a new normal Blackjack game with the minimum bet.
     * This function is part of the debug menu and is only accessible when the game is in a debug state.
     * It resets the game state and starts a new game.
     */
    private debugStartNormalHand(): void {
>>>>>>> ef0a855 (Updated JSDocs)
        console.log("DEBUG: Starting Normal Hand");
        this.resetGame();
        const success = this.blackjackGame.startNewGame(Constants.MIN_BET);
        if (!success) {
            console.error("DEBUG: Failed to start normal hand.");
        }
    }

<<<<<<< HEAD
    public debugStartSplitHand(): void {
        console.log("DEBUG: Starting Split Hand Scenario");
=======
    /**
     * Starts a new Blackjack game with the minimum bet and a split hand.
     * This function is part of the debug menu and is only accessible when the game is in a debug state.
     * It resets the game state and starts a new game with a split hand.
     * The player's hand is created by randomly selecting a rank and creating two cards with that rank and alternating suits.
     * The dealer's hand is created by randomly selecting two cards.
     * The game state is set to `GameState.Dealing` and then immediately set to `GameState.PlayerTurn` after the cards are dealt.
     */
    private debugStartSplitHand(): void {
        console.log("DEBUG: Starting Split Hand");
>>>>>>> ef0a855 (Updated JSDocs)
        this.resetGame();

        const initialBet = Constants.MIN_BET;
        this.blackjackGame.setCurrentBet(initialBet); // Set initial bet for GameActions

        // Simulate placing the first bet
        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(initialBet)) {
            console.error("DEBUG Split: Could not deduct initial bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }

        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const suits = Object.values(Suit);
        // Find a rank that is not Ace for simpler split testing first
        let splitRank = Rank.Seven; // Example: Pair of 7s
        const ranks = Object.values(Rank);
        let randomRankIndex = Math.floor(Math.random() * ranks.length);
        if (ranks[randomRankIndex] === Rank.Ace) { // Avoid Ace for initial split test if possible
            randomRankIndex = (randomRankIndex + 1) % ranks.length;
        }
        splitRank = ranks[randomRankIndex];


        const playerCard1 = new Card(suits[0 % suits.length], splitRank); playerCard1.setFaceUp(true);
        const playerCard2 = new Card(suits[1 % suits.length], splitRank); playerCard2.setFaceUp(true);

        const initialPlayerHand: PlayerHandInfo = {
            id: 'hand-0', cards: [playerCard1, playerCard2], bet: initialBet,
            result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
        };
        this.blackjackGame.setPlayerHands([initialPlayerHand]);
        this.blackjackGame.setActivePlayerHandIndex(0);

        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false);
        const dealerCard2 = this.dealRandomCard(false, true);  dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true); // Render initial state
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true); // Move to player turn
        this.updateUI();
        console.log("DEBUG: Split hand scenario set up. Player has a pair. Try splitting.");
    }

<<<<<<< HEAD
    public debugStartInsuranceHand(): void {
=======
    /**
     * Starts a new Blackjack game with the minimum bet and the dealer's upcard an Ace.
     * This function is part of the debug menu and is only accessible when the game is in a debug state.
     * It resets the game state and starts a new game with a hand that will trigger the insurance option.
     * The game state is set to `GameState.PlayerTurn` after the cards are dealt.
     */
    private debugStartInsuranceHand(): void {
>>>>>>> ef0a855 (Updated JSDocs)
        console.log("DEBUG: Starting Insurance Hand");
        this.resetGame();
        const initialBet = Constants.MIN_BET;
        this.blackjackGame.setCurrentBet(initialBet);

        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(initialBet)) {
            console.error("DEBUG Insurance: Could not deduct bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }
        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const playerCard1 = this.dealRandomCard(true, true); playerCard1.setFaceUp(true);
        const playerCard2 = this.dealRandomCard(true, true); playerCard2.setFaceUp(true);

        const initialPlayerHand: PlayerHandInfo = {
            id: 'hand-0', cards: [playerCard1, playerCard2], bet: initialBet,
            result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
        };
        this.blackjackGame.setPlayerHands([initialPlayerHand]);
        this.blackjackGame.setActivePlayerHandIndex(0);

        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false); // Hole card
        const dealerCard2 = new Card(Suit.Spades, Rank.Ace); // Upcard is Ace
        dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true);
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true);
        this.updateUI();
        console.log("DEBUG: Insurance hand scenario set up. Dealer's upcard is Ace.");
    }

    /**
     * Forces the deck to reshuffle immediately in a debug context.
     * Logs the number of cards remaining post-reshuffle and updates the UI.
     */
    public forceReshuffle(): void {
        console.log("DEBUG: Forcing deck reshuffle.");
        const cardsRemaining = this.blackjackGame.getHandManager().forceDeckReshuffle();
        console.log(`Deck reshuffled. Cards remaining: ${cardsRemaining}`);
        this.updateUI();
    }

<<<<<<< HEAD
    private ensureBetActiveForForceOutcome(handIndex?: number): PlayerHandInfo | null {
=======
    /**
     * Ensures that a bet is active before attempting to force an outcome.
     * If there is no bet, it will auto-place the minimum bet.
     * If the player has insufficient funds for the minimum bet, it will log a warning.
     * If the game is not in a valid state to process a forced outcome, it will set the game state to `GameState.PlayerTurn`.
     */
    private ensureBetActiveForForceOutcome(): void {
>>>>>>> ef0a855 (Updated JSDocs)
        const game = this.blackjackGame;
        const targetHandIdx = handIndex ?? game.getActivePlayerHandIndex();
        const playerHands = game.getPlayerHands();

        if (targetHandIdx < 0 || targetHandIdx >= playerHands.length) {
            // If no hands, try to set up a basic one for the outcome
            if (playerHands.length === 0) {
                if (game.getPlayerFunds() >= Constants.MIN_BET) {
                    game.setCurrentBet(Constants.MIN_BET); // Sets initial bet for GameActions
                    const newHand: PlayerHandInfo = {
                        id: 'hand-0-debug', cards: [], bet: Constants.MIN_BET,
                        result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
                    };
                    game.setPlayerHands([newHand]);
                    game.setActivePlayerHandIndex(0);
                    game.getPlayerFundsManager().deductFunds(Constants.MIN_BET);
                    console.log(`DEBUG: Auto-created hand 0 and placed MIN_BET (${Constants.MIN_BET}) for forced outcome.`);
                    return newHand;
                } else {
                    console.warn("DEBUG: Cannot auto-place bet/create hand for forced outcome, insufficient funds.");
                    return null;
                }
            } else {
                console.error(`DEBUG: Invalid handIndex ${targetHandIdx} for forced outcome.`);
                return null;
            }
        }

        const targetHand = playerHands[targetHandIdx];
        if (targetHand.bet === 0) {
            if (game.getPlayerFunds() >= Constants.MIN_BET) {
                targetHand.bet = Constants.MIN_BET;
                game.getPlayerFundsManager().deductFunds(Constants.MIN_BET);
                console.log(`DEBUG: Auto-placed MIN_BET (${Constants.MIN_BET}) on Hand ${targetHandIdx} for forced outcome.`);
            } else {
                console.warn(`DEBUG: Cannot auto-place bet on Hand ${targetHandIdx} for forced outcome, insufficient funds. Outcome may not have monetary effect.`);
            }
        }

        if (game.getGameState() !== GameState.PlayerTurn && game.getGameState() !== GameState.DealerTurn && game.getGameState() !== GameState.Dealing) {
            game.getGameActions().setGameState(GameState.PlayerTurn, true, false);
        }
        return targetHand;
    }


<<<<<<< HEAD
    public forceWin(playerWins: boolean, handIndex?: number): void {
        const targetHand = this.ensureBetActiveForForceOutcome(handIndex);
        if (!targetHand) {
            console.error("DEBUG: Could not ensure active bet for forceWin."); return;
        }
        const targetHandIdx = this.blackjackGame.getPlayerHands().findIndex(h => h.id === targetHand.id);
        console.log(`DEBUG: Forcing ${playerWins ? 'Player Win' : 'Dealer Win'} for Hand ${targetHandIdx}`);

=======
    /**
     * Forces a win for the player or dealer in a debug context.
     * Automatically places a minimum bet if none is active, and logs a warning if the player has insufficient funds.
     * If the game is not in a valid state to process a forced outcome, it will set the game state to `GameState.PlayerTurn`.
     * Reveals the dealer's hole card and determines the game outcome based on the given parameter.
     * If the player wins, their funds are increased by double the current bet; if the dealer wins, the player's funds are unchanged.
     * The game state is set to `GameState.GameOver` after the outcome is determined.
     * @param playerWins Whether the player wins (true) or the dealer wins (false).
     */
    public forceWin(playerWins: boolean): void {
        console.log(`DEBUG: Forcing ${playerWins ? 'Player Win' : 'Dealer Win'}`);
        this.ensureBetActiveForForceOutcome();
>>>>>>> ef0a855 (Updated JSDocs)
        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            // Don't use requestRevealDealerHoleCard as it has callbacks that might interfere
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true); // Force immediate visual update
        }

        if (playerWins) {
            targetHand.result = GameResult.PlayerWins;
            game.getPlayerFundsManager().addFunds(targetHand.bet * 2);
        } else {
            targetHand.result = GameResult.DealerWins;
            // Player loses bet, already deducted or handled by ensureBetActive
        }
        targetHand.isResolved = true;

        // Check if all hands are resolved to end game
        if (game.getPlayerHands().every(h => h.isResolved)) {
            gameActions.resolveInsurance(); // Resolve insurance if all hands done
            gameActions.setGameState(GameState.GameOver, true, true);
        } else {
            this.updateUI(); // Update UI if game not over
        }
    }

<<<<<<< HEAD
    public forcePush(handIndex?: number): void {
        const targetHand = this.ensureBetActiveForForceOutcome(handIndex);
        if (!targetHand) {
            console.error("DEBUG: Could not ensure active bet for forcePush."); return;
        }
        const targetHandIdx = this.blackjackGame.getPlayerHands().findIndex(h => h.id === targetHand.id);
        console.log(`DEBUG: Forcing Push for Hand ${targetHandIdx}`);

=======
    /**
     * Forces a push in a debug context.
     * Automatically places a minimum bet if none is active, and logs a warning if the player has insufficient funds.
     * If the game is not in a valid state to process a forced outcome, it will set the game state to `GameState.PlayerTurn`.
     * Reveals the dealer's hole card and determines the game outcome to be a push.
     * The player's funds are increased by the current bet.
     * The game state is set to `GameState.GameOver` after the outcome is determined.
     */
    public forcePush(): void {
        console.log("DEBUG: Forcing Push");
        this.ensureBetActiveForForceOutcome();
>>>>>>> ef0a855 (Updated JSDocs)
        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true);
        }

        targetHand.result = GameResult.Push;
        game.getPlayerFundsManager().addFunds(targetHand.bet); // Return bet
        targetHand.isResolved = true;

        if (game.getPlayerHands().every(h => h.isResolved)) {
            gameActions.resolveInsurance();
            gameActions.setGameState(GameState.GameOver, true, true);
        } else {
            this.updateUI();
        }
    }


    /**
     * Cleans up all visual elements and event listeners added by the debug manager.
     * This method is called when the debug manager is no longer needed, such as when the game is reset or when the debug menu is closed.
     * It removes the debug menu element, the debug hand display element, and any open custom prompt overlay.
     * It also removes the global click event listener and the stylesheet element.
     * Finally, it sets the window-level debug property to undefined.
     */
    public dispose(): void {
        this.handDisplay?.dispose();
        this.debugMenu?.dispose();
        
        const styleSheet = document.getElementById('blackjack-dialog-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
        
        if ((window as any).debug === this) {
            (window as any).debug = undefined;
        }
    }
<<<<<<< HEAD
=======

    // --- Sub-menu helper and global click handler ---

    /**
     * Handles global clicks to close submenus and custom prompts.
     * This method is bound to the document click event and checks if the click is outside of any open submenus or custom prompts.
     * If a submenu is open, it will close it unless the click was on the active submenu trigger or inside the submenu.
     * If a custom prompt is active, it will only close it if the click was on the overlay itself.
     */
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

    /**
     * Returns a modified version of the given text, with the accessKey character underlined.
     * If the accessKey is not a single character, or if the text does not contain the accessKey,
     * the original text is returned.
     * @param text The text to modify
     * @param accessKey The key to underline in the text
     * @returns The modified text
     */
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

    /**
     * Closes the currently open submenu, if any, and cleans up event listeners and DOM elements.
     * If `removeFromDom` is true, it will remove the submenu from the document body.
     * If `removeFromDom` is false, it will just hide the submenu by setting its display to 'none'.
     */
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

    /**
     * Handles keyboard events when a submenu is open.
     * If the pressed key matches an access key on a button in the submenu,
     * the button's action is triggered and the submenu is closed.
     * @param event The keyboard event
     */
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

    /**
     * Creates a dropdown button that can be used in the debug menu.
     * The button shows a main label and has a submenu with multiple items.
     * When an item is clicked, its action is triggered and the submenu is closed.
     * The submenu is positioned below the main button, or to the left if `openLeft` is true.
     * @param mainButtonText The text to show on the main button
     * @param items An array of objects with `text` and `action` properties, and an optional `accessKey` property.
     *              The `accessKey` is used to underline the corresponding character in the `text` string.
     *              When the user types the `accessKey` key, the button will be clicked.
     * @param parentContainer The container element to append the created elements to
     * @param openLeft If true, the submenu will be positioned to the left of the main button, otherwise it will be below
     */
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

        /**
         * Handles the onclick event for the main button. It toggles the visibility of the submenu.
         * When the main button is clicked, it first closes any open submenu. If the clicked
         * button's submenu was not open, it opens it by appending it to the body and positioning it
         * relative to the main button. If the submenu was already open, this action results in closing it.
         *
         * @param e The mouse event triggered by clicking the main button.
         */
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

    /**
     * Shows a custom prompt to the user with a message, a default value in an input field,
     * and two buttons: "Confirm" and "Cancel". The prompt is modal, meaning it will block
     * any other interaction with the page until it is closed. The user can close the prompt
     * by clicking outside the prompt, pressing the Escape key, or clicking the "Cancel" button.
     * When the user clicks the "Confirm" button or presses the Enter key, the value of the
     * input field is passed to the `onConfirm` callback, and the prompt is closed.
     * If the user closes the prompt without confirming, the `onConfirm` callback is called
     * with `null` as the argument.
     * @param message The message to display in the prompt
     * @param defaultValue The default value of the input field
     * @param onConfirm The callback function to call when the user clicks the "Confirm" button
     */
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

        /**
         * Handles the onclick event for the close button in the custom prompt.
         * When this button is clicked, the prompt is closed and the `onConfirm` callback
         * is called with `null` as the argument, indicating that the user did not confirm.
         * @param e The event triggered by clicking the button
         */
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

        /**
        * Handles the onkeydown event for the input element within the custom prompt.
        * If the 'Enter' key is pressed, it prevents the default action and closes the prompt,
        * passing the current input value to the confirm callback. If the 'Escape' key
        * is pressed, it prevents the default action and closes the prompt without confirming.
        *
        * @param e The keyboard event triggered by the key press
        */
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

        /**
         * Handles the onclick event for the confirm button in the custom prompt.
         * When this button is clicked, the prompt is closed and the `onConfirm` callback
         * is called with the current input value as the argument, indicating that the user
         * confirmed.
         */
        confirmButton.onclick = () => this.closeCustomPrompt(false, input.value);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'debug-prompt-cancel';

        /**
         * Handles the onclick event for the cancel button in the custom prompt.
         * When this button is clicked, the prompt is closed and the `onConfirm` callback
         * is called with `null` as the argument, indicating that the user did not confirm.
         */
        cancelButton.onclick = () => this.closeCustomPrompt(true);

        buttonsDiv.appendChild(cancelButton);
        buttonsDiv.appendChild(confirmButton);

        dialog.appendChild(p);
        dialog.appendChild(input);
        dialog.appendChild(buttonsDiv);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        this.makeDraggable(dialog);

        input.focus();
        input.select();

        /**
         * Handles the keydown event for the document when a custom prompt is active.
         * If the 'Escape' key is pressed, it closes the custom prompt and calls the
         * confirm callback with `null`, indicating that the user did not confirm.
         * @param event The keyboard event triggered by the key press
         */
        this.customPromptEscapeListener = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.closeCustomPrompt(true);
            }
        };
        document.addEventListener('keydown', this.customPromptEscapeListener);
    }

    /**
     * Closes the custom prompt dialog and cleans up all associated event listeners and DOM elements.
     * If the prompt was confirmed, the provided value is passed to the confirm callback; otherwise, `null` is passed.
     *
     * @param isCancel - Indicates whether the prompt was canceled. If true, the confirm callback is called with `null`.
     * @param value - The input value to be passed to the confirm callback, if the prompt was not canceled.
     */
    private closeCustomPrompt(isCancel: boolean, value?: string): void {
        if (this.activeCustomPromptElement) {
            if (this.activeCustomPromptElement.onclick) {
                (this.activeCustomPromptElement as HTMLElement).onclick = null;
            }
            // Clean up the dialog element and its children
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

            // Remove the dialog element from the DOM
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
>>>>>>> ef0a855 (Updated JSDocs)
}
