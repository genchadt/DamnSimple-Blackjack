// game/BlackjackGame.ts
import { Card } from "./Card";
import { Deck } from "./Deck";
import { PlayerFunds } from "./PlayerFunds";

export enum GameState {
    Initial,      // Initial state - empty table
    Betting,      // Player setting bet
    PlayerTurn,   // Player's turn to hit/stand
    DealerTurn,   // Dealer's turn
    GameOver      // Game ended
}

export enum GameResult {
    PlayerWins,
    DealerWins,
    Push,
    PlayerBlackjack,
    InProgress
}

export class BlackjackGame {
    private deck: Deck;
    private playerHand: Card[];
    private dealerHand: Card[];
    private gameState: GameState;
    private gameResult: GameResult;
    private playerFunds: PlayerFunds;
    private currentBet: number = 0;
    private defaultBet: number = 10;
    private lastBet: number = 10;

    private static readonly STORAGE_KEY_STATE = "damnSimpleBlackjack_gameState";
    private static readonly STORAGE_KEY_PLAYER_HAND = "damnSimpleBlackjack_playerHand";
    private static readonly STORAGE_KEY_DEALER_HAND = "damnSimpleBlackjack_dealerHand";
    private static readonly STORAGE_KEY_BET = "damnSimpleBlackjack_currentBet";
    private static readonly STORAGE_KEY_RESULT = "damnSimpleBlackjack_gameResult";

    /**
     * Creates a new BlackjackGame object, loading any saved game state if present.
     * The game starts in the Initial state, with an empty player and dealer hand.
     * If saved game state is found, the game attempts to restore it.
     */
    constructor() {
        this.deck = new Deck();
        this.playerHand = [];
        this.dealerHand = [];
        this.gameState = GameState.Initial; // Start in Initial state
        this.gameResult = GameResult.InProgress;
        this.playerFunds = new PlayerFunds();

        this.tryRestoreGameState();
    }

    /**
     * Sets the game state to the given value, saving the new state to local storage.
     * This method is used to transition the game state between different phases of the game.
     * 
     * @param state The new game state.
     */
    public setGameState(state: GameState): void {
        this.gameState = state;
        this.saveGameState();
    }

    /**
     * Attempts to restore the game state from local storage. If successful, sets
     * the game state, current bet, last bet, game result, player hand, and dealer
     * hand to the saved values. If not, resets the game state to Initial and clears
     * the player and dealer hands.
     */
    private tryRestoreGameState(): void {
        try {
            const savedState = localStorage.getItem(BlackjackGame.STORAGE_KEY_STATE);
            if (savedState) {
                this.gameState = parseInt(savedState);
                
                // Only restore cards if we're in a valid game state
                if (this.gameState !== GameState.Initial) {
                    const savedBet = localStorage.getItem(BlackjackGame.STORAGE_KEY_BET);
                    if (savedBet) {
                        this.currentBet = parseInt(savedBet);
                        this.lastBet = this.currentBet;
                    }
                    
                    const savedResult = localStorage.getItem(BlackjackGame.STORAGE_KEY_RESULT);
                    if (savedResult) {
                        this.gameResult = parseInt(savedResult);
                    }
                    
                    // Restore player hand
                    const playerHandJson = localStorage.getItem(BlackjackGame.STORAGE_KEY_PLAYER_HAND);
                    if (playerHandJson) {
                        const playerHandData = JSON.parse(playerHandJson);
                        this.playerHand = playerHandData.map((cardData: any) => {
                            const card = new Card(cardData.suit, cardData.rank);
                            if (cardData.faceUp) {
                                // Set faceUp without triggering callbacks
                                card.setFaceUp(true);
                            }
                            return card;
                        });
                    }
                    
                    // Restore dealer hand
                    const dealerHandJson = localStorage.getItem(BlackjackGame.STORAGE_KEY_DEALER_HAND);
                    if (dealerHandJson) {
                        const dealerHandData = JSON.parse(dealerHandJson);
                        this.dealerHand = dealerHandData.map((cardData: any) => {
                            const card = new Card(cardData.suit, cardData.rank);
                            if (cardData.faceUp) {
                                // Set faceUp without triggering callbacks
                                card.setFaceUp(true);
                            }
                            return card;
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error restoring game state:", error);
            // If restoration fails, reset to initial state
            this.gameState = GameState.Initial;
            this.playerHand = [];
            this.dealerHand = [];
        }
    }

    /**
     * Saves the current game state to local storage.
     * This method serializes the game state, current bet, game result,
     * player hand, and dealer hand, and stores them in local storage.
     * If an error occurs during the save process, it logs an error message
     * to the console.
     */
    private saveGameState(): void {
        try {
            localStorage.setItem(BlackjackGame.STORAGE_KEY_STATE, this.gameState.toString());
            localStorage.setItem(BlackjackGame.STORAGE_KEY_BET, this.currentBet.toString());
            localStorage.setItem(BlackjackGame.STORAGE_KEY_RESULT, this.gameResult.toString());
            
            // Save player hand
            const playerHandData = this.playerHand.map(card => ({
                suit: card.getSuit(),
                rank: card.getRank(),
                faceUp: card.isFaceUp()
            }));
            localStorage.setItem(BlackjackGame.STORAGE_KEY_PLAYER_HAND, JSON.stringify(playerHandData));
            
            // Save dealer hand
            const dealerHandData = this.dealerHand.map(card => ({
                suit: card.getSuit(),
                rank: card.getRank(),
                faceUp: card.isFaceUp()
            }));
            localStorage.setItem(BlackjackGame.STORAGE_KEY_DEALER_HAND, JSON.stringify(dealerHandData));
        } catch (error) {
            console.error("Error saving game state:", error);
        }
    }

/**
 * Starts a new game of blackjack with the specified bet amount.
 * Deducts the bet amount from the player's funds and initializes
 * the player's and dealer's hands. Resets the deck if necessary
 * and deals initial cards to both the player and the dealer.
 * If the player's initial hand is a blackjack, the game concludes
 * immediately with a payout. The game state is saved after initialization.
 * 
 * @param {number} [bet=this.lastBet] - The amount to bet for the new game.
 * @returns {boolean} - Returns true if the game started successfully, false if
 *                      there were insufficient funds to place the bet.
 */
    public startNewGame(bet: number = this.lastBet): boolean {
        // Check if player has enough funds
        if (!this.playerFunds.deductFunds(bet)) {
            return false;
        }
        
        this.currentBet = bet;
        this.lastBet = bet; // Save for next game
        
        // Clear hands
        this.playerHand = [];
        this.dealerHand = [];
        
        // Refresh deck if needed
        if (this.deck.getCardsRemaining() < 15) {
            this.deck.reset();
        }
        
        // Deal initial cards - this happens sequentially in UI now
        this.dealCard(this.playerHand, true);
        this.dealCard(this.dealerHand, false); // Dealer's first card is face down
        this.dealCard(this.playerHand, true);
        this.dealCard(this.dealerHand, true);
        
        this.gameState = GameState.PlayerTurn;
        this.gameResult = GameResult.InProgress;
        
        // Check for blackjack
        if (this.calculateHandValue(this.playerHand) === 21) {
            // Allow time for animations before we reveal cards and end game
            setTimeout(() => {
                this.dealerHand[0].flip(); // Reveal dealer's hole card
                setTimeout(() => {
                    if (this.calculateHandValue(this.dealerHand) === 21) {
                        this.gameResult = GameResult.Push;
                        this.playerFunds.addFunds(this.currentBet); // Return bet on push
                    } else {
                        this.gameResult = GameResult.PlayerBlackjack;
                        this.playerFunds.addFunds(this.currentBet * 2.5); // Blackjack pays 3:2
                    }
                    this.gameState = GameState.GameOver;
                }, 500); // Delay after card flip
            }, 1000); // Delay before we flip dealer card
        }
        
        this.saveGameState();
        return true;
    }

    /**
     * Executes a hit action for the player or dealer, dealing a card to the appropriate hand.
     * - If the game state is neither PlayerTurn nor DealerTurn, the method returns immediately.
     * - Deals a card to the current turn's hand (player or dealer) and checks for a bust.
     * - In PlayerTurn state, if the player's hand value exceeds 21, the player busts.
     *   The dealer's hole card is revealed, and the game result is set to DealerWins.
     * - The game state is saved after the action is performed.
     */
    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn && this.gameState !== GameState.DealerTurn) {
            return;
        }
        
        this.dealCard(this.targetHand(), true);
        
        // Check if player busts (only in PlayerTurn state)
        if (this.gameState === GameState.PlayerTurn) {
            const playerValue = this.calculateHandValue(this.playerHand);
            if (playerValue > 21) {
                // Allow time for animations
                setTimeout(() => {
                    this.dealerHand[0].flip(); // Reveal dealer's hole card
                    setTimeout(() => {
                        this.gameResult = GameResult.DealerWins;
                        this.gameState = GameState.GameOver;
                    }, 500);
                }, 500);
            }
        }
        this.saveGameState();
    }

    /**
     * Determines the target hand based on the current game state.
     * 
     * @returns {Card[]} The player's hand if it's the player's turn; otherwise, the dealer's hand.
     */
    private targetHand(): Card[] {
        return this.gameState === GameState.PlayerTurn ? this.playerHand : this.dealerHand;
    }

    /**
     * Executes a stand action for the player or dealer.
     * - If the game state is neither PlayerTurn nor DealerTurn, the method returns immediately.
     * - If the game state is PlayerTurn, the method changes the game state to DealerTurn and
     *   reveals the dealer's hole card with a slight delay.
     * - If the game state is already DealerTurn, the method determines the winner by comparing
     *   the player's and dealer's hand values. The game result is set accordingly and the game
     *   state is set to GameOver.
     * - The game state is saved after the action is performed.
     */
    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn && this.gameState !== GameState.DealerTurn) {
            return;
        }
        
        if (this.gameState === GameState.PlayerTurn) {
            this.gameState = GameState.DealerTurn;
            
            // Reveal dealer's hole card with a slight delay
            setTimeout(() => {
                this.dealerHand[0].flip();
                this.saveGameState(); // Save state after flipping the card
            }, 500);
            
            return; // Don't proceed to game over - dealer will take their turn
        }
        
        // If we're already in dealer turn, this means the dealer is done
        if (this.gameState === GameState.DealerTurn) {
            // Determine the winner
            const playerValue = this.calculateHandValue(this.playerHand);
            const dealerValue = this.calculateHandValue(this.dealerHand);
            
            if (dealerValue > 21 || playerValue > dealerValue) {
                this.gameResult = GameResult.PlayerWins;
                this.playerFunds.addFunds(this.currentBet * 2); // Win pays 1:1
            } else if (dealerValue > playerValue) {
                this.gameResult = GameResult.DealerWins;
            } else {
                this.gameResult = GameResult.Push;
                this.playerFunds.addFunds(this.currentBet); // Return bet on push
            }
            
            this.gameState = GameState.GameOver;
        }
        this.saveGameState();
    }

    /**
     * Sets the current bet amount to the specified value, if it is a
     * positive number and does not exceed the player's current funds.
     * The current bet is the amount that will be used for the next game.
     * @param {number} amount - The amount to set as the current bet.
     */
    public setCurrentBet(amount: number): void {
        if (amount > 0 && amount <= this.playerFunds.getFunds()) {
            this.currentBet = amount;
        }
    }
    
    /**
     * Doubles the current bet and deals one more card to the player's hand.
     * Automatically stands after doubling down.
     * Returns true if the double down was successful, otherwise false.
     * A double down is only successful if the player is in their turn and
     * has enough funds to double the current bet.
     */
    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn || this.playerHand.length > 2) {
            return false;
        }
        
        // Check if player has enough funds to double down
        if (!this.playerFunds.deductFunds(this.currentBet)) {
            return false;
        }
        
        // Double the bet
        this.currentBet *= 2;
        
        // Deal one more card to player
        this.dealCard(this.playerHand, true);
        
        // Allow animation to complete before standing
        setTimeout(() => {
            // Automatically stand after doubling down
            this.playerStand();
        }, 1000);
        
        this.saveGameState();
        return true;
    }

    /**
     * Determines if the player can split their hand. A player can split their hand only if it contains two cards with the same value and the player has enough funds to double the current bet.
     * 
     * @returns {boolean} - true if the player can split their hand, false otherwise.
     */
    public canSplit(): boolean {
        return this.playerHand.length === 2 && 
               this.playerHand[0].getValue() === this.playerHand[1].getValue() &&
               this.playerFunds.getFunds() >= this.currentBet;
    }

    /**
     * Adds a callback function to be called when a card is flipped.
     * 
     * @param {Function} callback - The callback function to be called when a card is flipped.
     */
    private cardFlipCallbacks: ((card: Card) => void)[] = [];

    /**
     * Adds a callback function to be called when a card is flipped.
     * This function adds the callback to a list of callbacks that will be
     * called whenever a card in the game is flipped. The callback is passed
     * a single argument, the Card instance that was flipped.
     * 
     * @param {((card: Card) => void)} callback - The callback function to be called when a card is flipped.
     */
    public addCardFlipCallback(callback: (card: Card) => void): void {
        this.cardFlipCallbacks.push(callback);
    }

    /**
     * Deals a card from the deck to the specified hand. 
     * The card is added to the hand and, if specified, flipped face up with a slight delay.
     * Also registers any card flip callbacks for the dealt card.
     * 
     * @param {Card[]} hand - The hand to which the card should be added.
     * @param {boolean} faceUp - Determines if the card should be flipped face up after dealing.
     */
    private dealCard(hand: Card[], faceUp: boolean): void {
        const card = this.deck.drawCard();
        if (card) {
            // Add the card to the hand first
            hand.push(card);
            
            // Set up flip callback for this card
            for (const callback of this.cardFlipCallbacks) {
                card.setFlipCallback(callback);
            }
            
            // Then flip it if needed (with slight delay to allow rendering)
            if (faceUp) {
                setTimeout(() => {
                    card.flip();
                }, 300);
            }
        }
    }

    /**
     * Calculates the total value of a hand in Blackjack, optimally valuing Aces as either 1 or 11.
     * Only considers face-up cards in the hand.
     *
     * @param {Card[]} hand - The array of Card objects representing the player's or dealer's hand.
     * @returns {number} The total value of the hand.
     */
    public calculateHandValue(hand: Card[]): number {
        let value = 0;
        let aces = 0;
        
        // Count all non-ace cards first
        for (const card of hand) {
            if (card.isFaceUp()) {
                if (card.getRank() === "A") {
                    aces++;
                } else {
                    value += card.getValue();
                }
            }
        }
        
        // Handle aces optimally
        for (let i = 0; i < aces; i++) {
            if (value + 11 <= 21) {
                value += 11;
            } else {
                value += 1;
            }
        }
        
        return value;
    }

    /**
     * Retrieves the player's hand as an array of Card objects.
     * The array contains face-up cards only.
     * 
     * @returns {Card[]} The player's hand.
     */
    public getPlayerHand(): Card[] {
        return this.playerHand;
    }

    /**
     * Retrieves the dealer's hand as an array of Card objects.
     * The array contains face-up cards only.
     * 
     * @returns {Card[]} The dealer's hand.
     */
    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    /**
     * Retrieves the current game state.
     * 
     * @returns {GameState} The current game state.
     */
    public getGameState(): GameState {
        return this.gameState;
    }

    /**
     * Retrieves the result of the game, which is GameResult.InProgress
     * while the game is still ongoing and one of the other values
     * once the game has concluded.
     * 
     * @returns {GameResult} The result of the game.
     */
    public getGameResult(): GameResult {
        return this.gameResult;
    }

    /**
     * Calculates the total value of the player's hand according to Blackjack rules.
     * This method sums the values of all the cards in the player's hand, with
     * Aces counting as 11 points (but not exceeding the maximum score of 21).
     * 
     * @returns {number} The total value of the player's hand.
     */
    public getPlayerScore(): number {
        return this.calculateHandValue(this.playerHand);
    }

    /**
     * Calculates the total value of the dealer's hand according to Blackjack rules.
     * This method sums the values of all the cards in the dealer's hand, with
     * Aces counting as 11 points (but not exceeding the maximum score of 21).
     * 
     * @returns {number} The total value of the dealer's hand.
     */
    public getDealerScore(): number {
        return this.calculateHandValue(this.dealerHand);
    }
    
    /**
     * Retrieves the player's current funds.
     * 
     * @returns {number} The player's current funds.
     */
    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }
    
    /**
     * Retrieves the current bet amount for the game.
     * This is the amount the player has chosen to bet for the current game.
     * 
     * @returns {number} The current bet amount.
     */
    public getCurrentBet(): number {
        return this.currentBet;
    }
    
    /**
     * Resets the player's funds to the default amount.
     * This method is provided so the game scene can reset the player's funds
     * when the user clicks the "Reset Funds" button in the settings scene.
     */
    public resetFunds(): void {
        this.playerFunds.resetFunds();
    }
}
